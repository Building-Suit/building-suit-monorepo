-- Prospective presentation metadata only. Ledger entries and legacy report contracts stay intact.
create table public.account_statement_classifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  account_id uuid not null,
  revision bigint generated always as identity unique,
  request_id uuid not null,
  predecessor_id uuid,
  effective_from date not null check (isfinite(effective_from)),
  statement_line text not null check (statement_line in (
    'current_assets', 'property_equipment', 'other_non_current_assets',
    'current_liabilities', 'non_current_liabilities', 'equity'
  )),
  reason text not null check (char_length(btrim(reason)) between 1 and 1000),
  created_by uuid not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint account_statement_classifications_account_fk foreign key (account_id, organization_id)
    references public.accounts(id, organization_id) on delete restrict,
  constraint account_statement_classifications_request_key unique (organization_id, request_id)
);
create index account_statement_classifications_lookup_idx on public.account_statement_classifications
  (organization_id, account_id, effective_from desc, revision desc);
create index account_statement_classifications_head_idx on public.account_statement_classifications
  (account_id, revision desc);
alter table public.account_statement_classifications enable row level security;
revoke all on public.account_statement_classifications from public, anon, authenticated, service_role;
grant select on public.account_statement_classifications to authenticated, service_role;
create policy "classification history follows account or report access"
  on public.account_statement_classifications for select to authenticated
  using (app.has_capability(organization_id, 'accounts.read') or app.has_capability(organization_id, 'reports.read'));
create trigger account_statement_classifications_immutable before update or delete
  on public.account_statement_classifications for each row execute function app.reject_mutation();
comment on table public.account_statement_classifications is
  'Append-only future balance-sheet presentation decisions. Latest effective date, then revision wins. No historical backfill or ledger rewrite.';

create function app.guard_account_statement_type()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.type is distinct from old.type and exists (
    select 1 from public.account_statement_classifications c where c.account_id = old.id
  ) then
    raise exception 'STATEMENT_CLASSIFICATION_TYPE_LOCKED: account has presentation history' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function app.guard_account_statement_type() from public, anon, authenticated;
create trigger accounts_statement_type before update of type on public.accounts
  for each row execute function app.guard_account_statement_type();

create function app.schedule_account_statement_classification(
  p_organization_id uuid, p_account_id uuid, p_statement_line text,
  p_effective_from date, p_reason text, p_request_id uuid, p_expected_revision_id uuid
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_account public.accounts%rowtype;
  v_existing public.account_statement_classifications%rowtype;
  v_head public.account_statement_classifications%rowtype;
  v_lock date;
  v_id uuid;
begin
  perform app.require_capability(p_organization_id, 'accounts.update');
  if auth.uid() is null then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  if p_request_id is null then raise exception 'INVALID_CLASSIFICATION: request id is required' using errcode = '22023'; end if;
  -- Serialize retries across accounts, then competing revisions of one account.
  perform pg_advisory_xact_lock(hashtextextended('statement-classification:' || p_organization_id::text || ':' || p_request_id::text, 0));
  select * into v_account from public.accounts
    where id = p_account_id and organization_id = p_organization_id for update;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  select * into v_existing from public.account_statement_classifications
    where organization_id = p_organization_id and request_id = p_request_id;
  if found then
    if v_existing.account_id = p_account_id and v_existing.statement_line = p_statement_line
      and v_existing.effective_from = p_effective_from and v_existing.reason = btrim(p_reason)
      and v_existing.predecessor_id is not distinct from p_expected_revision_id then
      return v_existing.id;
    end if;
    raise exception 'CLASSIFICATION_REQUEST_CONFLICT: request payload changed' using errcode = '22023';
  end if;
  if v_account.is_archived then raise exception 'ACCOUNT_ARCHIVED' using errcode = '23514'; end if;
  if v_account.account_role <> 'posting' or not (
    (v_account.type = 'asset' and p_statement_line in ('current_assets','property_equipment','other_non_current_assets')) or
    (v_account.type = 'liability' and p_statement_line in ('current_liabilities','non_current_liabilities')) or
    (v_account.type = 'equity' and p_statement_line = 'equity')
  ) or p_statement_line is null then
    raise exception 'INVALID_CLASSIFICATION: incompatible account or statement line' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 1000 then
    raise exception 'INVALID_CLASSIFICATION: a reason of 1 to 1000 characters is required' using errcode = '22023';
  end if;
  -- A past/today statement must never change silently. Use the organization's day.
  if p_effective_from is null or not isfinite(p_effective_from)
    or p_effective_from <= app.org_today(p_organization_id) then
    raise exception 'CLASSIFICATION_DATE_NOT_FUTURE: choose a later organization date' using errcode = '22023';
  end if;
  -- Coordinate with settings updates. This API deliberately has no lock override.
  select books_locked_until into v_lock from public.organization_settings
    where organization_id = p_organization_id for share;
  if v_lock is not null and p_effective_from <= v_lock then
    raise exception 'BOOKS_LOCKED: classification date falls in locked books' using errcode = '42501';
  end if;
  select * into v_head from public.account_statement_classifications
    where account_id = p_account_id order by revision desc limit 1;
  if v_head.id is distinct from p_expected_revision_id then
    raise exception 'CLASSIFICATION_STALE: reload the history before saving' using errcode = '40001';
  end if;
  if v_head.effective_from > p_effective_from then
    raise exception 'CLASSIFICATION_DATE_ORDER: cannot insert before the latest scheduled date' using errcode = '22023';
  end if;
  insert into public.account_statement_classifications (
    organization_id, account_id, request_id, predecessor_id, effective_from, statement_line, reason, created_by
  ) values (p_organization_id, p_account_id, p_request_id, p_expected_revision_id,
    p_effective_from, p_statement_line, btrim(p_reason), auth.uid()) returning id into v_id;
  perform app.write_audit(p_organization_id, 'account.classification_scheduled', 'account', p_account_id,
    case when v_head.id is null then null else to_jsonb(v_head) end,
    jsonb_build_object('classification_id', v_id, 'effective_from', p_effective_from,
      'statement_line', p_statement_line, 'reason', btrim(p_reason)));
  return v_id;
end;
$$;
revoke all on function app.schedule_account_statement_classification(uuid,uuid,text,date,text,uuid,uuid) from public, anon;
grant execute on function app.schedule_account_statement_classification(uuid,uuid,text,date,text,uuid,uuid) to authenticated;
create function public.schedule_account_statement_classification(
  p_organization_id uuid, p_account_id uuid, p_statement_line text,
  p_effective_from date, p_reason text, p_request_id uuid, p_expected_revision_id uuid default null
) returns uuid language sql set search_path = '' as $$
  select app.schedule_account_statement_classification(p_organization_id,p_account_id,p_statement_line,
    p_effective_from,p_reason,p_request_id,p_expected_revision_id);
$$;
revoke all on function public.schedule_account_statement_classification(uuid,uuid,text,date,text,uuid,uuid) from public, anon;
grant execute on function public.schedule_account_statement_classification(uuid,uuid,text,date,text,uuid,uuid) to authenticated;

create function public.account_statement_classification_context(p_organization_id uuid, p_account_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_today date; v_min date; v_history jsonb;
begin
  perform app.require_capability(p_organization_id, 'accounts.read');
  if not exists(select 1 from public.accounts where id=p_account_id and organization_id=p_organization_id) then
    raise exception 'TENANT_ACCESS_DENIED' using errcode='42501';
  end if;
  v_today := app.org_today(p_organization_id);
  select greatest(v_today + 1, coalesce(s.books_locked_until + 1, v_today + 1),
    coalesce((select max(c.effective_from) from public.account_statement_classifications c
      where c.organization_id=p_organization_id and c.account_id=p_account_id),v_today+1))
    into v_min from public.organization_settings s where s.organization_id=p_organization_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'effective_from',c.effective_from,
    'statement_line',c.statement_line,'reason',c.reason,'created_at',c.created_at,
    'revision',c.revision::text) order by c.revision desc),'[]'::jsonb) into v_history
    from public.account_statement_classifications c where c.organization_id=p_organization_id and c.account_id=p_account_id;
  return jsonb_build_object('today',v_today,'min_effective_date',coalesce(v_min,v_today+1),'history',v_history);
end;
$$;
revoke all on function public.account_statement_classification_context(uuid,uuid) from public, anon;
grant execute on function public.account_statement_classification_context(uuid,uuid) to authenticated;

create function public.report_classified_balance_sheet(p_organization_id uuid, p_as_of_date date default null)
returns table (section text, account_id uuid, code text, name text, amount_minor text,
  statement_line text, classification_id uuid, effective_from date, report_date date)
language plpgsql stable set search_path = '' as $$
declare v_date date := coalesce(p_as_of_date,app.org_today(p_organization_id));
begin
  perform app.require_capability(p_organization_id,'reports.read');
  if not isfinite(v_date) then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  return query
  select r.section,r.account_id,r.code,r.name,r.amount_minor::text,
    case when r.account_id is null then 'unclosed_profit' else coalesce(c.statement_line,'unclassified_'||r.section) end,
    c.id,c.effective_from,v_date
  from public.report_balance_sheet(p_organization_id,v_date) r
  left join lateral (
    select h.id,h.statement_line,h.effective_from from public.account_statement_classifications h
    where h.organization_id=p_organization_id and h.account_id=r.account_id and h.effective_from<=v_date
    order by h.effective_from desc,h.revision desc limit 1
  ) c on true;
end;
$$;
revoke all on function public.report_classified_balance_sheet(uuid,date) from public,anon;
grant execute on function public.report_classified_balance_sheet(uuid,date) to authenticated;

create function app.statement_line_label(p_key text,p_locale text)
returns text language sql immutable set search_path = '' as $$
  select case when p_locale='ar' then case p_key
    when 'current_assets' then 'الأصول المتداولة' when 'property_equipment' then 'الممتلكات والمعدات'
    when 'other_non_current_assets' then 'الأصول غير المتداولة الأخرى'
    when 'current_liabilities' then 'الالتزامات المتداولة' when 'non_current_liabilities' then 'الالتزامات غير المتداولة'
    when 'equity' then 'حقوق الملكية' when 'unclosed_profit' then 'الربح غير المقفل'
    when 'unclassified_asset' then 'أصول غير مصنفة' when 'unclassified_liability' then 'التزامات غير مصنفة'
    when 'unclassified_equity' then 'حقوق ملكية غير مصنفة' end
  else case p_key
    when 'current_assets' then 'Current assets' when 'property_equipment' then 'Property and equipment'
    when 'other_non_current_assets' then 'Other non-current assets'
    when 'current_liabilities' then 'Current liabilities' when 'non_current_liabilities' then 'Non-current liabilities'
    when 'equity' then 'Equity' when 'unclosed_profit' then 'Unclosed profit'
    when 'unclassified_asset' then 'Unclassified assets' when 'unclassified_liability' then 'Unclassified liabilities'
    when 'unclassified_equity' then 'Unclassified equity' end end;
$$;
revoke all on function app.statement_line_label(text,text) from public,anon,authenticated;

create function public.export_classified_balance_sheet_csv(p_organization_id uuid,p_as_of_date date default null,p_locale text default 'en')
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_header text; v_body text; v_currency text;
begin
  perform app.require_capability(p_organization_id,'reports.export');
  perform app.assert_plan_feature(p_organization_id,'exports');
  if p_locale is null or p_locale not in ('en','ar') then raise exception 'INVALID_EXPORT_ARGUMENT' using errcode='22023'; end if;
  v_currency := app.org_base_currency(p_organization_id)::text;
  v_header := case when p_locale='ar' then app.csv_line('تاريخ التقرير','بند العرض','معرف الحساب','كود الحساب','الحساب','المبلغ','العملة','تاريخ سريان التصنيف','معرف التصنيف')
    else app.csv_line('report_date','presentation','account_id','code','account','amount','currency','classification_effective_from','classification_id') end;
  select string_agg(app.csv_line(r.report_date::text,app.statement_line_label(r.statement_line,p_locale),
    r.account_id::text,app.csv_untrusted_text(r.code),
    app.csv_untrusted_text(case when r.account_id is null then app.statement_line_label('unclosed_profit',p_locale) else r.name end),
    app.csv_amount(p_organization_id,r.amount_minor::bigint),v_currency,r.effective_from::text,r.classification_id::text),
    E'\n' order by r.section,r.statement_line,r.code nulls last,r.account_id)
    into v_body from public.report_classified_balance_sheet(p_organization_id,p_as_of_date) r;
  return v_header || case when v_body is null then '' else E'\n'||v_body end;
end;
$$;
revoke all on function public.export_classified_balance_sheet_csv(uuid,date,text) from public,anon;
grant execute on function public.export_classified_balance_sheet_csv(uuid,date,text) to authenticated;

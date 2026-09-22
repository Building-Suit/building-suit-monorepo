-- Read-only account-to-journal navigation. No financial data or existing contract changes.
create function public.read_account_activity(
  p_organization_id uuid, p_account_id uuid,
  p_from_date date default null, p_to_date date default null,
  p_offset integer default 0, p_limit integer default 25
) returns jsonb language plpgsql stable set search_path = '' as $$
declare
  v_account public.accounts%rowtype;
  v_from date; v_to date;
  v_opening numeric; v_debits numeric; v_credits numeric; v_count bigint;
  v_rows jsonb;
begin
  -- Require every underlying read capability: never present RLS-filtered partial totals.
  perform app.require_capability(p_organization_id, 'accounts.read');
  perform app.require_capability(p_organization_id, 'reports.read');
  perform app.require_capability(p_organization_id, 'transactions.read');
  v_to := coalesce(p_to_date, app.org_today(p_organization_id));
  v_from := coalesce(p_from_date, date_trunc('year', v_to)::date);
  if not isfinite(v_from) or not isfinite(v_to) or v_from > v_to then
    raise exception 'INVALID_DATE_RANGE' using errcode = '22023';
  end if;
  if p_offset is null or p_offset < 0 or p_limit is null or p_limit not between 1 and 100 then
    raise exception 'INVALID_INPUT: invalid activity page' using errcode = '22023';
  end if;
  select * into v_account from public.accounts where id=p_account_id and organization_id=p_organization_id;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode = '42501'; end if;
  if v_account.account_role <> 'posting' then raise exception 'INVALID_ACCOUNT: group has no direct ledger' using errcode = '22023'; end if;

  select coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)
      filter(where e.entry_date < v_from),0),
    coalesce(sum(e.base_amount_minor) filter(where e.entry_date >= v_from and e.side='debit'),0),
    coalesce(sum(e.base_amount_minor) filter(where e.entry_date >= v_from and e.side='credit'),0),
    count(*) filter(where e.entry_date >= v_from)
    into v_opening,v_debits,v_credits,v_count
  from public.transaction_entries e
  where e.organization_id=p_organization_id and e.account_id=p_account_id
    and e.posted_at is not null and e.entry_date <= v_to;

  -- Compute over the complete period before paging. Equal-date lines have a stable order.
  select coalesce(jsonb_agg(to_jsonb(page) - 'created_at' order by page.entry_date,page.created_at,page.entry_id),'[]'::jsonb)
    into v_rows from (
      select e.id as entry_id,e.transaction_id,e.entry_date,e.created_at,t.reference,t.description,e.memo,
        t.type as transaction_type,t.reverses_transaction_id,t.reversed_by_transaction_id,
        (case when e.side='debit' then e.base_amount_minor else 0 end)::text as debit_minor,
        (case when e.side='credit' then e.base_amount_minor else 0 end)::text as credit_minor,
        (v_opening + sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end)
          over(order by e.entry_date,e.created_at,e.id rows between unbounded preceding and current row))::text as balance_minor
      from public.transaction_entries e join public.transactions t on t.id=e.transaction_id and t.organization_id=e.organization_id
      where e.organization_id=p_organization_id and e.account_id=p_account_id and e.posted_at is not null
        and e.entry_date between v_from and v_to
      order by e.entry_date,e.created_at,e.id limit p_limit offset p_offset
    ) page;
  return jsonb_build_object(
    'account',jsonb_build_object('id',v_account.id,'name',v_account.name,'code',v_account.code,
      'type',v_account.type,'normal_balance',v_account.normal_balance,'is_archived',v_account.is_archived),
    'currency',app.org_base_currency(p_organization_id),'from_date',v_from,'to_date',v_to,
    'opening_minor',v_opening::text,'debit_minor',v_debits::text,'credit_minor',v_credits::text,
    'closing_minor',(v_opening+v_debits-v_credits)::text,'total',v_count,'offset',p_offset,'limit',p_limit,'rows',v_rows);
end;
$$;
revoke all on function public.read_account_activity(uuid,uuid,date,date,integer,integer) from public,anon;
grant execute on function public.read_account_activity(uuid,uuid,date,date,integer,integer) to authenticated;

create function public.read_activity_journal(p_organization_id uuid,p_transaction_id uuid)
returns jsonb language plpgsql stable set search_path = '' as $$
declare v_transaction public.transactions%rowtype; v_rows jsonb; v_debits numeric; v_credits numeric;
begin
  perform app.require_capability(p_organization_id,'accounts.read');
  perform app.require_capability(p_organization_id,'reports.read');
  perform app.require_capability(p_organization_id,'transactions.read');
  select * into v_transaction from public.transactions where id=p_transaction_id and organization_id=p_organization_id
    and posted_at is not null and deleted_at is null;
  if not found then raise exception 'TENANT_ACCESS_DENIED' using errcode='42501'; end if;
  select jsonb_agg(jsonb_build_object('entry_id',e.id,'account_id',a.id,'account_name',a.name,'account_code',a.code,
      'memo',e.memo,'debit_minor',(case when e.side='debit' then e.base_amount_minor else 0 end)::text,
      'credit_minor',(case when e.side='credit' then e.base_amount_minor else 0 end)::text,
      'original_amount_minor',e.amount_minor::text,'original_currency',e.currency_code) order by e.entry_index),
    coalesce(sum(e.base_amount_minor) filter(where e.side='debit'),0),
    coalesce(sum(e.base_amount_minor) filter(where e.side='credit'),0)
    into v_rows,v_debits,v_credits
  from public.transaction_entries e join public.accounts a on a.id=e.account_id and a.organization_id=e.organization_id
  where e.organization_id=p_organization_id and e.transaction_id=p_transaction_id and e.posted_at is not null;
  return jsonb_build_object('id',v_transaction.id,'description',v_transaction.description,'reference',v_transaction.reference,
    'date',v_transaction.transaction_date,'type',v_transaction.type,'status',v_transaction.status,
    'reverses_transaction_id',v_transaction.reverses_transaction_id,'reversed_by_transaction_id',v_transaction.reversed_by_transaction_id,
    'currency',app.org_base_currency(p_organization_id),'debit_minor',v_debits::text,'credit_minor',v_credits::text,'rows',coalesce(v_rows,'[]'::jsonb));
end;
$$;
revoke all on function public.read_activity_journal(uuid,uuid) from public,anon;
grant execute on function public.read_activity_journal(uuid,uuid) to authenticated;

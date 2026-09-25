-- V2-IMP-008 / approved V2-D05. Separate accrual history; no legacy conversion.
create table public.ar_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  customer_id uuid not null,
  control_account_id uuid not null,
  offset_account_id uuid not null,
  kind text not null check (kind in ('invoice','receipt','credit','adjustment','reversal')),
  document_date date not null check (isfinite(document_date)),
  due_date date,
  reference text not null check (length(btrim(reference)) > 0),
  amount_minor bigint not null check (amount_minor > 0),
  ar_effect_minor bigint not null check (ar_effect_minor <> 0),
  currency_code char(3) not null references public.currencies(code),
  reason text,
  reverses_document_id uuid unique,
  transaction_id uuid not null unique,
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  foreign key (customer_id, organization_id) references public.counterparties(id, organization_id) on delete restrict,
  foreign key (control_account_id, organization_id) references public.control_account_bindings(account_id, organization_id) on delete restrict,
  foreign key (offset_account_id, organization_id) references public.accounts(id, organization_id) on delete restrict,
  foreign key (transaction_id, organization_id) references public.transactions(id, organization_id) on delete restrict,
  foreign key (reverses_document_id, organization_id) references public.ar_documents(id, organization_id) on delete restrict,
  check ((kind = 'invoice' and due_date is not null and isfinite(due_date) and due_date >= document_date)
      or (kind <> 'invoice' and due_date is null)),
  check ((kind = 'reversal') = (reverses_document_id is not null)),
  check (kind not in ('credit','adjustment','reversal') or nullif(btrim(reason),'') is not null),
  check (ar_effect_minor = case when kind = 'invoice' then amount_minor
      when kind in ('receipt','credit','adjustment') then -amount_minor else ar_effect_minor end),
  check (abs(ar_effect_minor::numeric) = amount_minor)
);
create unique index ar_invoice_reference_unique on public.ar_documents(organization_id, customer_id, reference) where kind='invoice';
create index ar_documents_reporting on public.ar_documents(organization_id, control_account_id, customer_id, document_date);

-- Every reduction is allocated in full. Reversal allocations carry the opposite
-- effect and link to their originals. Originals are never updated or deleted.
create table public.ar_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  invoice_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  ar_effect_minor bigint not null check (abs(ar_effect_minor::numeric) = amount_minor),
  reverses_allocation_id uuid unique,
  unique (id, organization_id),
  unique (document_id, invoice_id),
  foreign key (document_id, organization_id) references public.ar_documents(id, organization_id) on delete restrict,
  foreign key (invoice_id, organization_id) references public.ar_documents(id, organization_id) on delete restrict,
  foreign key (reverses_allocation_id, organization_id) references public.ar_allocations(id, organization_id) on delete restrict
);
create index ar_allocations_invoice on public.ar_allocations(organization_id, invoice_id);

insert into public.capabilities(key,domain,description) values
  ('ar.read','ar','Read customer accrual statements and aging'),
  ('ar.issue','ar','Issue customer accrual obligations'),
  ('ar.receive','ar','Post fully allocated customer receipts'),
  ('ar.credit','ar','Post linked customer credits'),
  ('ar.adjust','ar','Post reasoned customer write-offs'),
  ('ar.reverse','ar','Reverse customer documents and allocations') on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role, c.key from (values ('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c where c.domain='ar' and (c.key <> 'ar.adjust' or r.role in ('owner','admin'))
on conflict do nothing;
insert into public.role_capabilities(role,capability_key) values ('viewer','ar.read') on conflict do nothing;

alter table public.ar_documents enable row level security;
alter table public.ar_allocations enable row level security;
create policy ar_documents_read on public.ar_documents for select to authenticated using (app.has_capability(organization_id,'ar.read'));
create policy ar_allocations_read on public.ar_allocations for select to authenticated using (app.has_capability(organization_id,'ar.read'));
revoke all on public.ar_documents, public.ar_allocations from public, anon, authenticated;
grant select on public.ar_documents, public.ar_allocations to authenticated;
create trigger ar_documents_immutable before update or delete on public.ar_documents for each row execute function app.reject_control_evidence_change();
create trigger ar_allocations_immutable before update or delete on public.ar_allocations for each row execute function app.reject_control_evidence_change();

-- Event stream drives open items independently of the general ledger. Group
-- by effective date when validating so same-day compensations are atomic.
create function app.ar_item_events(p_organization_id uuid)
returns table(invoice_id uuid, effective_date date, effect_minor bigint)
language sql stable security definer set search_path='' as $$
  select d.id, d.document_date, d.ar_effect_minor from public.ar_documents d
    where d.organization_id=p_organization_id and d.kind='invoice'
  union all
  select d.reverses_document_id, d.document_date, d.ar_effect_minor
    from public.ar_documents d join public.ar_documents original on original.id=d.reverses_document_id
    where d.organization_id=p_organization_id and original.kind='invoice'
  union all
  select a.invoice_id, d.document_date, a.ar_effect_minor
    from public.ar_allocations a join public.ar_documents d on d.id=a.document_id
    where a.organization_id=p_organization_id;
$$;

create function public.post_ar_document(
  p_organization_id uuid, p_kind text, p_customer_id uuid, p_control_account_id uuid,
  p_document_date date, p_amount_minor bigint, p_offset_account_id uuid,
  p_reference text, p_idempotency_key text, p_due_date date default null,
  p_allocations jsonb default '[]', p_reason text default null,
  p_reverses_document_id uuid default null
)
returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid := gen_random_uuid(); v_transaction uuid; v_existing public.ar_documents%rowtype;
  v_original public.ar_documents%rowtype; v_invoice public.ar_documents%rowtype;
  v_offset public.accounts%rowtype; v_control public.accounts%rowtype;
  v_currency char(3); v_allocations jsonb; v_payload jsonb; v_line jsonb;
  v_effect bigint; v_total numeric; v_lines jsonb; v_capability text;
begin
  v_capability := case p_kind when 'invoice' then 'ar.issue' when 'receipt' then 'ar.receive'
    when 'credit' then 'ar.credit' when 'adjustment' then 'ar.adjust' when 'reversal' then 'ar.reverse' end;
  if v_capability is null then raise exception 'AR_INVALID_KIND' using errcode='22023'; end if;
  perform app.require_capability(p_organization_id,v_capability);
  perform app.require_capability(p_organization_id,'transactions.post');
  if p_kind='reversal' then perform app.require_capability(p_organization_id,'transactions.reverse');
  else perform app.require_capability(p_organization_id,'transactions.create'); end if;
  if p_kind='adjustment' then perform app.require_capability(p_organization_id,'transactions.adjust'); end if;
  if p_amount_minor is null or p_amount_minor <= 0 or nullif(btrim(p_reference),'') is null
    or nullif(btrim(p_idempotency_key),'') is null or p_document_date is null or not isfinite(p_document_date)
    or p_allocations is null or jsonb_typeof(p_allocations) <> 'array' then
    raise exception 'AR_INVALID_INPUT' using errcode='22023';
  end if;
  if p_kind in ('credit','adjustment','reversal') and nullif(btrim(p_reason),'') is null then
    raise exception 'AR_REASON_REQUIRED' using errcode='22023'; end if;
  if p_kind='invoice' and (p_due_date is null or not isfinite(p_due_date) or p_due_date < p_document_date)
     or p_kind <> 'invoice' and p_due_date is not null then
    raise exception 'AR_INVALID_DUE_DATE' using errcode='22023'; end if;
  if (p_kind='reversal') <> (p_reverses_document_id is not null) then
    raise exception 'AR_INVALID_REVERSAL' using errcode='22023'; end if;

  -- Serialize all AR commands in a tenant, including retries and reversals.
  -- Later dated allocations cannot be invalidated by a competing backdate.
  perform pg_advisory_xact_lock(hashtextextended('ar:' || p_organization_id::text,0));
  select coalesce(jsonb_agg(jsonb_build_object('invoice_id',(x->>'invoice_id')::uuid,
      'amount_minor',((x->>'amount_minor')::bigint)::text) order by (x->>'invoice_id')::uuid),'[]'::jsonb)
    into v_allocations from jsonb_array_elements(p_allocations) x;
  v_payload := jsonb_build_object('kind',p_kind,'customer',p_customer_id,'control',p_control_account_id,
    'date',p_document_date,'due',p_due_date,'amount',p_amount_minor::text,'offset',p_offset_account_id,
    'reference',btrim(p_reference),'allocations',v_allocations,'reason',nullif(btrim(p_reason),''),'reverses',p_reverses_document_id);
  select * into v_existing from public.ar_documents where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_payload <> v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if;
    return v_existing.id;
  end if;
  v_currency := app.org_base_currency(p_organization_id);
  perform 1 from public.counterparties where id=p_customer_id and organization_id=p_organization_id
    and type='customer' and (not is_archived or p_kind='reversal') for share;
  if not found then raise exception 'AR_CUSTOMER_REQUIRED' using errcode='23514'; end if;
  if p_kind='adjustment' and exists (select 1 from public.organization_settings where organization_id=p_organization_id and require_adjustment_approval) then
    raise exception 'AR_ADJUSTMENT_APPROVAL_REQUIRED' using errcode='42501'; end if;
  perform app.begin_control_posting(p_organization_id,p_control_account_id,'customer',v_id::text,p_document_date,'subledger');
  v_control := app.require_account(p_organization_id,p_control_account_id,array['asset']::public.account_type[]);
  v_offset := app.require_account(p_organization_id,p_offset_account_id);
  if v_control.currency <> v_currency or v_offset.currency <> v_currency or v_offset.account_role <> 'posting' then
    raise exception 'AR_BASE_CURRENCY_POSTING_ACCOUNT_REQUIRED' using errcode='23514'; end if;
  if p_kind in ('invoice','credit') and (v_offset.type <> 'revenue' or v_offset.contra_account_id is not null)
    or p_kind='receipt' and (v_offset.type <> 'asset' or v_offset.subtype not in ('cash','bank','mobile_wallet'))
    or p_kind='adjustment' and v_offset.type <> 'expense' then
    raise exception 'AR_INVALID_OFFSET_ACCOUNT' using errcode='23514'; end if;
  v_effect := case when p_kind='invoice' then p_amount_minor else -p_amount_minor end;
  if p_kind='reversal' then
    select * into v_original from public.ar_documents where id=p_reverses_document_id and organization_id=p_organization_id;
    if not found or v_original.kind='reversal' or p_document_date < v_original.document_date
      or row(p_customer_id,p_control_account_id,p_offset_account_id,p_amount_minor)
        is distinct from row(v_original.customer_id,v_original.control_account_id,v_original.offset_account_id,v_original.amount_minor)
      or exists (select 1 from public.ar_documents where reverses_document_id=v_original.id) then
      raise exception 'AR_INVALID_REVERSAL' using errcode='23514'; end if;
    if v_original.kind='adjustment' then perform app.require_capability(p_organization_id,'ar.adjust'); end if;
    v_effect := -v_original.ar_effect_minor;
  end if;

  if p_kind in ('invoice','reversal') then
    if jsonb_array_length(v_allocations) <> 0 then raise exception 'AR_UNEXPECTED_ALLOCATION' using errcode='22023'; end if;
  else
    select sum((x->>'amount_minor')::bigint) into v_total from jsonb_array_elements(v_allocations) x;
    if v_total is distinct from p_amount_minor::numeric or exists (
      select 1 from jsonb_array_elements(v_allocations) x where (x->>'amount_minor')::bigint <= 0 or x->>'invoice_id' is null
    ) or exists (select 1 from jsonb_array_elements(v_allocations) x group by x->>'invoice_id' having count(*)>1) then
      raise exception 'AR_FULL_ALLOCATION_REQUIRED' using errcode='23514'; end if;
    for v_line in select * from jsonb_array_elements(v_allocations) loop
      select * into v_invoice from public.ar_documents where id=(v_line->>'invoice_id')::uuid and organization_id=p_organization_id;
      if not found or v_invoice.kind <> 'invoice' or v_invoice.customer_id <> p_customer_id
        or v_invoice.control_account_id <> p_control_account_id or v_invoice.document_date > p_document_date
        or exists (select 1 from public.ar_documents where reverses_document_id=v_invoice.id) then
        raise exception 'AR_INVALID_ALLOCATION_TARGET' using errcode='23514'; end if;
      -- Credit revenue must be the revenue originally recognized by each item.
      if p_kind='credit' and v_invoice.offset_account_id <> p_offset_account_id then
        raise exception 'AR_CREDIT_REVENUE_MISMATCH' using errcode='23514'; end if;
    end loop;
  end if;

  if p_kind='reversal' then
    v_transaction := public.reverse_transaction(v_original.transaction_id,p_reason,p_document_date);
  else
    v_lines := jsonb_build_array(
      jsonb_build_object('account_id',p_control_account_id,'side',case when v_effect>0 then 'debit' else 'credit' end,'amount_minor',p_amount_minor),
      jsonb_build_object('account_id',p_offset_account_id,'side',case when v_effect>0 then 'credit' else 'debit' end,'amount_minor',p_amount_minor));
    v_transaction := app.create_and_post(p_organization_id,
      case when p_kind='adjustment' then 'adjustment'::public.transaction_type else 'income'::public.transaction_type end,
      p_document_date,v_lines,p_currency_code=>v_currency,p_description=>btrim(p_reference),
      p_reference=>btrim(p_reference),p_counterparty_id=>p_customer_id,p_adjustment_reason=>p_reason,
      p_source=>'api',p_idempotency_key=>'ar:' || v_id::text,
      p_metadata=>jsonb_build_object('ar_document_id',v_id,'ar_kind',p_kind));
  end if;
  perform app.end_control_posting();
  insert into public.ar_documents(id,organization_id,customer_id,control_account_id,offset_account_id,kind,
    document_date,due_date,reference,amount_minor,ar_effect_minor,currency_code,reason,reverses_document_id,
    transaction_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,p_customer_id,p_control_account_id,p_offset_account_id,p_kind,
    p_document_date,p_due_date,btrim(p_reference),p_amount_minor,v_effect,v_currency,nullif(btrim(p_reason),''),
    p_reverses_document_id,v_transaction,p_idempotency_key,v_payload,auth.uid());
  if p_kind='reversal' then
    insert into public.ar_allocations(organization_id,document_id,invoice_id,amount_minor,ar_effect_minor,reverses_allocation_id)
      select p_organization_id,v_id,a.invoice_id,a.amount_minor,-a.ar_effect_minor,a.id
      from public.ar_allocations a where a.document_id=v_original.id;
  else
    insert into public.ar_allocations(organization_id,document_id,invoice_id,amount_minor,ar_effect_minor)
      select p_organization_id,v_id,(x->>'invoice_id')::uuid,(x->>'amount_minor')::bigint,-(x->>'amount_minor')::bigint
      from jsonb_array_elements(v_allocations) x;
  end if;
  -- Validate *every* affected historical/future date, not just today's balance.
  if exists (
    select 1 from (
      select sum(sum(e.effect_minor)) over(partition by e.invoice_id order by e.effective_date) balance
      from app.ar_item_events(p_organization_id) e
      where e.invoice_id=v_id or e.invoice_id=p_reverses_document_id
        or e.invoice_id in (select invoice_id from public.ar_allocations where document_id=v_id)
      group by e.invoice_id,e.effective_date
    ) dated where balance < 0
  ) then raise exception 'AR_OVERPAYMENT: allocation exceeds dated outstanding balance' using errcode='23514'; end if;
  perform app.write_audit(p_organization_id,'ar.posted','ar_document',v_id,null,
    jsonb_build_object('kind',p_kind,'transaction_id',v_transaction,'reverses',p_reverses_document_id,'reason',p_reason));
  return v_id;
end;
$$;

create function public.reverse_ar_document(p_organization_id uuid,p_document_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare d public.ar_documents%rowtype;
begin
  perform app.require_capability(p_organization_id,'ar.reverse');
  select * into d from public.ar_documents where id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'AR_DOCUMENT_NOT_FOUND' using errcode='42501'; end if;
  return public.post_ar_document(p_organization_id,'reversal',d.customer_id,d.control_account_id,p_date,
    d.amount_minor,d.offset_account_id,d.reference,p_idempotency_key,p_reason=>p_reason,p_reverses_document_id=>d.id);
end;
$$;

create function public.read_ar_open_items(p_organization_id uuid,p_as_of_date date,p_customer_id uuid default null)
returns table(invoice_id uuid,customer_id uuid,customer_name text,control_account_id uuid,reference text,
  issue_date date,due_date date,original_minor text,outstanding_minor text,aging_bucket text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'ar.read');
  if p_as_of_date is null or not isfinite(p_as_of_date) then raise exception 'AR_INVALID_DATE' using errcode='22023'; end if;
  return query select d.id,d.customer_id,c.name,d.control_account_id,d.reference,d.document_date,d.due_date,
    d.amount_minor::text,sum(e.effect_minor)::text,
    case when p_as_of_date<=d.due_date then 'current' when p_as_of_date-d.due_date<=30 then '1_30'
      when p_as_of_date-d.due_date<=60 then '31_60' when p_as_of_date-d.due_date<=90 then '61_90' else '91_plus' end
    from public.ar_documents d join public.counterparties c on c.id=d.customer_id
    join app.ar_item_events(p_organization_id) e on e.invoice_id=d.id and e.effective_date<=p_as_of_date
    where d.organization_id=p_organization_id and d.kind='invoice' and (p_customer_id is null or d.customer_id=p_customer_id)
    group by d.id,c.name having sum(e.effect_minor)<>0 order by d.due_date,d.reference,d.id;
end;
$$;

create function public.read_ar_statement(p_organization_id uuid,p_customer_id uuid,p_from date,p_to date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app.require_capability(p_organization_id,'ar.read');
  if p_from is null or p_to is null or not isfinite(p_from) or not isfinite(p_to) or p_from>p_to then
    raise exception 'AR_INVALID_DATE' using errcode='22023'; end if;
  with amounts as (
    select coalesce(sum(ar_effect_minor) filter(where document_date<p_from),0) opening,
      coalesce(sum(ar_effect_minor) filter(where document_date between p_from and p_to and kind='invoice'),0) charges,
      coalesce(sum(-ar_effect_minor) filter(where document_date between p_from and p_to and kind='receipt'),0) receipts,
      coalesce(sum(ar_effect_minor) filter(where document_date between p_from and p_to and kind not in ('invoice','receipt')),0) adjustments,
      coalesce(sum(ar_effect_minor),0) closing
    from public.ar_documents where organization_id=p_organization_id and customer_id=p_customer_id and document_date<=p_to
  ), movements as (
    select d.*, a.opening + sum(d.ar_effect_minor) over(order by d.document_date,d.created_at,d.id) running
    from public.ar_documents d cross join amounts a
    where d.organization_id=p_organization_id and d.customer_id=p_customer_id and d.document_date between p_from and p_to
  ) select jsonb_build_object('opening_minor',opening::text,'charges_minor',charges::text,
      'receipts_minor',receipts::text,'adjustments_minor',adjustments::text,'closing_minor',closing::text,
      'movements',coalesce((select jsonb_agg(jsonb_build_object('id',m.id,'kind',m.kind,'date',m.document_date,
        'reference',m.reference,'effect_minor',m.ar_effect_minor::text,'balance_minor',m.running::text,
        'transaction_id',m.transaction_id,'reason',m.reason,'reverses_document_id',m.reverses_document_id,
        'reversed',exists(select 1 from public.ar_documents r where r.reverses_document_id=m.id))
        order by m.document_date,m.created_at,m.id) from movements m),'[]'::jsonb)) into result from amounts;
  return result;
end;
$$;

create or replace function app.control_subledger_balance(p_organization_id uuid,p_control_account_id uuid,
  p_subledger_type public.control_subledger_type,p_as_of_date date)
returns table(provider_available boolean,balance_minor bigint,provider_reference text)
language sql stable security definer set search_path='' as $$
  select p_subledger_type='customer',case when p_subledger_type='customer' then
    (select coalesce(sum(d.ar_effect_minor),0)::bigint from public.ar_documents d
      where d.organization_id=p_organization_id and d.control_account_id=p_control_account_id and d.document_date<=p_as_of_date)
    else null::bigint end,
    case when p_subledger_type='customer' then 'ar_documents:v1' else 'not_implemented' end;
$$;

-- Review evidence only: intentionally no conversion endpoint or inferred mapping.
create function public.preview_legacy_ar(p_organization_id uuid)
returns table(commitment_id uuid,customer_id uuid,reference text,currency_code char(3),original_minor text,
  cash_settled_minor text,legacy_open_minor text,linked_account_id uuid,treatment text)
language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'ar.read');
  perform app.require_capability(p_organization_id,'commitments.read');
  return query select c.id,c.counterparty_id,c.title,c.currency_code,c.amount_minor::text,c.settled_amount_minor::text,
    (c.amount_minor-c.settled_amount_minor)::text,c.linked_account_id,
    'review_required_cash_basis_excluded'::text from public.commitments c
    where c.organization_id=p_organization_id and c.type='receivable' order by c.due_date,c.id;
end;
$$;

revoke all on function app.ar_item_events(uuid),
  app.control_subledger_balance(uuid,uuid,public.control_subledger_type,date) from public,anon,authenticated;
revoke all on function public.post_ar_document(uuid,text,uuid,uuid,date,bigint,uuid,text,text,date,jsonb,text,uuid),
  public.reverse_ar_document(uuid,uuid,date,text,text),public.read_ar_open_items(uuid,date,uuid),
  public.read_ar_statement(uuid,uuid,date,date),public.preview_legacy_ar(uuid) from public,anon;
grant execute on function public.post_ar_document(uuid,text,uuid,uuid,date,bigint,uuid,text,text,date,jsonb,text,uuid),
  public.reverse_ar_document(uuid,uuid,date,text,text),public.read_ar_open_items(uuid,date,uuid),
  public.read_ar_statement(uuid,uuid,date,date),public.preview_legacy_ar(uuid) to authenticated;

-- One snapshot for the workspace, with all monetary JSON values encoded as
-- decimal strings so a PostgREST/JavaScript hop cannot lose bigint precision.
create function public.read_ar_workspace(p_organization_id uuid,p_as_of_date date,p_from date,p_customer_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app.require_capability(p_organization_id,'ar.read');
  if p_from is null or not isfinite(p_from) or p_as_of_date is null or not isfinite(p_as_of_date) or p_from>p_as_of_date then
    raise exception 'AR_INVALID_DATE' using errcode='22023'; end if;
  return jsonb_build_object(
    'customers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name,'archived',is_archived) order by name)
      from public.counterparties where organization_id=p_organization_id and type='customer'),'[]'::jsonb),
    'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.type,'subtype',a.subtype,
      'role',a.account_role,'subledger',b.subledger_type) order by a.name)
      from public.accounts a left join public.control_account_bindings b on b.account_id=a.id
      where a.organization_id=p_organization_id and not a.is_archived and a.currency=app.org_base_currency(p_organization_id)
        and a.contra_account_id is null and a.account_role<>'group'),'[]'::jsonb),
    'items',coalesce((select jsonb_agg(to_jsonb(i)) from public.read_ar_open_items(p_organization_id,p_as_of_date,p_customer_id) i),'[]'::jsonb),
    'statement',case when p_customer_id is not null then public.read_ar_statement(p_organization_id,p_customer_id,p_from,p_as_of_date) else null end,
    'reconciliation',case when app.has_capability(p_organization_id,'controls.reconcile') then
      coalesce((select jsonb_agg(to_jsonb(r) || jsonb_build_object('gl_balance_minor',r.gl_balance_minor::text,
        'subledger_balance_minor',r.subledger_balance_minor::text,'variance_minor',r.variance_minor::text))
        from public.reconcile_control_accounts(p_organization_id,p_as_of_date) r where r.subledger_type='customer'),'[]'::jsonb) else '[]'::jsonb end,
    'legacy',case when app.has_capability(p_organization_id,'commitments.read') then
      coalesce((select jsonb_agg(to_jsonb(l)) from public.preview_legacy_ar(p_organization_id) l),'[]'::jsonb) else '[]'::jsonb end);
end;
$$;
revoke all on function public.read_ar_workspace(uuid,date,date,uuid) from public,anon;
grant execute on function public.read_ar_workspace(uuid,date,date,uuid) to authenticated;

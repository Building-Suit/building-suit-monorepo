-- LS-FX-001 / V2-D13 revision 2. Forward-only foreign-currency AR/AP.
-- Existing base-currency documents remain in ar_documents/ap_documents unchanged.

insert into public.capabilities(key,domain,description) values
  ('fx.read','fx','Read foreign-currency AR/AP evidence'),
  ('fx.manage','fx','Configure explicitly mapped FX accounts'),
  ('fx.revalue','fx','Preview and confirm outstanding-item revaluations')
on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select role::public.organization_role, capability from (values
  ('owner','fx.read'),('owner','fx.manage'),('owner','fx.revalue'),
  ('admin','fx.read'),('admin','fx.manage'),('admin','fx.revalue'),
  ('accountant','fx.read'),('accountant','fx.revalue'),('viewer','fx.read')
) x(role,capability) on conflict do nothing;

create table public.fx_account_mappings (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  realized_gain_account_id uuid not null,
  realized_loss_account_id uuid not null,
  unrealized_gain_account_id uuid not null,
  unrealized_loss_account_id uuid not null,
  configured_by uuid not null references public.profiles(id) on delete restrict,
  configured_at timestamptz not null default now(),
  foreign key (realized_gain_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key (realized_loss_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key (unrealized_gain_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key (unrealized_loss_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict
);

create table public.fx_open_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subledger_type text not null check (subledger_type in ('customer','supplier')),
  counterparty_id uuid not null,
  control_account_id uuid not null,
  offset_account_id uuid not null,
  document_date date not null check (isfinite(document_date)),
  due_date date not null check (isfinite(due_date) and due_date >= document_date),
  reference text not null check (length(btrim(reference))>0),
  currency_code char(3) not null references public.currencies(code),
  original_minor bigint not null check (original_minor>0),
  recognition_rate numeric(24,12) not null check (recognition_rate>0),
  original_base_minor bigint not null check (original_base_minor>0),
  rate_date date not null check (isfinite(rate_date)),
  rate_source text not null check (length(btrim(rate_source))>0),
  rate_reference text not null check (length(btrim(rate_reference))>0),
  transaction_id uuid not null unique,
  reverses_item_id uuid unique,
  idempotency_key text not null check (length(btrim(idempotency_key))>0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(organization_id,idempotency_key),
  foreign key(counterparty_id,organization_id) references public.counterparties(id,organization_id) on delete restrict,
  foreign key(control_account_id,organization_id) references public.control_account_bindings(account_id,organization_id) on delete restrict,
  foreign key(offset_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(reverses_item_id,organization_id) references public.fx_open_items(id,organization_id) on delete restrict,
  check ((reverses_item_id is null) or original_minor>0)
);
create index fx_open_items_reporting on public.fx_open_items(organization_id,subledger_type,control_account_id,counterparty_id,document_date);
create unique index fx_open_item_reference_unique on public.fx_open_items(organization_id,counterparty_id,reference) where reverses_item_id is null;

create table public.fx_settlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subledger_type text not null check (subledger_type in ('customer','supplier')),
  counterparty_id uuid not null,
  control_account_id uuid not null,
  cash_account_id uuid not null,
  settlement_date date not null check (isfinite(settlement_date)),
  reference text not null check (length(btrim(reference))>0),
  settlement_currency char(3) not null references public.currencies(code),
  gross_settlement_minor bigint not null check (gross_settlement_minor>0),
  settlement_rate numeric(24,12) not null check (settlement_rate>0),
  settlement_base_minor bigint not null check (settlement_base_minor>0),
  rate_date date not null check (isfinite(rate_date)),
  rate_source text not null check (length(btrim(rate_source))>0),
  rate_reference text not null check (length(btrim(rate_reference))>0),
  carrying_base_minor bigint not null check (carrying_base_minor>0),
  realized_fx_base_minor bigint not null,
  reclassified_unrealized_base_minor bigint not null,
  transaction_id uuid not null unique,
  reverses_settlement_id uuid unique,
  idempotency_key text not null check (length(btrim(idempotency_key))>0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(organization_id,idempotency_key),
  foreign key(counterparty_id,organization_id) references public.counterparties(id,organization_id) on delete restrict,
  foreign key(control_account_id,organization_id) references public.control_account_bindings(account_id,organization_id) on delete restrict,
  foreign key(cash_account_id,organization_id) references public.accounts(id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(reverses_settlement_id,organization_id) references public.fx_settlements(id,organization_id) on delete restrict
);

create table public.fx_allocations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  settlement_id uuid not null,
  open_item_id uuid not null,
  document_amount_minor bigint not null check (document_amount_minor>0),
  settlement_amount_minor bigint not null check (settlement_amount_minor>0),
  allocation_rate numeric(24,12) not null check (allocation_rate>0),
  conversion_evidence text not null check (length(btrim(conversion_evidence))>0),
  carrying_base_minor bigint not null check (carrying_base_minor>0),
  original_base_minor bigint not null check (original_base_minor>0),
  settlement_base_minor bigint not null check (settlement_base_minor>0),
  realized_fx_base_minor bigint not null,
  rounding_residual_base_minor bigint not null default 0,
  reverses_allocation_id uuid unique,
  unique(id,organization_id), unique(settlement_id,open_item_id),
  foreign key(settlement_id,organization_id) references public.fx_settlements(id,organization_id) on delete restrict deferrable initially deferred,
  foreign key(open_item_id,organization_id) references public.fx_open_items(id,organization_id) on delete restrict,
  foreign key(reverses_allocation_id,organization_id) references public.fx_allocations(id,organization_id) on delete restrict
);
create index fx_allocations_item on public.fx_allocations(organization_id,open_item_id);

create table public.fx_revaluation_batches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subledger_type text not null check (subledger_type in ('customer','supplier')),
  control_account_id uuid not null,
  as_of_date date not null check (isfinite(as_of_date)),
  reference text not null check (length(btrim(reference))>0),
  rate_source text not null check (length(btrim(rate_source))>0),
  transaction_id uuid unique,
  total_delta_base_minor bigint not null,
  reverses_batch_id uuid unique,
  idempotency_key text not null check (length(btrim(idempotency_key))>0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(id,organization_id), unique(organization_id,idempotency_key),
  foreign key(control_account_id,organization_id) references public.control_account_bindings(account_id,organization_id) on delete restrict,
  foreign key(transaction_id,organization_id) references public.transactions(id,organization_id) on delete restrict,
  foreign key(reverses_batch_id,organization_id) references public.fx_revaluation_batches(id,organization_id) on delete restrict
);
create table public.fx_revaluation_lines (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  open_item_id uuid not null,
  currency_code char(3) not null references public.currencies(code),
  outstanding_minor bigint not null check (outstanding_minor>0),
  closing_rate numeric(24,12) not null check (closing_rate>0),
  rate_reference text not null check (length(btrim(rate_reference))>0),
  previous_carrying_base_minor bigint not null check (previous_carrying_base_minor>0),
  closing_base_minor bigint not null check (closing_base_minor>0),
  delta_base_minor bigint not null check (delta_base_minor<>0),
  reverses_line_id uuid unique,
  unique(id,organization_id), unique(batch_id,open_item_id),
  foreign key(batch_id,organization_id) references public.fx_revaluation_batches(id,organization_id) on delete restrict deferrable initially deferred,
  foreign key(open_item_id,organization_id) references public.fx_open_items(id,organization_id) on delete restrict,
  foreign key(reverses_line_id,organization_id) references public.fx_revaluation_lines(id,organization_id) on delete restrict
);

alter table public.fx_account_mappings enable row level security;
alter table public.fx_open_items enable row level security;
alter table public.fx_settlements enable row level security;
alter table public.fx_allocations enable row level security;
alter table public.fx_revaluation_batches enable row level security;
alter table public.fx_revaluation_lines enable row level security;
create policy fx_mapping_read on public.fx_account_mappings for select to authenticated using(app.has_capability(organization_id,'fx.read'));
create policy fx_items_read on public.fx_open_items for select to authenticated using(app.has_capability(organization_id,'fx.read'));
create policy fx_settlements_read on public.fx_settlements for select to authenticated using(app.has_capability(organization_id,'fx.read'));
create policy fx_allocations_read on public.fx_allocations for select to authenticated using(app.has_capability(organization_id,'fx.read'));
create policy fx_batches_read on public.fx_revaluation_batches for select to authenticated using(app.has_capability(organization_id,'fx.read'));
create policy fx_lines_read on public.fx_revaluation_lines for select to authenticated using(app.has_capability(organization_id,'fx.read'));
revoke all on public.fx_account_mappings,public.fx_open_items,public.fx_settlements,public.fx_allocations,public.fx_revaluation_batches,public.fx_revaluation_lines from public,anon,authenticated;
grant select on public.fx_account_mappings,public.fx_open_items,public.fx_settlements,public.fx_allocations,public.fx_revaluation_batches,public.fx_revaluation_lines to authenticated;
create trigger fx_mapping_immutable before update or delete on public.fx_account_mappings for each row execute function app.reject_control_evidence_change();
create trigger fx_items_immutable before update or delete on public.fx_open_items for each row execute function app.reject_control_evidence_change();
create trigger fx_settlements_immutable before update or delete on public.fx_settlements for each row execute function app.reject_control_evidence_change();
create trigger fx_allocations_immutable before update or delete on public.fx_allocations for each row execute function app.reject_control_evidence_change();
create trigger fx_batches_immutable before update or delete on public.fx_revaluation_batches for each row execute function app.reject_control_evidence_change();
create trigger fx_lines_immutable before update or delete on public.fx_revaluation_lines for each row execute function app.reject_control_evidence_change();

create function app.fx_item_position(p_organization_id uuid,p_item_id uuid,p_as_of date)
returns table(outstanding_minor bigint,carrying_base_minor bigint,original_base_minor bigint)
language sql stable security definer set search_path='' as $$
  with item as (select * from public.fx_open_items where id=p_item_id and organization_id=p_organization_id and document_date<=p_as_of),
  reversed as (select exists(select 1 from public.fx_open_items r where r.reverses_item_id=p_item_id and r.document_date<=p_as_of) yes), allocated as (
    select coalesce(sum(case when s.reverses_settlement_id is null then a.document_amount_minor else -a.document_amount_minor end),0)::bigint doc,
      coalesce(sum(case when s.reverses_settlement_id is null then a.carrying_base_minor else -a.carrying_base_minor end),0)::bigint carrying,
      coalesce(sum(case when s.reverses_settlement_id is null then a.original_base_minor else -a.original_base_minor end),0)::bigint original
    from public.fx_allocations a join public.fx_settlements s on s.id=a.settlement_id
    where a.open_item_id=p_item_id and s.settlement_date<=p_as_of
  ), revalued as (
    select coalesce(sum(case when b.reverses_batch_id is null then l.delta_base_minor else -l.delta_base_minor end),0)::bigint delta
    from public.fx_revaluation_lines l join public.fx_revaluation_batches b on b.id=l.batch_id
    where l.open_item_id=p_item_id and b.as_of_date<=p_as_of
  )
  select (case when z.yes then 0 else i.original_minor-a.doc end)::bigint,
    (case when z.yes then 0 else i.original_base_minor+r.delta-a.carrying end)::bigint,
    (case when z.yes then 0 else i.original_base_minor-a.original end)::bigint
  from item i cross join reversed z cross join allocated a cross join revalued r;
$$;

create function public.configure_fx_accounts(p_organization_id uuid,p_realized_gain uuid,p_realized_loss uuid,p_unrealized_gain uuid,p_unrealized_loss uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare a public.accounts%rowtype; ids uuid[]:=array[p_realized_gain,p_realized_loss,p_unrealized_gain,p_unrealized_loss]; i uuid;
begin
  perform app.require_capability(p_organization_id,'fx.manage');
  foreach i in array ids loop
    a:=app.require_account(p_organization_id,i);
    if a.account_role<>'posting' or a.currency<>app.org_base_currency(p_organization_id) then raise exception 'FX_BASE_POSTING_ACCOUNT_REQUIRED' using errcode='23514'; end if;
  end loop;
  if (app.require_account(p_organization_id,p_realized_gain)).type<>'revenue' or (app.require_account(p_organization_id,p_unrealized_gain)).type<>'revenue'
    or (app.require_account(p_organization_id,p_realized_loss)).type<>'expense' or (app.require_account(p_organization_id,p_unrealized_loss)).type<>'expense' then
    raise exception 'FX_GAIN_LOSS_MAPPING_INVALID' using errcode='23514'; end if;
  if exists(select 1 from public.fx_account_mappings where organization_id=p_organization_id) then
    raise exception 'FX_MAPPING_REPLACEMENT_REQUIRES_REVIEWED_REVISION' using errcode='55000'; end if;
  insert into public.fx_account_mappings values(p_organization_id,p_realized_gain,p_realized_loss,p_unrealized_gain,p_unrealized_loss,auth.uid(),now());
  perform app.write_audit(p_organization_id,'fx_mapping.configured','organization',p_organization_id,null,jsonb_build_object('realized_gain',p_realized_gain,'realized_loss',p_realized_loss,'unrealized_gain',p_unrealized_gain,'unrealized_loss',p_unrealized_loss));
  return p_organization_id;
end; $$;

create function public.post_fx_open_item(
  p_organization_id uuid,p_subledger_type text,p_counterparty_id uuid,p_control_account_id uuid,p_offset_account_id uuid,
  p_document_date date,p_due_date date,p_reference text,p_currency_code char(3),p_original_minor bigint,p_recognition_rate numeric,
  p_rate_date date,p_rate_source text,p_rate_reference text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_base char(3); v_base_amount bigint; v_control public.accounts%rowtype; v_offset public.accounts%rowtype;
 v_existing public.fx_open_items%rowtype; v_payload jsonb; v_tx uuid; v_kind text; v_lines jsonb;
begin
  if p_subledger_type not in ('customer','supplier') then raise exception 'FX_INVALID_SUBLEDGER' using errcode='22023'; end if;
  perform app.require_capability(p_organization_id,case when p_subledger_type='customer' then 'ar.issue' else 'ap.issue' end);
  perform app.require_capability(p_organization_id,'transactions.create'); perform app.require_capability(p_organization_id,'transactions.post');
  if p_original_minor is null or p_original_minor<=0 or p_recognition_rate is null or p_recognition_rate<=0 or p_document_date is null or p_due_date<p_document_date
    or p_rate_date is distinct from p_document_date or nullif(btrim(p_reference),'') is null or nullif(btrim(p_rate_source),'') is null
    or nullif(btrim(p_rate_reference),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0));
  v_base:=app.org_base_currency(p_organization_id);
  perform app.assert_write_currency(p_organization_id,p_currency_code);
  if p_currency_code=v_base then raise exception 'FX_FOREIGN_CURRENCY_REQUIRED: use the existing base-currency subledger' using errcode='23514'; end if;
  if not exists(select 1 from public.fx_account_mappings where organization_id=p_organization_id) then raise exception 'FX_ACCOUNT_MAPPING_REQUIRED' using errcode='23514'; end if;
  if p_currency_code=v_base and p_recognition_rate<>1 then raise exception 'FX_BASE_RATE_MUST_BE_ONE' using errcode='23514'; end if;
  v_base_amount:=app.convert_minor(p_original_minor,p_currency_code,v_base,p_recognition_rate);
  v_payload:=jsonb_build_object('subledger',p_subledger_type,'counterparty',p_counterparty_id,'control',p_control_account_id,'offset',p_offset_account_id,'date',p_document_date,'due',p_due_date,'reference',btrim(p_reference),'currency',p_currency_code,'amount',p_original_minor::text,'rate',p_recognition_rate::text,'rate_date',p_rate_date,'source',btrim(p_rate_source),'rate_reference',btrim(p_rate_reference));
  select * into v_existing from public.fx_open_items where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then if v_existing.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return v_existing.id; end if;
  perform 1 from public.counterparties where id=p_counterparty_id and organization_id=p_organization_id and type=(case when p_subledger_type='customer' then 'customer' else 'vendor' end)::public.counterparty_type and not is_archived for share;
  if not found then raise exception 'FX_COUNTERPARTY_REQUIRED' using errcode='23514'; end if;
  v_control:=app.require_account(p_organization_id,p_control_account_id,array[case when p_subledger_type='customer' then 'asset'::public.account_type else 'liability'::public.account_type end]);
  v_offset:=app.require_account(p_organization_id,p_offset_account_id);
  if v_control.account_role<>'control' or v_control.control_subledger_type<>p_subledger_type::public.control_subledger_type or v_control.currency<>v_base or v_offset.account_role<>'posting' or v_offset.currency<>v_base
    or (p_subledger_type='customer' and v_offset.type<>'revenue') or (p_subledger_type='supplier' and v_offset.type not in ('expense','asset')) then raise exception 'FX_ACCOUNT_MAPPING_INVALID' using errcode='23514'; end if;
  perform app.begin_control_posting(p_organization_id,p_control_account_id,p_subledger_type::public.control_subledger_type,v_id::text,p_document_date,'subledger');
  v_lines:=jsonb_build_array(
    jsonb_build_object('account_id',p_control_account_id,'side',case when p_subledger_type='customer' then 'debit' else 'credit' end,'amount_minor',p_original_minor,'currency_code',p_currency_code,'exchange_rate',p_recognition_rate),
    jsonb_build_object('account_id',p_offset_account_id,'side',case when p_subledger_type='customer' then 'credit' else 'debit' end,'amount_minor',p_original_minor,'currency_code',p_currency_code,'exchange_rate',p_recognition_rate));
  v_tx:=app.create_and_post(p_organization_id,case when p_subledger_type='customer' then 'income'::public.transaction_type else 'expense'::public.transaction_type end,p_document_date,v_lines,p_currency_code,p_recognition_rate,btrim(p_reference),btrim(p_reference),p_counterparty_id,p_source=>'api',p_idempotency_key=>'fx-item:'||v_id::text,p_metadata=>jsonb_build_object('fx_open_item_id',v_id,'rate_source',btrim(p_rate_source),'rate_reference',btrim(p_rate_reference)));
  perform app.end_control_posting();
  insert into public.fx_open_items(id,organization_id,subledger_type,counterparty_id,control_account_id,offset_account_id,document_date,due_date,reference,currency_code,original_minor,recognition_rate,original_base_minor,rate_date,rate_source,rate_reference,transaction_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,p_subledger_type,p_counterparty_id,p_control_account_id,p_offset_account_id,p_document_date,p_due_date,btrim(p_reference),p_currency_code,p_original_minor,p_recognition_rate,v_base_amount,p_rate_date,btrim(p_rate_source),btrim(p_rate_reference),v_tx,p_idempotency_key,v_payload,auth.uid());
  perform app.write_audit(p_organization_id,'fx_item.posted','fx_open_item',v_id,null,jsonb_build_object('transaction_id',v_tx,'currency',p_currency_code,'original_minor',p_original_minor::text,'base_minor',v_base_amount::text)); return v_id;
end; $$;

create function public.reverse_fx_open_item(p_organization_id uuid,p_item_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.fx_open_items%rowtype; e public.fx_open_items%rowtype; v_id uuid:=gen_random_uuid(); v_tx uuid; v_payload jsonb; p record;
begin
  perform app.require_capability(p_organization_id,'transactions.reverse');
  if p_date is null or nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0));
  v_payload:=jsonb_build_object('item',p_item_id,'date',p_date,'reason',btrim(p_reason));
  select * into e from public.fx_open_items where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then if e.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return e.id; end if;
  select * into o from public.fx_open_items where id=p_item_id and organization_id=p_organization_id;
  perform app.require_capability(p_organization_id,case when o.subledger_type='customer' then 'ar.reverse' else 'ap.reverse' end);
  select * into p from app.fx_item_position(p_organization_id,p_item_id,p_date);
  if not found or o.reverses_item_id is not null or p_date<o.document_date or p.outstanding_minor<>o.original_minor or p.carrying_base_minor<>o.original_base_minor
    or exists(select 1 from public.fx_open_items where reverses_item_id=o.id)
    or exists(select 1 from public.fx_settlements s join public.fx_allocations a on a.settlement_id=s.id where a.open_item_id=o.id)
    or exists(select 1 from public.fx_revaluation_lines where open_item_id=o.id) then raise exception 'FX_REVERSAL_DEPENDENCY' using errcode='23514'; end if;
  perform app.begin_control_posting(p_organization_id,o.control_account_id,o.subledger_type::public.control_subledger_type,v_id::text,p_date,'subledger'); v_tx:=public.reverse_transaction(o.transaction_id,btrim(p_reason),p_date); perform app.end_control_posting();
  insert into public.fx_open_items(id,organization_id,subledger_type,counterparty_id,control_account_id,offset_account_id,document_date,due_date,reference,currency_code,original_minor,recognition_rate,original_base_minor,rate_date,rate_source,rate_reference,transaction_id,reverses_item_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,o.subledger_type,o.counterparty_id,o.control_account_id,o.offset_account_id,p_date,p_date,o.reference,o.currency_code,o.original_minor,o.recognition_rate,o.original_base_minor,o.rate_date,o.rate_source,o.rate_reference,v_tx,o.id,p_idempotency_key,v_payload,auth.uid());
  perform app.write_audit(p_organization_id,'fx_item.reversed','fx_open_item',v_id,null,jsonb_build_object('reverses',o.id,'transaction_id',v_tx,'reason',btrim(p_reason))); return v_id;
end; $$;

create function public.post_fx_settlement(
  p_organization_id uuid,p_subledger_type text,p_counterparty_id uuid,p_control_account_id uuid,p_cash_account_id uuid,
  p_settlement_date date,p_reference text,p_settlement_currency char(3),p_gross_settlement_minor bigint,p_settlement_rate numeric,
  p_rate_date date,p_rate_source text,p_rate_reference text,p_allocations jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_existing public.fx_settlements%rowtype; v_map public.fx_account_mappings%rowtype; v_item public.fx_open_items%rowtype;
 v_line jsonb; v_canonical jsonb; v_payload jsonb; v_base char(3); v_cash public.accounts%rowtype; v_out bigint; v_carry bigint; v_original bigint;
 v_doc bigint; v_settle bigint; v_alloc_rate numeric; v_alloc_base bigint; v_alloc_carry bigint; v_alloc_original bigint; v_residual bigint;
 v_total_settle numeric:=0; v_total_base bigint:=0; v_total_carry bigint:=0; v_total_original bigint:=0; v_gross_base bigint; v_last_id uuid; v_raw_base bigint; v_tx uuid; v_lines jsonb; v_diff bigint; v_prior bigint; v_clear_gain bigint:=0; v_clear_loss bigint:=0; v_prior_gain bigint:=0; v_prior_loss bigint:=0;
begin
  if p_subledger_type not in ('customer','supplier') then raise exception 'FX_INVALID_SUBLEDGER' using errcode='22023'; end if;
  perform app.require_capability(p_organization_id,case when p_subledger_type='customer' then 'ar.receive' else 'ap.receive' end);
  perform app.require_capability(p_organization_id,'transactions.create'); perform app.require_capability(p_organization_id,'transactions.post');
  if p_gross_settlement_minor is null or p_gross_settlement_minor<=0 or p_settlement_rate is null or p_settlement_rate<=0 or p_settlement_date is null
    or p_rate_date is distinct from p_settlement_date or p_allocations is null or jsonb_typeof(p_allocations)<>'array' or jsonb_array_length(p_allocations)=0
    or nullif(btrim(p_reference),'') is null or nullif(btrim(p_rate_source),'') is null or nullif(btrim(p_rate_reference),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0)); v_base:=app.org_base_currency(p_organization_id);
  perform app.assert_write_currency(p_organization_id,p_settlement_currency);
  if p_settlement_currency=v_base and p_settlement_rate<>1 then raise exception 'FX_BASE_RATE_MUST_BE_ONE' using errcode='23514'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('item_id',(x->>'item_id')::uuid,'document_amount_minor',((x->>'document_amount_minor')::bigint)::text,'settlement_amount_minor',((x->>'settlement_amount_minor')::bigint)::text,'allocation_rate',((x->>'allocation_rate')::numeric)::text,'conversion_evidence',btrim(x->>'conversion_evidence')) order by (x->>'item_id')::uuid),'[]') into v_canonical from jsonb_array_elements(p_allocations)x;
  select (x->>'item_id')::uuid into v_last_id from jsonb_array_elements(v_canonical)x order by (x->>'item_id')::uuid desc limit 1;
  v_gross_base:=app.convert_minor(p_gross_settlement_minor,p_settlement_currency,v_base,p_settlement_rate);
  v_payload:=jsonb_build_object('subledger',p_subledger_type,'counterparty',p_counterparty_id,'control',p_control_account_id,'cash',p_cash_account_id,'date',p_settlement_date,'reference',btrim(p_reference),'currency',p_settlement_currency,'gross',p_gross_settlement_minor::text,'rate',p_settlement_rate::text,'rate_date',p_rate_date,'source',btrim(p_rate_source),'rate_reference',btrim(p_rate_reference),'allocations',v_canonical);
  select * into v_existing from public.fx_settlements where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then if v_existing.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return v_existing.id; end if;
  select * into v_map from public.fx_account_mappings where organization_id=p_organization_id; if not found then raise exception 'FX_ACCOUNT_MAPPING_REQUIRED' using errcode='23514'; end if;
  v_cash:=app.require_account(p_organization_id,p_cash_account_id,array['asset']::public.account_type[]);
  if v_cash.account_role<>'posting' or v_cash.subtype not in ('cash','bank','mobile_wallet') or v_cash.currency<>p_settlement_currency then raise exception 'FX_CASH_ACCOUNT_INVALID' using errcode='23514'; end if;
  if exists(select 1 from jsonb_array_elements(v_canonical)x group by x->>'item_id' having count(*)>1) then raise exception 'FX_DUPLICATE_ALLOCATION' using errcode='23514'; end if;
  for v_line in select * from jsonb_array_elements(v_canonical) loop
    v_doc:=(v_line->>'document_amount_minor')::bigint; v_settle:=(v_line->>'settlement_amount_minor')::bigint; v_alloc_rate:=(v_line->>'allocation_rate')::numeric;
    if v_doc<=0 or v_settle<=0 or v_alloc_rate<=0 or nullif(btrim(v_line->>'conversion_evidence'),'') is null then raise exception 'FX_ALLOCATION_INVALID' using errcode='22023'; end if;
    select * into v_item from public.fx_open_items where id=(v_line->>'item_id')::uuid and organization_id=p_organization_id;
    if not found or v_item.reverses_item_id is not null or v_item.subledger_type<>p_subledger_type or v_item.counterparty_id<>p_counterparty_id or v_item.control_account_id<>p_control_account_id or v_item.document_date>p_settlement_date
      or exists(select 1 from public.fx_open_items r where r.reverses_item_id=v_item.id) then raise exception 'FX_ALLOCATION_TARGET_INVALID' using errcode='23514'; end if;
    if app.convert_minor(v_doc,v_item.currency_code,p_settlement_currency,v_alloc_rate)<>v_settle then raise exception 'FX_ALLOCATION_CONVERSION_MISMATCH' using errcode='23514'; end if;
    select outstanding_minor,carrying_base_minor,original_base_minor into v_out,v_carry,v_original from app.fx_item_position(p_organization_id,v_item.id,p_settlement_date);
    if v_doc>v_out then raise exception 'FX_OVERPAYMENT' using errcode='23514'; end if;
    if exists(select 1 from public.fx_settlements s join public.fx_allocations a on a.settlement_id=s.id where a.open_item_id=v_item.id and s.settlement_date>p_settlement_date)
      or exists(select 1 from public.fx_revaluation_batches b join public.fx_revaluation_lines l on l.batch_id=b.id where l.open_item_id=v_item.id and b.as_of_date>p_settlement_date) then raise exception 'FX_BACKDATED_DEPENDENCY' using errcode='23514'; end if;
    v_alloc_carry:=case when v_doc=v_out then v_carry else round(v_carry::numeric*v_doc/v_out)::bigint end;
    v_alloc_original:=case when v_doc=v_out then v_original else round(v_original::numeric*v_doc/v_out)::bigint end;
    v_raw_base:=app.convert_minor(v_settle,p_settlement_currency,v_base,p_settlement_rate);
    v_alloc_base:=case when v_item.id=v_last_id then v_gross_base-v_total_base else v_raw_base end;
    v_residual:=v_alloc_base-v_raw_base;
    insert into public.fx_allocations(organization_id,settlement_id,open_item_id,document_amount_minor,settlement_amount_minor,allocation_rate,conversion_evidence,carrying_base_minor,original_base_minor,settlement_base_minor,realized_fx_base_minor,rounding_residual_base_minor)
    values(p_organization_id,v_id,v_item.id,v_doc,v_settle,v_alloc_rate,btrim(v_line->>'conversion_evidence'),v_alloc_carry,v_alloc_original,v_alloc_base,v_alloc_base-v_alloc_original,v_residual);
    if (p_subledger_type='customer' and v_alloc_base-v_alloc_carry>0) or (p_subledger_type='supplier' and v_alloc_base-v_alloc_carry<0) then v_clear_gain:=v_clear_gain+abs(v_alloc_base-v_alloc_carry); elsif v_alloc_base<>v_alloc_carry then v_clear_loss:=v_clear_loss+abs(v_alloc_base-v_alloc_carry); end if;
    if (p_subledger_type='customer' and v_alloc_carry-v_alloc_original>0) or (p_subledger_type='supplier' and v_alloc_carry-v_alloc_original<0) then v_prior_gain:=v_prior_gain+abs(v_alloc_carry-v_alloc_original); elsif v_alloc_carry<>v_alloc_original then v_prior_loss:=v_prior_loss+abs(v_alloc_carry-v_alloc_original); end if;
    v_total_settle:=v_total_settle+v_settle; v_total_base:=v_total_base+v_alloc_base; v_total_carry:=v_total_carry+v_alloc_carry; v_total_original:=v_total_original+v_alloc_original;
  end loop;
  if v_total_settle<>p_gross_settlement_minor or v_total_base<>v_gross_base then raise exception 'FX_FULL_ALLOCATION_REQUIRED' using errcode='23514'; end if;
  v_diff:=v_total_base-v_total_carry; v_prior:=v_total_carry-v_total_original;
  v_lines:=jsonb_build_array(
    jsonb_build_object('account_id',p_cash_account_id,'side',case when p_subledger_type='customer' then 'debit' else 'credit' end,'amount_minor',p_gross_settlement_minor,'currency_code',p_settlement_currency,'exchange_rate',p_settlement_rate),
    jsonb_build_object('account_id',p_control_account_id,'side',case when p_subledger_type='customer' then 'credit' else 'debit' end,'amount_minor',v_total_carry,'currency_code',v_base,'exchange_rate',1));
  if v_clear_gain>0 then v_lines:=v_lines||jsonb_build_object('account_id',v_map.realized_gain_account_id,'side','credit','amount_minor',v_clear_gain,'currency_code',v_base,'exchange_rate',1); end if;
  if v_clear_loss>0 then v_lines:=v_lines||jsonb_build_object('account_id',v_map.realized_loss_account_id,'side','debit','amount_minor',v_clear_loss,'currency_code',v_base,'exchange_rate',1); end if;
  -- Reclassify each settled prior unrealized direction without changing total profit/loss.
  if v_prior_gain>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_map.unrealized_gain_account_id,'side','debit','amount_minor',v_prior_gain,'currency_code',v_base,'exchange_rate',1),jsonb_build_object('account_id',v_map.realized_gain_account_id,'side','credit','amount_minor',v_prior_gain,'currency_code',v_base,'exchange_rate',1)); end if;
  if v_prior_loss>0 then v_lines:=v_lines||jsonb_build_array(jsonb_build_object('account_id',v_map.realized_loss_account_id,'side','debit','amount_minor',v_prior_loss,'currency_code',v_base,'exchange_rate',1),jsonb_build_object('account_id',v_map.unrealized_loss_account_id,'side','credit','amount_minor',v_prior_loss,'currency_code',v_base,'exchange_rate',1)); end if;
  perform app.begin_control_posting(p_organization_id,p_control_account_id,p_subledger_type::public.control_subledger_type,v_id::text,p_settlement_date,'subledger');
  v_tx:=app.create_and_post(p_organization_id,case when p_subledger_type='customer' then 'income'::public.transaction_type else 'expense'::public.transaction_type end,p_settlement_date,v_lines,p_settlement_currency,p_settlement_rate,btrim(p_reference),btrim(p_reference),p_counterparty_id,p_source=>'api',p_idempotency_key=>'fx-settlement:'||v_id::text,p_metadata=>jsonb_build_object('fx_settlement_id',v_id,'rate_source',btrim(p_rate_source),'rate_reference',btrim(p_rate_reference)));
  perform app.end_control_posting();
  insert into public.fx_settlements(id,organization_id,subledger_type,counterparty_id,control_account_id,cash_account_id,settlement_date,reference,settlement_currency,gross_settlement_minor,settlement_rate,settlement_base_minor,rate_date,rate_source,rate_reference,carrying_base_minor,realized_fx_base_minor,reclassified_unrealized_base_minor,transaction_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,p_subledger_type,p_counterparty_id,p_control_account_id,p_cash_account_id,p_settlement_date,btrim(p_reference),p_settlement_currency,p_gross_settlement_minor,p_settlement_rate,v_total_base,p_rate_date,btrim(p_rate_source),btrim(p_rate_reference),v_total_carry,v_total_base-v_total_original,v_prior,v_tx,p_idempotency_key,v_payload,auth.uid());
  perform app.write_audit(p_organization_id,'fx_settlement.posted','fx_settlement',v_id,null,jsonb_build_object('transaction_id',v_tx,'carrying_base_minor',v_total_carry::text,'settlement_base_minor',v_total_base::text,'realized_fx_base_minor',(v_total_base-v_total_original)::text)); return v_id;
end; $$;

create function public.reverse_fx_settlement(p_organization_id uuid,p_settlement_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.fx_settlements%rowtype; e public.fx_settlements%rowtype; v_id uuid:=gen_random_uuid(); v_tx uuid; v_payload jsonb;
begin
  perform app.require_capability(p_organization_id,'fx.read'); perform app.require_capability(p_organization_id,'transactions.reverse');
  if p_date is null or nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0));
  v_payload:=jsonb_build_object('settlement',p_settlement_id,'date',p_date,'reason',btrim(p_reason));
  select * into e from public.fx_settlements where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then if e.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return e.id; end if;
  select * into o from public.fx_settlements where id=p_settlement_id and organization_id=p_organization_id;
  if not found or o.reverses_settlement_id is not null or p_date<o.settlement_date or exists(select 1 from public.fx_settlements where reverses_settlement_id=o.id)
    or exists(select 1 from public.fx_revaluation_batches b join public.fx_revaluation_lines l on l.batch_id=b.id join public.fx_allocations a on a.open_item_id=l.open_item_id where a.settlement_id=o.id and b.as_of_date>o.settlement_date) then raise exception 'FX_REVERSAL_DEPENDENCY' using errcode='23514'; end if;
  perform app.begin_control_posting(p_organization_id,o.control_account_id,o.subledger_type::public.control_subledger_type,v_id::text,p_date,'subledger'); v_tx:=public.reverse_transaction(o.transaction_id,btrim(p_reason),p_date); perform app.end_control_posting();
  insert into public.fx_settlements(id,organization_id,subledger_type,counterparty_id,control_account_id,cash_account_id,settlement_date,reference,settlement_currency,gross_settlement_minor,settlement_rate,settlement_base_minor,rate_date,rate_source,rate_reference,carrying_base_minor,realized_fx_base_minor,reclassified_unrealized_base_minor,transaction_id,reverses_settlement_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,o.subledger_type,o.counterparty_id,o.control_account_id,o.cash_account_id,p_date,o.reference,o.settlement_currency,o.gross_settlement_minor,o.settlement_rate,o.settlement_base_minor,o.rate_date,o.rate_source,o.rate_reference,o.carrying_base_minor,-o.realized_fx_base_minor,-o.reclassified_unrealized_base_minor,v_tx,o.id,p_idempotency_key,v_payload,auth.uid());
  insert into public.fx_allocations(organization_id,settlement_id,open_item_id,document_amount_minor,settlement_amount_minor,allocation_rate,conversion_evidence,carrying_base_minor,original_base_minor,settlement_base_minor,realized_fx_base_minor,rounding_residual_base_minor,reverses_allocation_id)
  select organization_id,v_id,open_item_id,document_amount_minor,settlement_amount_minor,allocation_rate,conversion_evidence,carrying_base_minor,original_base_minor,settlement_base_minor,-realized_fx_base_minor,-rounding_residual_base_minor,id from public.fx_allocations where settlement_id=o.id;
  perform app.write_audit(p_organization_id,'fx_settlement.reversed','fx_settlement',v_id,null,jsonb_build_object('reverses',o.id,'transaction_id',v_tx,'reason',btrim(p_reason))); return v_id;
end; $$;

create function public.reverse_fx_revaluation(p_organization_id uuid,p_batch_id uuid,p_date date,p_reason text,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.fx_revaluation_batches%rowtype; e public.fx_revaluation_batches%rowtype; v_id uuid:=gen_random_uuid(); v_tx uuid; v_payload jsonb;
begin
  perform app.require_capability(p_organization_id,'fx.revalue'); perform app.require_capability(p_organization_id,'transactions.reverse');
  if p_date is null or nullif(btrim(p_reason),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_INPUT' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0)); v_payload:=jsonb_build_object('batch',p_batch_id,'date',p_date,'reason',btrim(p_reason));
  select * into e from public.fx_revaluation_batches where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then if e.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return e.id; end if;
  select * into o from public.fx_revaluation_batches where id=p_batch_id and organization_id=p_organization_id;
  if not found or o.reverses_batch_id is not null or o.transaction_id is null or p_date<o.as_of_date or exists(select 1 from public.fx_revaluation_batches where reverses_batch_id=o.id)
    or exists(select 1 from public.fx_settlements s join public.fx_allocations a on a.settlement_id=s.id join public.fx_revaluation_lines l on l.open_item_id=a.open_item_id where l.batch_id=o.id and s.settlement_date>o.as_of_date)
    or exists(select 1 from public.fx_revaluation_batches b join public.fx_revaluation_lines later on later.batch_id=b.id join public.fx_revaluation_lines original on original.open_item_id=later.open_item_id where original.batch_id=o.id and b.as_of_date>o.as_of_date) then raise exception 'FX_REVERSAL_DEPENDENCY' using errcode='23514'; end if;
  perform app.begin_control_posting(p_organization_id,o.control_account_id,o.subledger_type::public.control_subledger_type,v_id::text,p_date,'subledger'); v_tx:=public.reverse_transaction(o.transaction_id,btrim(p_reason),p_date); perform app.end_control_posting();
  insert into public.fx_revaluation_batches(id,organization_id,subledger_type,control_account_id,as_of_date,reference,rate_source,transaction_id,total_delta_base_minor,reverses_batch_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,o.subledger_type,o.control_account_id,p_date,o.reference,o.rate_source,v_tx,-o.total_delta_base_minor,o.id,p_idempotency_key,v_payload,auth.uid());
  insert into public.fx_revaluation_lines(organization_id,batch_id,open_item_id,currency_code,outstanding_minor,closing_rate,rate_reference,previous_carrying_base_minor,closing_base_minor,delta_base_minor,reverses_line_id)
  select organization_id,v_id,open_item_id,currency_code,outstanding_minor,closing_rate,rate_reference,previous_carrying_base_minor,closing_base_minor,delta_base_minor,id from public.fx_revaluation_lines where batch_id=o.id;
  perform app.write_audit(p_organization_id,'fx_revaluation.reversed','fx_revaluation_batch',v_id,null,jsonb_build_object('reverses',o.id,'transaction_id',v_tx,'reason',btrim(p_reason))); return v_id;
end; $$;

create function public.preview_fx_revaluation(p_organization_id uuid,p_subledger_type text,p_control_account_id uuid,p_as_of_date date,p_rates jsonb)
returns table(open_item_id uuid,reference text,currency_code char(3),outstanding_minor text,current_carrying_base_minor text,closing_rate text,closing_base_minor text,delta_base_minor text,rate_reference text)
language plpgsql stable security definer set search_path='' as $$
begin
 perform app.require_capability(p_organization_id,'fx.read');
 if p_subledger_type not in ('customer','supplier') or p_as_of_date is null or p_rates is null or jsonb_typeof(p_rates)<>'object' then raise exception 'FX_INVALID_REVALUATION' using errcode='22023'; end if;
 return query select i.id,i.reference,i.currency_code,p.outstanding_minor::text,p.carrying_base_minor::text,(r.value->>'rate')::numeric::text,
  app.convert_minor(p.outstanding_minor,i.currency_code,app.org_base_currency(p_organization_id),(r.value->>'rate')::numeric)::text,
  (app.convert_minor(p.outstanding_minor,i.currency_code,app.org_base_currency(p_organization_id),(r.value->>'rate')::numeric)-p.carrying_base_minor)::text,btrim(r.value->>'reference')
 from public.fx_open_items i cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p join lateral jsonb_each(p_rates)r on r.key=i.currency_code
 where i.organization_id=p_organization_id and i.subledger_type=p_subledger_type and i.control_account_id=p_control_account_id and i.reverses_item_id is null and p.outstanding_minor>0
  and (r.value->>'rate')::numeric>0 and nullif(btrim(r.value->>'reference'),'') is not null order by i.due_date,i.id;
end; $$;

create function public.confirm_fx_revaluation(p_organization_id uuid,p_subledger_type text,p_control_account_id uuid,p_as_of_date date,p_reference text,p_rate_source text,p_rates jsonb,p_idempotency_key text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_existing public.fx_revaluation_batches%rowtype; v_map public.fx_account_mappings%rowtype; x record; v_total bigint:=0; v_gain bigint:=0; v_loss bigint:=0; v_lines jsonb:='[]'; v_tx uuid; v_base char(3); v_payload jsonb;
begin
 perform app.require_capability(p_organization_id,'fx.revalue'); perform app.require_capability(p_organization_id,'transactions.adjust'); perform app.require_capability(p_organization_id,'transactions.post');
 if nullif(btrim(p_reference),'') is null or nullif(btrim(p_rate_source),'') is null or nullif(btrim(p_idempotency_key),'') is null then raise exception 'FX_INVALID_REVALUATION' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('fx:'||p_organization_id::text,0)); v_payload:=jsonb_build_object('subledger',p_subledger_type,'control',p_control_account_id,'as_of',p_as_of_date,'reference',btrim(p_reference),'source',btrim(p_rate_source),'rates',p_rates);
 select * into v_existing from public.fx_revaluation_batches where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
 if found then if v_existing.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT: key was already used for a different request' using errcode='23505'; end if; return v_existing.id; end if;
 select * into v_map from public.fx_account_mappings where organization_id=p_organization_id; if not found then raise exception 'FX_ACCOUNT_MAPPING_REQUIRED' using errcode='23514'; end if; v_base:=app.org_base_currency(p_organization_id);
 if exists(select 1 from public.fx_open_items i cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p where i.organization_id=p_organization_id and i.subledger_type=p_subledger_type and i.control_account_id=p_control_account_id and i.reverses_item_id is null and p.outstanding_minor>0
   and (not (p_rates ? btrim(i.currency_code)) or jsonb_typeof(p_rates->btrim(i.currency_code))<>'object' or nullif(p_rates->btrim(i.currency_code)->>'rate','') is null or (p_rates->btrim(i.currency_code)->>'rate')::numeric<=0 or nullif(btrim(p_rates->btrim(i.currency_code)->>'reference'),'') is null)) then raise exception 'FX_CLOSING_RATE_REQUIRED' using errcode='23514'; end if;
 if exists(select 1 from public.fx_settlements s join public.fx_allocations a on a.settlement_id=s.id join public.fx_open_items i on i.id=a.open_item_id where i.organization_id=p_organization_id and i.subledger_type=p_subledger_type and i.control_account_id=p_control_account_id and s.settlement_date>p_as_of_date)
   or exists(select 1 from public.fx_revaluation_batches where organization_id=p_organization_id and subledger_type=p_subledger_type and control_account_id=p_control_account_id and as_of_date>p_as_of_date) then raise exception 'FX_BACKDATED_DEPENDENCY' using errcode='23514'; end if;
 for x in select * from public.preview_fx_revaluation(p_organization_id,p_subledger_type,p_control_account_id,p_as_of_date,p_rates) loop
  if x.delta_base_minor::bigint<>0 then
   insert into public.fx_revaluation_lines(organization_id,batch_id,open_item_id,currency_code,outstanding_minor,closing_rate,rate_reference,previous_carrying_base_minor,closing_base_minor,delta_base_minor)
   values(p_organization_id,v_id,x.open_item_id,x.currency_code,x.outstanding_minor::bigint,x.closing_rate::numeric,x.rate_reference,x.current_carrying_base_minor::bigint,x.closing_base_minor::bigint,x.delta_base_minor::bigint);
   v_total:=v_total+x.delta_base_minor::bigint;
   if (p_subledger_type='customer' and x.delta_base_minor::bigint>0) or (p_subledger_type='supplier' and x.delta_base_minor::bigint<0) then v_gain:=v_gain+abs(x.delta_base_minor::bigint); else v_loss:=v_loss+abs(x.delta_base_minor::bigint); end if;
  end if;
 end loop;
 if v_gain+v_loss>0 then
  if v_gain>0 then v_lines:=v_lines||jsonb_build_array(
   jsonb_build_object('account_id',p_control_account_id,'side','debit','amount_minor',v_gain,'currency_code',v_base,'exchange_rate',1),
   jsonb_build_object('account_id',v_map.unrealized_gain_account_id,'side','credit','amount_minor',v_gain,'currency_code',v_base,'exchange_rate',1)); end if;
  if v_loss>0 then v_lines:=v_lines||jsonb_build_array(
   jsonb_build_object('account_id',p_control_account_id,'side','credit','amount_minor',v_loss,'currency_code',v_base,'exchange_rate',1),
   jsonb_build_object('account_id',v_map.unrealized_loss_account_id,'side','debit','amount_minor',v_loss,'currency_code',v_base,'exchange_rate',1)); end if;
  perform app.begin_control_posting(p_organization_id,p_control_account_id,p_subledger_type::public.control_subledger_type,v_id::text,p_as_of_date,'subledger');
  v_tx:=app.create_and_post(p_organization_id,'adjustment',p_as_of_date,v_lines,v_base,1,btrim(p_reference),btrim(p_reference),p_adjustment_reason=>'FX carry-forward revaluation',p_source=>'api',p_idempotency_key=>'fx-revaluation:'||v_id::text,p_metadata=>jsonb_build_object('fx_revaluation_batch_id',v_id,'rate_source',btrim(p_rate_source),'rates',p_rates)); perform app.end_control_posting();
 end if;
 insert into public.fx_revaluation_batches(id,organization_id,subledger_type,control_account_id,as_of_date,reference,rate_source,transaction_id,total_delta_base_minor,idempotency_key,request_payload,created_by)
 values(v_id,p_organization_id,p_subledger_type,p_control_account_id,p_as_of_date,btrim(p_reference),btrim(p_rate_source),v_tx,v_total,p_idempotency_key,v_payload,auth.uid());
 perform app.write_audit(p_organization_id,'fx_revaluation.confirmed','fx_revaluation_batch',v_id,null,jsonb_build_object('transaction_id',v_tx,'delta_base_minor',v_total::text,'as_of',p_as_of_date)); return v_id;
end; $$;

create function public.read_fx_workspace(p_organization_id uuid,p_subledger_type text,p_as_of_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform app.require_capability(p_organization_id,'fx.read');
 select jsonb_build_object(
  'currencies',coalesce((select jsonb_agg(jsonb_build_object('code',code,'minor_unit',minor_unit,'name',name) order by code) from public.currencies where is_active),'[]'),
  'mapping',(select to_jsonb(m)-'configured_by' from public.fx_account_mappings m where organization_id=p_organization_id),
  'counterparties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.counterparties where organization_id=p_organization_id and type=(case when p_subledger_type='customer' then 'customer' else 'vendor' end)::public.counterparty_type and not is_archived),'[]'),
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.type,'subtype',a.subtype,'role',a.account_role,'subledger',a.control_subledger_type,'currency',a.currency) order by a.name) from public.accounts a where a.organization_id=p_organization_id and not a.is_archived),'[]'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'counterparty_id',i.counterparty_id,'counterparty_name',c.name,'control_account_id',i.control_account_id,'reference',i.reference,'document_date',i.document_date,'due_date',i.due_date,'currency_code',i.currency_code,'original_minor',i.original_minor::text,'outstanding_minor',p.outstanding_minor::text,'recognition_rate',i.recognition_rate::text,'carrying_base_minor',p.carrying_base_minor::text,'rate_source',i.rate_source,'rate_reference',i.rate_reference) order by i.due_date,i.id) from public.fx_open_items i join public.counterparties c on c.id=i.counterparty_id cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p where i.organization_id=p_organization_id and i.subledger_type=p_subledger_type and i.reverses_item_id is null and p.outstanding_minor>0),'[]'),
  'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.settlement_date,'reference',s.reference,'currency_code',s.settlement_currency,'gross_minor',s.gross_settlement_minor::text,'rate',s.settlement_rate::text,'rate_source',s.rate_source,'rate_reference',s.rate_reference,'carrying_base_minor',s.carrying_base_minor::text,'settlement_base_minor',s.settlement_base_minor::text,'realized_fx_base_minor',s.realized_fx_base_minor::text,'reverses_settlement_id',s.reverses_settlement_id) order by s.settlement_date desc,s.id) from public.fx_settlements s where s.organization_id=p_organization_id and s.subledger_type=p_subledger_type and s.settlement_date<=p_as_of_date),'[]'),
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'settlement_reference',s.reference,'item_reference',i.reference,'document_currency',i.currency_code,'settlement_currency',s.settlement_currency,'document_amount_minor',a.document_amount_minor::text,'settlement_amount_minor',a.settlement_amount_minor::text,'allocation_rate',a.allocation_rate::text,'conversion_evidence',a.conversion_evidence,'carrying_base_minor',a.carrying_base_minor::text,'settlement_base_minor',a.settlement_base_minor::text,'realized_fx_base_minor',a.realized_fx_base_minor::text,'rounding_residual_base_minor',a.rounding_residual_base_minor::text) order by s.settlement_date desc,a.id) from public.fx_allocations a join public.fx_settlements s on s.id=a.settlement_id join public.fx_open_items i on i.id=a.open_item_id where a.organization_id=p_organization_id and s.subledger_type=p_subledger_type and s.settlement_date<=p_as_of_date),'[]'),
  'revaluations',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'as_of_date',b.as_of_date,'reference',b.reference,'rate_source',b.rate_source,'delta_base_minor',b.total_delta_base_minor::text,'transaction_id',b.transaction_id) order by b.as_of_date desc,b.id) from public.fx_revaluation_batches b where b.organization_id=p_organization_id and b.subledger_type=p_subledger_type and b.as_of_date<=p_as_of_date),'[]')) into result;
 return result;
end; $$;

-- Foreign carrying values become the provider for their own Control bindings,
-- while the original base-currency providers remain unchanged.
create or replace function app.control_subledger_balance(p_organization_id uuid,p_control_account_id uuid,p_subledger_type public.control_subledger_type,p_as_of_date date)
returns table(provider_available boolean,balance_minor bigint,provider_reference text) language plpgsql stable security definer set search_path='' as $$
begin
 if p_subledger_type='customer' then
  return query select true,(coalesce((select sum(ar_effect_minor) from public.ar_documents where organization_id=p_organization_id and control_account_id=p_control_account_id and document_date<=p_as_of_date),0)
   +coalesce((select sum(p.carrying_base_minor) from public.fx_open_items i cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p where i.organization_id=p_organization_id and i.control_account_id=p_control_account_id and i.subledger_type='customer' and i.reverses_item_id is null),0))::bigint,'ar_documents+fx_open_items:v2'::text;
 elsif p_subledger_type='supplier' then
  return query select true,(coalesce((select sum(ap_effect_minor) from public.ap_documents where organization_id=p_organization_id and control_account_id=p_control_account_id and document_date<=p_as_of_date),0)
   +coalesce((select sum(p.carrying_base_minor) from public.fx_open_items i cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p where i.organization_id=p_organization_id and i.control_account_id=p_control_account_id and i.subledger_type='supplier' and i.reverses_item_id is null),0))::bigint,'ap_documents+fx_open_items:v2'::text;
 else
  return query select exists(select 1 from public.inventory_accounting_facts f join public.inventory_accounting_sources s on s.id=f.source_id where s.organization_id=p_organization_id and s.control_account_id=p_control_account_id),
   coalesce(sum(f.inventory_delta_minor),0)::bigint,'inventory-suit:versioned-facts:v1'::text from public.inventory_accounting_facts f join public.inventory_accounting_sources s on s.id=f.source_id
   where s.organization_id=p_organization_id and s.control_account_id=p_control_account_id and f.accounting_date<=p_as_of_date;
 end if;
end; $$;

revoke all on function public.configure_fx_accounts(uuid,uuid,uuid,uuid,uuid),public.post_fx_open_item(uuid,text,uuid,uuid,uuid,date,date,text,char,bigint,numeric,date,text,text,text),public.reverse_fx_open_item(uuid,uuid,date,text,text),public.post_fx_settlement(uuid,text,uuid,uuid,uuid,date,text,char,bigint,numeric,date,text,text,jsonb,text),public.reverse_fx_settlement(uuid,uuid,date,text,text),public.preview_fx_revaluation(uuid,text,uuid,date,jsonb),public.confirm_fx_revaluation(uuid,text,uuid,date,text,text,jsonb,text),public.reverse_fx_revaluation(uuid,uuid,date,text,text),public.read_fx_workspace(uuid,text,date) from public,anon;
grant execute on function public.configure_fx_accounts(uuid,uuid,uuid,uuid,uuid),public.post_fx_open_item(uuid,text,uuid,uuid,uuid,date,date,text,char,bigint,numeric,date,text,text,text),public.reverse_fx_open_item(uuid,uuid,date,text,text),public.post_fx_settlement(uuid,text,uuid,uuid,uuid,date,text,char,bigint,numeric,date,text,text,jsonb,text),public.reverse_fx_settlement(uuid,uuid,date,text,text),public.preview_fx_revaluation(uuid,text,uuid,date,jsonb),public.confirm_fx_revaluation(uuid,text,uuid,date,text,text,jsonb,text),public.reverse_fx_revaluation(uuid,uuid,date,text,text),public.read_fx_workspace(uuid,text,date) to authenticated;
revoke all on function app.fx_item_position(uuid,uuid,date) from public,anon,authenticated;
grant execute on function app.fx_item_position(uuid,uuid,date) to service_role;

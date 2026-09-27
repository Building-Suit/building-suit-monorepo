-- LS-FX-001: repair the existing FX implementation without editing applied migrations.
-- 1. Enter the trusted subledger context before validating the Control account.
-- 2. Read binding type from control_account_bindings, not a nonexistent accounts field.
-- This migration does not alter require_account, account roles, posting guards,
-- capabilities, posted history, or the approved FX arithmetic.
-- CREATE OR REPLACE retains the existing function ownership and grants.

create or replace function public.post_fx_open_item(
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
  -- The private boundary validates the tenant, Control binding and posting date.
  -- Establish it before the shared account validator; do not bypass that validator.
  perform app.begin_control_posting(p_organization_id,p_control_account_id,p_subledger_type::public.control_subledger_type,v_id::text,p_document_date,'subledger');
  v_control:=app.require_account(p_organization_id,p_control_account_id,array[case when p_subledger_type='customer' then 'asset'::public.account_type else 'liability'::public.account_type end]);
  v_offset:=app.require_account(p_organization_id,p_offset_account_id);
  if v_control.account_role<>'control' or v_control.currency<>v_base or v_offset.account_role<>'posting' or v_offset.currency<>v_base
    or (p_subledger_type='customer' and v_offset.type<>'revenue') or (p_subledger_type='supplier' and v_offset.type not in ('expense','asset')) then raise exception 'FX_ACCOUNT_MAPPING_INVALID' using errcode='23514'; end if;
  v_lines:=jsonb_build_array(
    jsonb_build_object('account_id',p_control_account_id,'side',case when p_subledger_type='customer' then 'debit' else 'credit' end,'amount_minor',p_original_minor,'currency_code',p_currency_code,'exchange_rate',p_recognition_rate),
    jsonb_build_object('account_id',p_offset_account_id,'side',case when p_subledger_type='customer' then 'credit' else 'debit' end,'amount_minor',p_original_minor,'currency_code',p_currency_code,'exchange_rate',p_recognition_rate));
  v_tx:=app.create_and_post(p_organization_id,case when p_subledger_type='customer' then 'income'::public.transaction_type else 'expense'::public.transaction_type end,p_document_date,v_lines,p_currency_code,p_recognition_rate,btrim(p_reference),btrim(p_reference),p_counterparty_id,p_source=>'api',p_idempotency_key=>'fx-item:'||v_id::text,p_metadata=>jsonb_build_object('fx_open_item_id',v_id,'rate_source',btrim(p_rate_source),'rate_reference',btrim(p_rate_reference)));
  perform app.end_control_posting();
  insert into public.fx_open_items(id,organization_id,subledger_type,counterparty_id,control_account_id,offset_account_id,document_date,due_date,reference,currency_code,original_minor,recognition_rate,original_base_minor,rate_date,rate_source,rate_reference,transaction_id,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,p_subledger_type,p_counterparty_id,p_control_account_id,p_offset_account_id,p_document_date,p_due_date,btrim(p_reference),p_currency_code,p_original_minor,p_recognition_rate,v_base_amount,p_rate_date,btrim(p_rate_source),btrim(p_rate_reference),v_tx,p_idempotency_key,v_payload,auth.uid());
  perform app.write_audit(p_organization_id,'fx_item.posted','fx_open_item',v_id,null,jsonb_build_object('transaction_id',v_tx,'currency',p_currency_code,'original_minor',p_original_minor::text,'base_minor',v_base_amount::text)); return v_id;
end; $$;

create or replace function public.read_fx_workspace(p_organization_id uuid,p_subledger_type text,p_as_of_date date)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 perform app.require_capability(p_organization_id,'fx.read');
 select jsonb_build_object(
  'currencies',coalesce((select jsonb_agg(jsonb_build_object('code',code,'minor_unit',minor_unit,'name',name) order by code) from public.currencies where is_active),'[]'),
  'mapping',(select to_jsonb(m)-'configured_by' from public.fx_account_mappings m where organization_id=p_organization_id),
  'counterparties',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name) from public.counterparties where organization_id=p_organization_id and type=(case when p_subledger_type='customer' then 'customer' else 'vendor' end)::public.counterparty_type and not is_archived),'[]'),
  'accounts',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.name,'type',a.type,'subtype',a.subtype,'role',a.account_role,'subledger',binding.subledger_type,'currency',a.currency) order by a.name) from public.accounts a left join public.control_account_bindings binding on binding.account_id=a.id and binding.organization_id=a.organization_id where a.organization_id=p_organization_id and not a.is_archived),'[]'),
  'items',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'counterparty_id',i.counterparty_id,'counterparty_name',c.name,'control_account_id',i.control_account_id,'reference',i.reference,'document_date',i.document_date,'due_date',i.due_date,'currency_code',i.currency_code,'original_minor',i.original_minor::text,'outstanding_minor',p.outstanding_minor::text,'recognition_rate',i.recognition_rate::text,'carrying_base_minor',p.carrying_base_minor::text,'rate_source',i.rate_source,'rate_reference',i.rate_reference) order by i.due_date,i.id) from public.fx_open_items i join public.counterparties c on c.id=i.counterparty_id cross join lateral app.fx_item_position(p_organization_id,i.id,p_as_of_date)p where i.organization_id=p_organization_id and i.subledger_type=p_subledger_type and i.reverses_item_id is null and p.outstanding_minor>0),'[]'),
  'settlements',coalesce((select jsonb_agg(jsonb_build_object('id',s.id,'date',s.settlement_date,'reference',s.reference,'currency_code',s.settlement_currency,'gross_minor',s.gross_settlement_minor::text,'rate',s.settlement_rate::text,'rate_source',s.rate_source,'rate_reference',s.rate_reference,'carrying_base_minor',s.carrying_base_minor::text,'settlement_base_minor',s.settlement_base_minor::text,'realized_fx_base_minor',s.realized_fx_base_minor::text,'reverses_settlement_id',s.reverses_settlement_id) order by s.settlement_date desc,s.id) from public.fx_settlements s where s.organization_id=p_organization_id and s.subledger_type=p_subledger_type and s.settlement_date<=p_as_of_date),'[]'),
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'settlement_reference',s.reference,'item_reference',i.reference,'document_currency',i.currency_code,'settlement_currency',s.settlement_currency,'document_amount_minor',a.document_amount_minor::text,'settlement_amount_minor',a.settlement_amount_minor::text,'allocation_rate',a.allocation_rate::text,'conversion_evidence',a.conversion_evidence,'carrying_base_minor',a.carrying_base_minor::text,'settlement_base_minor',a.settlement_base_minor::text,'realized_fx_base_minor',a.realized_fx_base_minor::text,'rounding_residual_base_minor',a.rounding_residual_base_minor::text) order by s.settlement_date desc,a.id) from public.fx_allocations a join public.fx_settlements s on s.id=a.settlement_id join public.fx_open_items i on i.id=a.open_item_id where a.organization_id=p_organization_id and s.subledger_type=p_subledger_type and s.settlement_date<=p_as_of_date),'[]'),
  'revaluations',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'as_of_date',b.as_of_date,'reference',b.reference,'rate_source',b.rate_source,'delta_base_minor',b.total_delta_base_minor::text,'transaction_id',b.transaction_id) order by b.as_of_date desc,b.id) from public.fx_revaluation_batches b where b.organization_id=p_organization_id and b.subledger_type=p_subledger_type and b.as_of_date<=p_as_of_date),'[]')) into result;
 return result;
end; $$;

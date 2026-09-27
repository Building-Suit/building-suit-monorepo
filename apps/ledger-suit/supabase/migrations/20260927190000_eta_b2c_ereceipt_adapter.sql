-- LS-EG-003 / LS-D-ERECEIPT-SCOPE: bounded ETA B2C eReceipt v1.2 adapter.
-- This is preproduction-only and consumes an explicitly approved external
-- source snapshot linked to existing posted VAT evidence. It is not a POS.

create table public.organization_eta_ereceipt_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vat_profile_id uuid not null,
  environment text not null check (environment = 'preproduction'),
  issuer_registration_number text not null check (length(btrim(issuer_registration_number)) between 3 and 64),
  issuer_trade_name text not null check (length(btrim(issuer_trade_name)) between 1 and 200),
  branch_code text not null check (length(btrim(branch_code)) between 1 and 50),
  branch_address jsonb not null check (jsonb_typeof(branch_address) = 'object'),
  taxpayer_activity_code text not null check (taxpayer_activity_code ~ '^[0-9]{1,20}$'),
  pos_device_serial text not null check (length(btrim(pos_device_serial)) between 1 and 100),
  authoritative_source_id text not null check (length(btrim(authoritative_source_id)) between 1 and 200),
  source_scope_approval_reference text not null check (length(btrim(source_scope_approval_reference)) > 0),
  b2c_onboarding_evidence_reference text not null check (length(btrim(b2c_onboarding_evidence_reference)) > 0),
  pos_activation_evidence_reference text not null check (length(btrim(pos_activation_evidence_reference)) > 0),
  signing_certificate_reference text not null check (length(btrim(signing_certificate_reference)) > 0),
  evidence_verified_on date not null check (isfinite(evidence_verified_on)),
  effective_from date not null check (isfinite(effective_from)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, effective_from),
  foreign key (vat_profile_id, organization_id)
    references public.organization_vat_profiles(id, organization_id) on delete restrict
);
comment on table public.organization_eta_ereceipt_profiles is
  'Append-only B2C onboarding, authoritative source and registered POS identity evidence. POS credentials and eSeal material remain server secrets.';

create table public.eta_ereceipt_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  ereceipt_profile_id uuid not null,
  vat_document_id uuid not null,
  supersedes_document_id uuid unique,
  previous_document_id uuid,
  receipt_type text not null check (receipt_type in ('s','r')),
  type_version text not null check (type_version = '1.2'),
  receipt_number text not null check (length(btrim(receipt_number)) between 1 and 50),
  issued_at timestamptz not null,
  authoritative_source_snapshot jsonb not null check (jsonb_typeof(authoritative_source_snapshot) = 'object'),
  fiscal_snapshot jsonb not null check (jsonb_typeof(fiscal_snapshot) = 'object'),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  unique (ereceipt_profile_id, receipt_number),
  foreign key (ereceipt_profile_id, organization_id)
    references public.organization_eta_ereceipt_profiles(id, organization_id) on delete restrict,
  foreign key (vat_document_id, organization_id)
    references public.vat_documents(id, organization_id) on delete restrict,
  foreign key (supersedes_document_id, organization_id)
    references public.eta_ereceipt_documents(id, organization_id) on delete restrict,
  foreign key (previous_document_id, organization_id)
    references public.eta_ereceipt_documents(id, organization_id) on delete restrict
);
comment on table public.eta_ereceipt_documents is
  'Immutable receipt v1.2 snapshot from an approved source. The record is fiscal delivery evidence only and never posts accounting.';

create table public.eta_ereceipt_delivery_state (
  document_id uuid primary key,
  organization_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft','signing','retry_wait','failed','submitted','processing','valid','invalid','rejected','cancelled')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 20),
  next_attempt_at timestamptz,
  submission_uuid text,
  eta_receipt_uuid text unique,
  eta_long_id text,
  last_error_code text,
  last_error_message text,
  last_provider_payload jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (document_id, organization_id),
  foreign key (document_id, organization_id)
    references public.eta_ereceipt_documents(id, organization_id) on delete restrict,
  check (eta_receipt_uuid is null or eta_receipt_uuid ~ '^[0-9a-f]{64}$'),
  check (status not in ('submitted','processing','valid','invalid','rejected','cancelled') or submission_uuid is not null),
  check (status not in ('submitted','processing','valid','invalid','rejected','cancelled') or eta_receipt_uuid is not null)
);
create unique index eta_ereceipt_source_document_idx
  on public.eta_ereceipt_documents(ereceipt_profile_id,(authoritative_source_snapshot->>'sourceDocumentId'));

create table public.eta_ereceipt_delivery_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null,
  status text not null,
  provider_code text,
  message text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, organization_id)
    references public.eta_ereceipt_documents(id, organization_id) on delete restrict
);
create index eta_ereceipt_events_document_idx
  on public.eta_ereceipt_delivery_events(organization_id, document_id, created_at desc);

create function app.reject_eta_fiscal_channel_conflict()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_table_name='eta_b2b_documents' and exists(
    select 1 from public.eta_ereceipt_documents d
    where d.organization_id=new.organization_id and d.vat_document_id=new.vat_document_id
  ) then
    raise exception 'ETA_FISCAL_CHANNEL_CONFLICT: one posted source cannot be both an eInvoice and an eReceipt' using errcode='23505';
  elsif tg_table_name='eta_ereceipt_documents' and exists(
    select 1 from public.eta_b2b_documents d
    where d.organization_id=new.organization_id and d.vat_document_id=new.vat_document_id
  ) then
    raise exception 'ETA_FISCAL_CHANNEL_CONFLICT: one posted source cannot be both an eInvoice and an eReceipt' using errcode='23505';
  end if;
  return new;
end;
$$;
revoke all on function app.reject_eta_fiscal_channel_conflict() from public,anon,authenticated,service_role;
create trigger eta_b2b_channel_exclusive before insert on public.eta_b2b_documents
  for each row execute function app.reject_eta_fiscal_channel_conflict();
create trigger eta_ereceipt_channel_exclusive before insert on public.eta_ereceipt_documents
  for each row execute function app.reject_eta_fiscal_channel_conflict();

insert into public.capabilities(key, domain, description) values
  ('eta_ereceipt.read','eta_ereceipt','Read ETA eReceipt preproduction evidence'),
  ('eta_ereceipt.configure','eta_ereceipt','Record approved B2C source and POS onboarding evidence'),
  ('eta_ereceipt.prepare','eta_ereceipt','Prepare receipt v1.2 from approved source and posted VAT evidence'),
  ('eta_ereceipt.submit','eta_ereceipt','Submit and poll eReceipts in preproduction')
on conflict do nothing;
insert into public.role_capabilities(role,capability_key)
select r.role::public.organization_role,c.key
from (values ('owner'),('admin'),('accountant')) r(role)
cross join public.capabilities c
where c.domain='eta_ereceipt' and (c.key<>'eta_ereceipt.configure' or r.role in ('owner','admin'))
on conflict do nothing;
insert into public.role_capabilities(role,capability_key) values ('viewer','eta_ereceipt.read') on conflict do nothing;

alter table public.organization_eta_ereceipt_profiles enable row level security;
alter table public.eta_ereceipt_documents enable row level security;
alter table public.eta_ereceipt_delivery_state enable row level security;
alter table public.eta_ereceipt_delivery_events enable row level security;
create policy eta_ereceipt_profiles_read on public.organization_eta_ereceipt_profiles for select to authenticated
  using (app.has_capability(organization_id,'eta_ereceipt.read'));
create policy eta_ereceipt_documents_read on public.eta_ereceipt_documents for select to authenticated
  using (app.has_capability(organization_id,'eta_ereceipt.read'));
create policy eta_ereceipt_state_read on public.eta_ereceipt_delivery_state for select to authenticated
  using (app.has_capability(organization_id,'eta_ereceipt.read'));
create policy eta_ereceipt_events_read on public.eta_ereceipt_delivery_events for select to authenticated
  using (app.has_capability(organization_id,'eta_ereceipt.read'));
revoke all on public.organization_eta_ereceipt_profiles,public.eta_ereceipt_documents,
  public.eta_ereceipt_delivery_state,public.eta_ereceipt_delivery_events from public,anon,authenticated;
grant select on public.organization_eta_ereceipt_profiles,public.eta_ereceipt_documents,
  public.eta_ereceipt_delivery_state,public.eta_ereceipt_delivery_events to authenticated;
create trigger eta_ereceipt_profiles_immutable before update or delete on public.organization_eta_ereceipt_profiles
  for each row execute function app.reject_vat_evidence_change();
create trigger eta_ereceipt_documents_immutable before update or delete on public.eta_ereceipt_documents
  for each row execute function app.reject_vat_evidence_change();
create trigger eta_ereceipt_events_immutable before update or delete on public.eta_ereceipt_delivery_events
  for each row execute function app.reject_vat_evidence_change();

create function public.configure_eta_ereceipt_preproduction(
  p_organization_id uuid,p_vat_profile_id uuid,p_issuer_trade_name text,p_branch_code text,
  p_branch_address jsonb,p_taxpayer_activity_code text,p_pos_device_serial text,
  p_authoritative_source_id text,p_source_scope_approval_reference text,
  p_b2c_onboarding_evidence_reference text,p_pos_activation_evidence_reference text,
  p_signing_certificate_reference text,p_evidence_verified_on date,p_effective_from date
) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid:=gen_random_uuid(); v_vat public.organization_vat_profiles%rowtype;
begin
  perform app.require_capability(p_organization_id,'eta_ereceipt.configure');
  select * into v_vat from public.organization_vat_profiles where id=p_vat_profile_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_ERECEIPT_VAT_PROFILE_REQUIRED' using errcode='23514'; end if;
  if nullif(btrim(p_issuer_trade_name),'') is null or nullif(btrim(p_branch_code),'') is null
    or not app.eta_address_valid(p_branch_address) or p_taxpayer_activity_code !~ '^[0-9]{1,20}$'
    or nullif(btrim(p_pos_device_serial),'') is null or length(p_pos_device_serial)>100
    or nullif(btrim(p_authoritative_source_id),'') is null
    or nullif(btrim(p_source_scope_approval_reference),'') is null
    or nullif(btrim(p_b2c_onboarding_evidence_reference),'') is null
    or nullif(btrim(p_pos_activation_evidence_reference),'') is null
    or nullif(btrim(p_signing_certificate_reference),'') is null
    or p_evidence_verified_on is null or not isfinite(p_evidence_verified_on) or p_evidence_verified_on>current_date
    or p_effective_from is null or not isfinite(p_effective_from) or p_effective_from<v_vat.effective_from
    or exists(select 1 from public.organization_eta_ereceipt_profiles where organization_id=p_organization_id and effective_from>=p_effective_from)
  then raise exception 'ETA_ERECEIPT_PROFILE_INVALID: approved source, B2C onboarding, active POS and batch-signing evidence are required' using errcode='23514'; end if;
  insert into public.organization_eta_ereceipt_profiles(id,organization_id,vat_profile_id,environment,
    issuer_registration_number,issuer_trade_name,branch_code,branch_address,taxpayer_activity_code,
    pos_device_serial,authoritative_source_id,source_scope_approval_reference,b2c_onboarding_evidence_reference,
    pos_activation_evidence_reference,signing_certificate_reference,evidence_verified_on,effective_from,created_by)
  values(v_id,p_organization_id,p_vat_profile_id,'preproduction',v_vat.registration_number,btrim(p_issuer_trade_name),
    btrim(p_branch_code),p_branch_address,p_taxpayer_activity_code,btrim(p_pos_device_serial),btrim(p_authoritative_source_id),
    btrim(p_source_scope_approval_reference),btrim(p_b2c_onboarding_evidence_reference),btrim(p_pos_activation_evidence_reference),
    btrim(p_signing_certificate_reference),p_evidence_verified_on,p_effective_from,auth.uid());
  perform app.write_audit(p_organization_id,'eta_ereceipt.profile_configured','organization_eta_ereceipt_profile',v_id,null,
    jsonb_build_object('environment','preproduction','source_id',btrim(p_authoritative_source_id),'pos_serial',btrim(p_pos_device_serial)));
  return v_id;
end;
$$;

create function public.prepare_eta_ereceipt_document(
  p_organization_id uuid,p_vat_document_id uuid,p_receipt_number text,p_issued_at timestamptz,
  p_source_snapshot jsonb,p_idempotency_key text
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  v_id uuid:=gen_random_uuid(); v_source public.vat_documents%rowtype;
  v_profile public.organization_eta_ereceipt_profiles%rowtype; v_existing public.eta_ereceipt_documents%rowtype;
  v_prior public.eta_ereceipt_documents%rowtype; v_prior_state public.eta_ereceipt_delivery_state%rowtype;
  v_sale_uuid text; v_previous_uuid text:=''; v_reference_old text; v_type text; v_lines jsonb;
  v_previous_document_id uuid; v_net numeric; v_tax numeric; v_snapshot jsonb; v_payload jsonb;
begin
  perform app.require_capability(p_organization_id,'eta_ereceipt.prepare');
  if nullif(btrim(p_receipt_number),'') is null or length(p_receipt_number)>50 or p_issued_at is null or p_issued_at>now()
    or nullif(btrim(p_idempotency_key),'') is null or jsonb_typeof(p_source_snapshot)<>'object'
    or nullif(btrim(p_source_snapshot->>'sourceSystemId'),'') is null
    or nullif(btrim(p_source_snapshot->>'sourceDocumentId'),'') is null
    or (p_source_snapshot->>'capturedAt') is null
    or (p_source_snapshot->>'capturedAt')::timestamptz>now()
    or p_source_snapshot->>'paymentMethod' is null or jsonb_typeof(p_source_snapshot->'buyer')<>'object'
    or p_source_snapshot->'buyer'->>'type' not in ('B','P','F')
    or nullif(btrim(p_source_snapshot->'buyer'->>'id'),'') is null
    or nullif(btrim(p_source_snapshot->'buyer'->>'name'),'') is null
    or jsonb_typeof(p_source_snapshot->'lines')<>'array' or jsonb_array_length(p_source_snapshot->'lines') not between 1 and 300
  then raise exception 'ETA_ERECEIPT_SOURCE_REQUIRED: approved source identity, immutable receipt reference, buyer, payment and lines are required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('eta-ereceipt:'||p_organization_id::text,0));
  select * into v_source from public.vat_documents where id=p_vat_document_id and organization_id=p_organization_id for share;
  if not found or v_source.direction<>'output' or v_source.kind not in ('invoice','credit') then
    raise exception 'ETA_ERECEIPT_SOURCE_INVALID: only posted output VAT sales and linked returns are supported' using errcode='23514'; end if;
  if exists(select 1 from public.eta_b2b_documents where organization_id=p_organization_id and vat_document_id=p_vat_document_id) then
    raise exception 'ETA_FISCAL_CHANNEL_CONFLICT: one posted source cannot be both an eInvoice and an eReceipt' using errcode='23505'; end if;
  if (p_issued_at at time zone 'UTC')::date<>v_source.document_date then
    raise exception 'ETA_ERECEIPT_ISSUANCE_DATE_MISMATCH' using errcode='23514'; end if;
  select * into v_profile from public.organization_eta_ereceipt_profiles
    where organization_id=p_organization_id and effective_from<=v_source.tax_point_date
    order by effective_from desc limit 1;
  if not found or v_profile.vat_profile_id<>v_source.profile_id then
    raise exception 'ETA_ERECEIPT_PROFILE_NOT_EFFECTIVE' using errcode='23514'; end if;
  if p_source_snapshot->>'sourceSystemId'<>v_profile.authoritative_source_id then
    raise exception 'ETA_ERECEIPT_SOURCE_IDENTITY_MISMATCH' using errcode='23514'; end if;
  v_type:=case v_source.kind when 'invoice' then 's' else 'r' end;
  if v_type='r' then
    select s.eta_receipt_uuid into v_sale_uuid from public.eta_ereceipt_documents d
      join public.eta_ereceipt_delivery_state s on s.document_id=d.id
      where d.organization_id=p_organization_id and d.vat_document_id=v_source.adjusts_document_id
        and d.receipt_type='s' and s.status='valid' order by d.created_at desc limit 1;
    if v_sale_uuid is null then raise exception 'ETA_ERECEIPT_RETURN_REFERENCE_REQUIRED: source sale must be valid in ETA preproduction' using errcode='23514'; end if;
  end if;
  if exists(select 1 from jsonb_array_elements(p_source_snapshot->'lines') x
    where jsonb_typeof(x)<>'object' or nullif(btrim(x->>'internalCode'),'') is null
      or nullif(btrim(x->>'description'),'') is null or x->>'itemType' not in ('GS1','EGS')
      or nullif(btrim(x->>'itemCode'),'') is null or nullif(btrim(x->>'unitType'),'') is null
      or x->>'quantity' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,5})?$' or x->>'quantity' ~ '^0(\.0+)?$'
      or coalesce(x->>'unitPriceMinor','') !~ '^[1-9][0-9]*$'
      or coalesce(x->>'totalSaleMinor','') !~ '^[1-9][0-9]*$'
      or coalesce(x->>'discountMinor','') !~ '^(0|[1-9][0-9]*)$'
      or coalesce(x->>'netSaleMinor','') !~ '^[1-9][0-9]*$' or coalesce(x->>'taxMinor','') !~ '^[1-9][0-9]*$'
      or (x->>'totalSaleMinor')::numeric-(x->>'discountMinor')::numeric<>(x->>'netSaleMinor')::numeric
      or round((x->>'quantity')::numeric*(x->>'unitPriceMinor')::numeric)<>(x->>'totalSaleMinor')::numeric
      or round((x->>'netSaleMinor')::numeric*0.14)<>(x->>'taxMinor')::numeric
  ) then raise exception 'ETA_ERECEIPT_LINES_INVALID: exact coded receipt lines are required' using errcode='23514'; end if;
  select sum((x->>'netSaleMinor')::numeric),sum((x->>'taxMinor')::numeric),jsonb_agg(x order by ord)
    into v_net,v_tax,v_lines from jsonb_array_elements(p_source_snapshot->'lines') with ordinality lines(x,ord);
  if v_net<>v_source.taxable_base_minor::numeric or v_tax<>v_source.tax_minor::numeric then
    raise exception 'ETA_ERECEIPT_LINES_DO_NOT_RECONCILE: source receipt must equal immutable posted VAT amounts' using errcode='23514'; end if;
  v_payload:=jsonb_build_object('vat_document_id',p_vat_document_id,'receipt_number',btrim(p_receipt_number),
    'issued_at',p_issued_at,'source_snapshot',p_source_snapshot);
  select * into v_existing from public.eta_ereceipt_documents where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
    return v_existing.id;
  end if;
  select d.* into v_prior from public.eta_ereceipt_documents d
    join public.eta_ereceipt_delivery_state s on s.document_id=d.id
    where d.ereceipt_profile_id=v_profile.id order by d.created_at desc limit 1;
  if found then
    select * into v_prior_state from public.eta_ereceipt_delivery_state where document_id=v_prior.id;
    if v_prior.vat_document_id=p_vat_document_id then
      if v_prior_state.status in ('invalid','rejected') and v_prior_state.eta_receipt_uuid is not null then
        v_previous_uuid:=v_prior.fiscal_snapshot->>'previousUUID'; v_previous_document_id:=v_prior.previous_document_id;
        v_reference_old:=v_prior_state.eta_receipt_uuid;
      else
        raise exception 'ETA_ERECEIPT_SOURCE_ALREADY_PREPARED: only an invalid or rejected receipt can be corrected' using errcode='23505';
      end if;
    elsif v_prior_state.status='valid' and v_prior_state.eta_receipt_uuid is not null then
      v_previous_uuid:=v_prior_state.eta_receipt_uuid; v_previous_document_id:=v_prior.id;
    else raise exception 'ETA_ERECEIPT_CHAIN_PENDING: previous POS receipt must be valid or explicitly corrected first' using errcode='55000'; end if;
  end if;
  if exists(select 1 from public.eta_ereceipt_documents d where d.organization_id=p_organization_id
    and d.vat_document_id=p_vat_document_id and (v_prior.id is null or d.id<>v_prior.id)) then
    raise exception 'ETA_ERECEIPT_SOURCE_ALREADY_PREPARED: a posted source can have only one receipt chain' using errcode='23505'; end if;
  v_snapshot:=jsonb_build_object('documentId',v_id,'receiptType',v_type,'typeVersion','1.2',
    'receiptNumber',btrim(p_receipt_number),'dateTimeIssued',to_char(p_issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'previousUUID',v_previous_uuid,'seller',jsonb_build_object('rin',v_profile.issuer_registration_number,
      'companyTradeName',v_profile.issuer_trade_name,'branchCode',v_profile.branch_code,'branchAddress',v_profile.branch_address,
      'deviceSerialNumber',v_profile.pos_device_serial,'activityCode',v_profile.taxpayer_activity_code),
    'buyer',p_source_snapshot->'buyer','paymentMethod',p_source_snapshot->>'paymentMethod',
    'taxableBaseMinor',v_source.taxable_base_minor::text,'taxMinor',v_source.tax_minor::text,'grossMinor',v_source.gross_minor::text,'lines',v_lines)
    ||case when v_sale_uuid is not null then jsonb_build_object('referenceUUID',v_sale_uuid) else '{}'::jsonb end
    ||case when v_reference_old is not null then jsonb_build_object('referenceOldUUID',v_reference_old) else '{}'::jsonb end;
  insert into public.eta_ereceipt_documents(id,organization_id,ereceipt_profile_id,vat_document_id,supersedes_document_id,
    previous_document_id,receipt_type,type_version,receipt_number,issued_at,authoritative_source_snapshot,fiscal_snapshot,
    idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,v_profile.id,p_vat_document_id,case when v_reference_old is not null then v_prior.id end,
    v_previous_document_id,v_type,'1.2',btrim(p_receipt_number),p_issued_at,p_source_snapshot,v_snapshot,
    p_idempotency_key,v_payload,auth.uid());
  insert into public.eta_ereceipt_delivery_state(document_id,organization_id) values(v_id,p_organization_id);
  insert into public.eta_ereceipt_delivery_events(organization_id,document_id,status,message)
    values(p_organization_id,v_id,'draft','Authoritative receipt source snapshot prepared; no ETA call or accounting write occurred.');
  perform app.write_audit(p_organization_id,'eta_ereceipt.document_prepared','eta_ereceipt_document',v_id,null,
    jsonb_build_object('vat_document_id',p_vat_document_id,'source_document_id',p_source_snapshot->>'sourceDocumentId','receipt_type',v_type));
  return v_id;
end;
$$;

create function public.request_eta_ereceipt_preproduction_submission(p_organization_id uuid,p_document_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.eta_ereceipt_documents%rowtype; s public.eta_ereceipt_delivery_state%rowtype;
begin
  perform app.require_capability(p_organization_id,'eta_ereceipt.submit');
  select * into d from public.eta_ereceipt_documents where id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_ERECEIPT_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  select * into s from public.eta_ereceipt_delivery_state where document_id=d.id for update;
  if s.status not in ('draft','retry_wait','failed','signing')
    or (s.status='retry_wait' and (s.next_attempt_at>now() or s.submission_uuid is not null))
    or (s.status='failed' and s.submission_uuid is not null)
    or (s.status='signing' and s.updated_at>now()-interval '10 minutes') or s.attempt_count>=5
  then raise exception 'ETA_ERECEIPT_SUBMISSION_NOT_RETRYABLE' using errcode='55000'; end if;
  update public.eta_ereceipt_delivery_state set status='signing',attempt_count=attempt_count+1,next_attempt_at=null,
    last_error_code=null,last_error_message=null,completed_at=null,updated_at=now() where document_id=d.id;
  insert into public.eta_ereceipt_delivery_events(organization_id,document_id,status,message)
    values(p_organization_id,d.id,'signing','Receipt UUID generation and separate CAdES-BES batch signing requested.');
  return d.fiscal_snapshot;
end;
$$;

create function public.read_eta_ereceipt_preproduction_submission(p_organization_id uuid,p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app.require_capability(p_organization_id,'eta_ereceipt.read');
  select jsonb_build_object('status',s.status,'submissionUuid',s.submission_uuid,'etaReceiptUuid',s.eta_receipt_uuid,
    'attemptCount',s.attempt_count,'nextAttemptAt',s.next_attempt_at,'supersedesDocumentId',d.supersedes_document_id,
    'previousDocumentId',d.previous_document_id,'sourceDocumentId',d.authoritative_source_snapshot->>'sourceDocumentId')
  into result from public.eta_ereceipt_delivery_state s join public.eta_ereceipt_documents d on d.id=s.document_id
  where s.document_id=p_document_id and s.organization_id=p_organization_id;
  if result is null then raise exception 'ETA_ERECEIPT_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  return result;
end;
$$;

create function public.record_eta_ereceipt_preproduction_result(
  p_organization_id uuid,p_document_id uuid,p_status text,p_submission_uuid text default null,
  p_eta_receipt_uuid text default null,p_eta_long_id text default null,p_error_code text default null,
  p_error_message text default null,p_provider_payload jsonb default null,p_retry_after_seconds integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_next timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('signing','retry_wait','failed','submitted','processing','valid','invalid','rejected','cancelled') then
    raise exception 'ETA_ERECEIPT_STATUS_INVALID' using errcode='22023'; end if;
  if p_eta_receipt_uuid is not null and p_eta_receipt_uuid !~ '^[0-9a-f]{64}$' then
    raise exception 'ETA_ERECEIPT_UUID_INVALID' using errcode='22023'; end if;
  if p_status in ('submitted','processing','valid','invalid','rejected','cancelled') and nullif(p_submission_uuid,'') is null then
    raise exception 'ETA_ERECEIPT_SUBMISSION_UUID_REQUIRED' using errcode='22023'; end if;
  v_next:=case when p_status='retry_wait' then now()+make_interval(secs=>greatest(30,least(coalesce(p_retry_after_seconds,60),3600))) end;
  update public.eta_ereceipt_delivery_state set status=p_status,submission_uuid=coalesce(p_submission_uuid,submission_uuid),
    eta_receipt_uuid=coalesce(p_eta_receipt_uuid,eta_receipt_uuid),eta_long_id=coalesce(p_eta_long_id,eta_long_id),
    last_error_code=nullif(p_error_code,''),last_error_message=nullif(left(p_error_message,1000),''),
    last_provider_payload=p_provider_payload,next_attempt_at=v_next,
    submitted_at=case when p_status='submitted' then coalesce(submitted_at,now()) else submitted_at end,
    completed_at=case when p_status in ('failed','valid','invalid','rejected','cancelled') then now() else null end,updated_at=now()
  where document_id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_ERECEIPT_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.eta_ereceipt_delivery_events(organization_id,document_id,status,provider_code,message,provider_payload)
    values(p_organization_id,p_document_id,p_status,nullif(p_error_code,''),nullif(left(p_error_message,1000),''),p_provider_payload);
end;
$$;

revoke all on function public.configure_eta_ereceipt_preproduction(uuid,uuid,text,text,jsonb,text,text,text,text,text,text,text,date,date),
  public.prepare_eta_ereceipt_document(uuid,uuid,text,timestamptz,jsonb,text),
  public.request_eta_ereceipt_preproduction_submission(uuid,uuid),public.read_eta_ereceipt_preproduction_submission(uuid,uuid),
  public.record_eta_ereceipt_preproduction_result(uuid,uuid,text,text,text,text,text,text,jsonb,integer)
from public,anon,authenticated,service_role;
grant execute on function public.configure_eta_ereceipt_preproduction(uuid,uuid,text,text,jsonb,text,text,text,text,text,text,text,date,date),
  public.prepare_eta_ereceipt_document(uuid,uuid,text,timestamptz,jsonb,text),
  public.request_eta_ereceipt_preproduction_submission(uuid,uuid),public.read_eta_ereceipt_preproduction_submission(uuid,uuid)
to authenticated;
grant execute on function public.record_eta_ereceipt_preproduction_result(uuid,uuid,text,text,text,text,text,text,jsonb,integer)
to service_role;
grant select,update on public.eta_ereceipt_delivery_state to service_role;
grant select,insert on public.eta_ereceipt_delivery_events to service_role;

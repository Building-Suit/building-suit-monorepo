-- LS-EG-002 / LS-D-ETA-SCOPE: separately scoped ETA B2B eInvoice adapter.
-- This is deliberately preproduction-only. It snapshots complete fiscal line
-- data against the immutable VAT source and never posts or changes accounting.

create table public.organization_eta_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  vat_profile_id uuid not null,
  environment text not null check (environment = 'preproduction'),
  issuer_registration_number text not null check (length(btrim(issuer_registration_number)) between 3 and 64),
  issuer_name text not null check (length(btrim(issuer_name)) between 1 and 200),
  branch_id text not null check (length(btrim(branch_id)) between 1 and 50),
  taxpayer_activity_code text not null check (taxpayer_activity_code ~ '^[0-9]{1,20}$'),
  issuer_address jsonb not null check (jsonb_typeof(issuer_address) = 'object'),
  onboarding_evidence_reference text not null check (length(btrim(onboarding_evidence_reference)) > 0),
  onboarding_evidence_verified_on date not null check (isfinite(onboarding_evidence_verified_on)),
  signing_certificate_reference text not null check (length(btrim(signing_certificate_reference)) > 0),
  effective_from date not null check (isfinite(effective_from)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, effective_from),
  foreign key (vat_profile_id, organization_id)
    references public.organization_vat_profiles(id, organization_id) on delete restrict
);
comment on table public.organization_eta_profiles is
  'Append-only preproduction ETA issuer/onboarding evidence. OAuth credentials and signing keys are server secrets, never database or browser data.';

create table public.eta_b2b_documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  eta_profile_id uuid not null,
  vat_document_id uuid not null,
  supersedes_document_id uuid unique,
  document_type text not null check (document_type in ('i', 'c')),
  document_type_version text not null check (document_type_version = '1.0'),
  internal_id text not null check (length(btrim(internal_id)) between 1 and 50),
  issued_at timestamptz not null,
  fiscal_snapshot jsonb not null check (jsonb_typeof(fiscal_snapshot) = 'object'),
  idempotency_key text not null check (length(btrim(idempotency_key)) > 0),
  request_payload jsonb not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, idempotency_key),
  foreign key (eta_profile_id, organization_id)
    references public.organization_eta_profiles(id, organization_id) on delete restrict,
  foreign key (vat_document_id, organization_id)
    references public.vat_documents(id, organization_id) on delete restrict,
  foreign key (supersedes_document_id, organization_id)
    references public.eta_b2b_documents(id, organization_id) on delete restrict
);
comment on table public.eta_b2b_documents is
  'Immutable fiscal document snapshot. Complete coded line data must reconcile to the already-posted VAT source; no journal is created here.';

create table public.eta_b2b_delivery_state (
  document_id uuid primary key,
  organization_id uuid not null,
  status text not null default 'draft'
    check (status in ('draft','signing','retry_wait','failed','submitted','processing','valid','invalid','rejected','cancelled')),
  attempt_count integer not null default 0 check (attempt_count >= 0 and attempt_count <= 20),
  next_attempt_at timestamptz,
  submission_uuid text,
  eta_document_uuid text,
  eta_long_id text,
  last_error_code text,
  last_error_message text,
  last_provider_payload jsonb,
  submitted_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (document_id, organization_id),
  foreign key (document_id, organization_id)
    references public.eta_b2b_documents(id, organization_id) on delete restrict,
  check (status not in ('submitted','processing','valid','invalid','rejected','cancelled') or submission_uuid is not null),
  check (status <> 'valid' or eta_document_uuid is not null)
);

create table public.eta_b2b_delivery_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  document_id uuid not null,
  status text not null,
  provider_code text,
  message text,
  provider_payload jsonb,
  created_at timestamptz not null default now(),
  foreign key (document_id, organization_id)
    references public.eta_b2b_documents(id, organization_id) on delete restrict
);
create index eta_b2b_delivery_events_document_idx
  on public.eta_b2b_delivery_events(organization_id, document_id, created_at desc);

insert into public.capabilities(key, domain, description) values
  ('eta.read', 'eta', 'Read ETA preproduction fiscal documents and delivery status'),
  ('eta.configure', 'eta', 'Record ETA preproduction issuer and onboarding evidence'),
  ('eta.prepare', 'eta', 'Prepare complete ETA B2B fiscal snapshots from posted VAT documents'),
  ('eta.submit', 'eta', 'Submit and poll prepared ETA B2B documents in preproduction')
on conflict do nothing;
insert into public.role_capabilities(role, capability_key)
select r.role::public.organization_role, c.key
from (values ('owner'), ('admin'), ('accountant')) r(role)
cross join public.capabilities c
where c.domain = 'eta' and (c.key <> 'eta.configure' or r.role in ('owner','admin'))
on conflict do nothing;
insert into public.role_capabilities(role, capability_key) values ('viewer', 'eta.read') on conflict do nothing;

alter table public.organization_eta_profiles enable row level security;
alter table public.eta_b2b_documents enable row level security;
alter table public.eta_b2b_delivery_state enable row level security;
alter table public.eta_b2b_delivery_events enable row level security;
create policy eta_profiles_read on public.organization_eta_profiles for select to authenticated
  using (app.has_capability(organization_id, 'eta.read'));
create policy eta_documents_read on public.eta_b2b_documents for select to authenticated
  using (app.has_capability(organization_id, 'eta.read'));
create policy eta_delivery_state_read on public.eta_b2b_delivery_state for select to authenticated
  using (app.has_capability(organization_id, 'eta.read'));
create policy eta_delivery_events_read on public.eta_b2b_delivery_events for select to authenticated
  using (app.has_capability(organization_id, 'eta.read'));
revoke all on public.organization_eta_profiles, public.eta_b2b_documents,
  public.eta_b2b_delivery_state, public.eta_b2b_delivery_events from public, anon, authenticated;
grant select on public.organization_eta_profiles, public.eta_b2b_documents,
  public.eta_b2b_delivery_state, public.eta_b2b_delivery_events to authenticated;

create trigger eta_profiles_immutable before update or delete on public.organization_eta_profiles
  for each row execute function app.reject_vat_evidence_change();
create trigger eta_documents_immutable before update or delete on public.eta_b2b_documents
  for each row execute function app.reject_vat_evidence_change();
create trigger eta_delivery_events_immutable before update or delete on public.eta_b2b_delivery_events
  for each row execute function app.reject_vat_evidence_change();

create function app.eta_address_valid(p_address jsonb, p_issuer boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(p_address) = 'object'
    and p_address->>'country' = 'EG'
    and nullif(btrim(p_address->>'governate'), '') is not null
    and nullif(btrim(p_address->>'regionCity'), '') is not null
    and nullif(btrim(p_address->>'street'), '') is not null
    and nullif(btrim(p_address->>'buildingNumber'), '') is not null
    and (not p_issuer or nullif(btrim(p_address->>'branchId'), '') is not null), false);
$$;

create function public.configure_eta_preproduction(
  p_organization_id uuid, p_vat_profile_id uuid, p_issuer_name text,
  p_branch_id text, p_taxpayer_activity_code text, p_issuer_address jsonb,
  p_onboarding_evidence_reference text, p_onboarding_evidence_verified_on date,
  p_signing_certificate_reference text, p_effective_from date
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid := gen_random_uuid(); v_vat public.organization_vat_profiles%rowtype; v_address jsonb;
begin
  perform app.require_capability(p_organization_id, 'eta.configure');
  select * into v_vat from public.organization_vat_profiles
    where id=p_vat_profile_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_VAT_PROFILE_REQUIRED' using errcode='23514'; end if;
  v_address := coalesce(p_issuer_address,'{}'::jsonb) || jsonb_build_object('branchId',btrim(p_branch_id));
  if nullif(btrim(p_issuer_name),'') is null or nullif(btrim(p_branch_id),'') is null
    or p_taxpayer_activity_code !~ '^[0-9]{1,20}$' or not app.eta_address_valid(v_address,true)
    or nullif(btrim(p_onboarding_evidence_reference),'') is null
    or p_onboarding_evidence_verified_on is null or not isfinite(p_onboarding_evidence_verified_on)
    or p_onboarding_evidence_verified_on > current_date
    or nullif(btrim(p_signing_certificate_reference),'') is null
    or p_effective_from is null or not isfinite(p_effective_from) or p_effective_from < v_vat.effective_from
    or exists (select 1 from public.organization_eta_profiles where organization_id=p_organization_id and effective_from >= p_effective_from) then
    raise exception 'ETA_PROFILE_INVALID: verified onboarding, issuer, branch, activity and signing-certificate references are required' using errcode='23514';
  end if;
  insert into public.organization_eta_profiles(id,organization_id,vat_profile_id,environment,
    issuer_registration_number,issuer_name,branch_id,taxpayer_activity_code,issuer_address,
    onboarding_evidence_reference,onboarding_evidence_verified_on,signing_certificate_reference,effective_from,created_by)
  values(v_id,p_organization_id,p_vat_profile_id,'preproduction',v_vat.registration_number,
    btrim(p_issuer_name),btrim(p_branch_id),p_taxpayer_activity_code,v_address,
    btrim(p_onboarding_evidence_reference),p_onboarding_evidence_verified_on,
    btrim(p_signing_certificate_reference),p_effective_from,auth.uid());
  perform app.write_audit(p_organization_id,'eta.preproduction_profile_configured','organization_eta_profile',v_id,null,
    jsonb_build_object('environment','preproduction','effective_from',p_effective_from,'evidence_verified_on',p_onboarding_evidence_verified_on));
  return v_id;
end;
$$;

create function public.prepare_eta_b2b_document(
  p_organization_id uuid, p_vat_document_id uuid, p_internal_id text,
  p_issued_at timestamptz, p_receiver jsonb, p_lines jsonb, p_idempotency_key text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid := gen_random_uuid(); v_source public.vat_documents%rowtype;
  v_profile public.organization_eta_profiles%rowtype; v_existing public.eta_b2b_documents%rowtype;
  v_original_eta_uuid text; v_type text; v_snapshot jsonb; v_lines jsonb;
  v_prior_document_id uuid; v_prior_status text;
  v_net numeric; v_tax numeric; v_payload jsonb;
begin
  perform app.require_capability(p_organization_id,'eta.prepare');
  if nullif(btrim(p_internal_id),'') is null or length(p_internal_id)>50
    or p_issued_at is null or p_issued_at > now()
    or nullif(btrim(p_idempotency_key),'') is null or p_receiver is null or p_lines is null
    or not app.eta_address_valid(p_receiver->'address')
    or p_receiver->>'type' <> 'B' or nullif(btrim(p_receiver->>'id'),'') is null or nullif(btrim(p_receiver->>'name'),'') is null
    or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines)=0 then
    raise exception 'ETA_DOCUMENT_INVALID: complete B2B receiver, UTC issuance and fiscal lines are required' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('eta:'||p_organization_id::text,0));
  select * into v_source from public.vat_documents
    where id=p_vat_document_id and organization_id=p_organization_id for share;
  if not found or v_source.direction <> 'output' or v_source.kind not in ('invoice','credit') then
    raise exception 'ETA_SOURCE_INVALID: only posted output VAT invoices and full credits are supported' using errcode='23514';
  end if;
  if (p_issued_at at time zone 'UTC')::date <> v_source.document_date then
    raise exception 'ETA_ISSUANCE_DATE_MISMATCH: fiscal issuance must match the posted source document date' using errcode='23514';
  end if;
  select * into v_profile from public.organization_eta_profiles
    where organization_id=p_organization_id and effective_from <= v_source.tax_point_date
    order by effective_from desc limit 1;
  if not found or v_profile.vat_profile_id <> v_source.profile_id then
    raise exception 'ETA_PROFILE_NOT_EFFECTIVE' using errcode='23514'; end if;
  if p_receiver->>'id'=v_profile.issuer_registration_number then
    raise exception 'ETA_RECEIVER_EQUALS_ISSUER' using errcode='23514'; end if;
  v_type := case v_source.kind when 'invoice' then 'i' else 'c' end;
  if v_type='c' then
    select state.eta_document_uuid into v_original_eta_uuid
    from public.eta_b2b_documents original
    join public.eta_b2b_delivery_state state on state.document_id=original.id
    where original.vat_document_id=v_source.adjusts_document_id
      and original.organization_id=p_organization_id and state.status='valid'
    order by original.created_at desc limit 1;
    if v_original_eta_uuid is null then
      raise exception 'ETA_CREDIT_REFERENCE_REQUIRED: source invoice must already be valid in ETA preproduction' using errcode='23514';
    end if;
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) x
    where jsonb_typeof(x)<>'object' or nullif(btrim(x->>'description'),'') is null
      or x->>'item_type' not in ('GS1','EGS') or nullif(btrim(x->>'item_code'),'') is null
      or nullif(btrim(x->>'unit_type'),'') is null or x->>'quantity' !~ '^(0|[1-9][0-9]*)(\.[0-9]{1,5})?$'
      or x->>'quantity' ~ '^0(\.0+)?$'
      or coalesce(x->>'unit_value_minor','') !~ '^[1-9][0-9]*$'
      or coalesce(x->>'sales_total_minor','') !~ '^[1-9][0-9]*$'
      or coalesce(x->>'discount_minor','') !~ '^(0|[1-9][0-9]*)$'
      or coalesce(x->>'net_total_minor','') !~ '^[1-9][0-9]*$'
      or coalesce(x->>'tax_minor','') !~ '^[1-9][0-9]*$'
      or (x->>'sales_total_minor')::numeric-(x->>'discount_minor')::numeric<>(x->>'net_total_minor')::numeric
      or round((x->>'quantity')::numeric*(x->>'unit_value_minor')::numeric)<>(x->>'sales_total_minor')::numeric
  ) then raise exception 'ETA_LINES_INVALID: coded line values must be complete exact minor-unit strings' using errcode='23514'; end if;
  select sum((x->>'net_total_minor')::numeric),sum((x->>'tax_minor')::numeric),
    jsonb_agg(jsonb_build_object(
      'description',btrim(x->>'description'),'itemType',x->>'item_type','itemCode',btrim(x->>'item_code'),
      'unitType',btrim(x->>'unit_type'),'quantity',x->>'quantity','unitValueMinor',x->>'unit_value_minor',
      'salesTotalMinor',x->>'sales_total_minor','discountMinor',x->>'discount_minor',
      'netTotalMinor',x->>'net_total_minor','taxMinor',x->>'tax_minor','internalCode',nullif(btrim(x->>'internal_code'),'')) order by ord)
  into v_net,v_tax,v_lines from jsonb_array_elements(p_lines) with ordinality lines(x,ord);
  if v_net<>v_source.taxable_base_minor::numeric or v_tax<>v_source.tax_minor::numeric then
    raise exception 'ETA_LINES_DO_NOT_RECONCILE: fiscal lines must equal immutable posted VAT amounts' using errcode='23514'; end if;
  v_snapshot := jsonb_build_object(
    'documentId',v_id,'internalId',btrim(p_internal_id),'documentType',v_type,'documentTypeVersion','1.0',
    'dateTimeIssued',to_char(p_issued_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'taxpayerActivityCode',v_profile.taxpayer_activity_code,
    'issuer',jsonb_build_object('type','B','id',v_profile.issuer_registration_number,'name',v_profile.issuer_name,'address',v_profile.issuer_address),
    'receiver',jsonb_build_object('type','B','id',btrim(p_receiver->>'id'),'name',btrim(p_receiver->>'name'),'address',p_receiver->'address'),
    'taxableBaseMinor',v_source.taxable_base_minor::text,'taxMinor',v_source.tax_minor::text,'grossMinor',v_source.gross_minor::text,
    'lines',v_lines
  ) || case when v_type='c' then jsonb_build_object('references',jsonb_build_array(v_original_eta_uuid)) else '{}'::jsonb end;
  v_payload := jsonb_build_object('vat_document_id',p_vat_document_id,'internal_id',btrim(p_internal_id),
    'issued_at',p_issued_at,'receiver',p_receiver,'lines',v_lines);
  select * into v_existing from public.eta_b2b_documents
    where organization_id=p_organization_id and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_payload<>v_payload then raise exception 'IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
    return v_existing.id;
  end if;
  select d.id,s.status into v_prior_document_id,v_prior_status
    from public.eta_b2b_documents d join public.eta_b2b_delivery_state s on s.document_id=d.id
    where d.organization_id=p_organization_id and d.vat_document_id=p_vat_document_id
    order by d.created_at desc limit 1;
  if v_prior_document_id is not null and v_prior_status not in ('failed','invalid','rejected') then
    raise exception 'ETA_SOURCE_ALREADY_PREPARED: only a failed or rejected fiscal snapshot can be superseded' using errcode='23505';
  end if;
  insert into public.eta_b2b_documents(id,organization_id,eta_profile_id,vat_document_id,supersedes_document_id,document_type,
    document_type_version,internal_id,issued_at,fiscal_snapshot,idempotency_key,request_payload,created_by)
  values(v_id,p_organization_id,v_profile.id,p_vat_document_id,v_prior_document_id,v_type,'1.0',btrim(p_internal_id),p_issued_at,
    v_snapshot,p_idempotency_key,v_payload,auth.uid());
  insert into public.eta_b2b_delivery_state(document_id,organization_id) values(v_id,p_organization_id);
  insert into public.eta_b2b_delivery_events(organization_id,document_id,status,message)
    values(p_organization_id,v_id,'draft','Complete fiscal snapshot prepared; no ETA call has occurred.');
  perform app.write_audit(p_organization_id,'eta.document_prepared','eta_b2b_document',v_id,null,
    jsonb_build_object('vat_document_id',p_vat_document_id,'document_type',v_type,'environment','preproduction'));
  return v_id;
end;
$$;

create function public.request_eta_preproduction_submission(p_organization_id uuid,p_document_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.eta_b2b_documents%rowtype; s public.eta_b2b_delivery_state%rowtype;
begin
  perform app.require_capability(p_organization_id,'eta.submit');
  select * into d from public.eta_b2b_documents where id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  select * into s from public.eta_b2b_delivery_state where document_id=d.id for update;
  if s.status not in ('draft','retry_wait','signing') or (s.status='retry_wait' and (s.next_attempt_at>now() or s.submission_uuid is not null))
    or (s.status='signing' and s.updated_at>now()-interval '10 minutes') or s.attempt_count>=5 then
    raise exception 'ETA_SUBMISSION_NOT_RETRYABLE' using errcode='55000'; end if;
  update public.eta_b2b_delivery_state set status='signing',attempt_count=attempt_count+1,
    next_attempt_at=null,last_error_code=null,last_error_message=null,updated_at=now() where document_id=d.id;
  insert into public.eta_b2b_delivery_events(organization_id,document_id,status,message)
    values(p_organization_id,d.id,'signing','Server-side CAdES-BES signing requested.');
  return d.fiscal_snapshot;
end;
$$;

create function public.read_eta_preproduction_submission(p_organization_id uuid,p_document_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  perform app.require_capability(p_organization_id,'eta.read');
  select jsonb_build_object('status',s.status,'submissionUuid',s.submission_uuid,
    'etaDocumentUuid',s.eta_document_uuid,'attemptCount',s.attempt_count,'nextAttemptAt',s.next_attempt_at)
  into result from public.eta_b2b_delivery_state s
  where s.document_id=p_document_id and s.organization_id=p_organization_id;
  if result is null then raise exception 'ETA_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  return result;
end;
$$;

create function public.record_eta_preproduction_result(
  p_organization_id uuid,p_document_id uuid,p_status text,p_submission_uuid text default null,
  p_eta_document_uuid text default null,p_eta_long_id text default null,p_error_code text default null,
  p_error_message text default null,p_provider_payload jsonb default null,p_retry_after_seconds integer default null
) returns void language plpgsql security definer set search_path='' as $$
declare v_next timestamptz;
begin
  if auth.role()<>'service_role' then raise exception 'SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
  if p_status not in ('retry_wait','failed','submitted','processing','valid','invalid','rejected','cancelled') then
    raise exception 'ETA_STATUS_INVALID' using errcode='22023'; end if;
  if p_status in ('submitted','processing','valid','invalid','rejected','cancelled') and nullif(p_submission_uuid,'') is null then
    raise exception 'ETA_SUBMISSION_UUID_REQUIRED' using errcode='22023'; end if;
  v_next := case when p_status='retry_wait' then now()+make_interval(secs=>greatest(30,least(coalesce(p_retry_after_seconds,60),3600))) end;
  update public.eta_b2b_delivery_state set status=p_status,submission_uuid=coalesce(p_submission_uuid,submission_uuid),
    eta_document_uuid=coalesce(p_eta_document_uuid,eta_document_uuid),eta_long_id=coalesce(p_eta_long_id,eta_long_id),
    last_error_code=nullif(p_error_code,''),last_error_message=nullif(left(p_error_message,1000),''),
    last_provider_payload=p_provider_payload,next_attempt_at=v_next,
    submitted_at=case when p_status='submitted' then coalesce(submitted_at,now()) else submitted_at end,
    completed_at=case when p_status in ('failed','valid','invalid','rejected','cancelled') then now() else null end,updated_at=now()
  where document_id=p_document_id and organization_id=p_organization_id;
  if not found then raise exception 'ETA_DOCUMENT_NOT_FOUND' using errcode='P0002'; end if;
  insert into public.eta_b2b_delivery_events(organization_id,document_id,status,provider_code,message,provider_payload)
    values(p_organization_id,p_document_id,p_status,nullif(p_error_code,''),nullif(left(p_error_message,1000),''),p_provider_payload);
end;
$$;

revoke all on function public.configure_eta_preproduction(uuid,uuid,text,text,text,jsonb,text,date,text,date),
  public.prepare_eta_b2b_document(uuid,uuid,text,timestamptz,jsonb,jsonb,text),
  public.request_eta_preproduction_submission(uuid,uuid),public.read_eta_preproduction_submission(uuid,uuid),
  public.record_eta_preproduction_result(uuid,uuid,text,text,text,text,text,text,jsonb,integer)
from public,anon,authenticated,service_role;
grant execute on function public.configure_eta_preproduction(uuid,uuid,text,text,text,jsonb,text,date,text,date),
  public.prepare_eta_b2b_document(uuid,uuid,text,timestamptz,jsonb,jsonb,text),
  public.request_eta_preproduction_submission(uuid,uuid),public.read_eta_preproduction_submission(uuid,uuid)
to authenticated;
grant execute on function public.record_eta_preproduction_result(uuid,uuid,text,text,text,text,text,text,jsonb,integer)
to service_role;
grant select,update on public.eta_b2b_delivery_state to service_role;
grant select,insert on public.eta_b2b_delivery_events to service_role;

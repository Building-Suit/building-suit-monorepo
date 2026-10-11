-- SS-SA-EVIDENCE-001: private, immutable payment evidence for the existing
-- Shop manual-billing authority. An attachment is evidence for review only;
-- platform_admin_billing_command remains the sole approval/receipt authority.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-payment-evidence', 'shop-payment-evidence', false, 5242880,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table public.shop_billing_payment_evidence (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null
    references public.shop_billing_submissions (id) on delete restrict,
  shop_id uuid not null references public.shops (id) on delete restrict,
  uploaded_by_user_id uuid not null references auth.users (id) on delete restrict,
  object_name text not null unique,
  original_file_name text not null,
  mime_type text not null check (mime_type in (
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
  )),
  size_bytes bigint not null check (size_bytes between 1 and 5242880),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  retained_until timestamptz not null,
  created_at timestamptz not null default clock_timestamp(),
  check (length(original_file_name) between 1 and 160),
  check (original_file_name !~ '[/\\]' and original_file_name !~ '[[:cntrl:]]'),
  check (retained_until >= created_at + interval '7 years'),
  unique (submission_id, sha256)
);

create index shop_billing_payment_evidence_submission_idx
  on public.shop_billing_payment_evidence (submission_id, created_at, id);

alter table public.shop_billing_payment_evidence enable row level security;
revoke all on table public.shop_billing_payment_evidence from public, anon, authenticated;
grant all on table public.shop_billing_payment_evidence to service_role;

create function shop_private.preserve_billing_payment_evidence()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'BILLING_PAYMENT_EVIDENCE_IMMUTABLE' using errcode = '55000';
end;
$$;

create trigger shop_billing_payment_evidence_immutable
before update or delete or truncate on public.shop_billing_payment_evidence
for each statement execute function shop_private.preserve_billing_payment_evidence();

create function shop_private.is_billing_payment_requester(
  p_submission_id uuid, p_shop_id uuid, p_user_id uuid
) returns boolean language sql stable security definer set search_path = '' as $$
  select p_user_id is not null and exists (
    select 1
    from public.shop_billing_submissions submission
    join public.profiles profile on profile.id = submission.submitted_by_profile_id
    where submission.id = p_submission_id
      and submission.shop_id = p_shop_id
      and profile.user_id = p_user_id
      and shop_private.is_owner(submission.shop_id)
  );
$$;

create function public.reserve_shop_billing_payment_evidence(
  p_submission_id uuid,
  p_original_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_sha256 text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_submission public.shop_billing_submissions;
  v_evidence_id uuid := gen_random_uuid();
  v_extension text;
  v_object_name text;
  v_created_at timestamptz := clock_timestamp();
  v_retained_until timestamptz := v_created_at + interval '7 years';
begin
  if p_submission_id is null
    or p_original_file_name is null
    or length(btrim(p_original_file_name)) not between 1 and 160
    or btrim(p_original_file_name) ~ '[/\\]'
    or btrim(p_original_file_name) ~ '[[:cntrl:]]'
    or p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    or p_size_bytes is null or p_size_bytes not between 1 and 5242880
    or p_sha256 is null or lower(p_sha256) !~ '^[0-9a-f]{64}$' then
    raise exception 'BILLING_PAYMENT_EVIDENCE_INVALID' using errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('billing-evidence:' || p_submission_id::text, 0)
  );
  select * into v_submission
  from public.shop_billing_submissions submission
  where submission.id = p_submission_id
  for update;
  if not found then
    raise exception 'BILLING_NOTICE_NOT_FOUND' using errcode = '22023';
  end if;
  if not shop_private.is_billing_payment_requester(
    v_submission.id, v_submission.shop_id, auth.uid()
  ) then
    raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if v_submission.status not in ('submitted', 'under_review') then
    raise exception 'BILLING_PAYMENT_EVIDENCE_STATE_INVALID' using errcode = '22023';
  end if;
  if (select count(*) from public.shop_billing_payment_evidence evidence
      where evidence.submission_id = p_submission_id) >= 5 then
    raise exception 'BILLING_PAYMENT_EVIDENCE_LIMIT_REACHED' using errcode = '22023';
  end if;

  v_extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
  end;
  v_object_name := v_submission.shop_id::text || '/' || p_submission_id::text
    || '/' || v_evidence_id::text || '.' || v_extension;

  insert into public.shop_billing_payment_evidence (
    id, submission_id, shop_id, uploaded_by_user_id, object_name,
    original_file_name, mime_type, size_bytes, sha256, retained_until, created_at
  ) values (
    v_evidence_id, p_submission_id, v_submission.shop_id, auth.uid(), v_object_name,
    btrim(p_original_file_name), p_mime_type, p_size_bytes, lower(p_sha256),
    v_retained_until, v_created_at
  );

  return jsonb_build_object(
    'evidenceId', v_evidence_id,
    'bucket', 'shop-payment-evidence',
    'objectName', v_object_name,
    'mimeType', p_mime_type,
    'sizeBytes', p_size_bytes,
    'retainedUntil', v_retained_until
  );
exception
  when unique_violation then
    raise exception 'BILLING_PAYMENT_EVIDENCE_DUPLICATE' using errcode = '22023';
end;
$$;

create function public.shop_billing_payment_evidence_read(p_submission_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_submission public.shop_billing_submissions; v_result jsonb;
begin
  select * into v_submission from public.shop_billing_submissions submission
  where submission.id = p_submission_id;
  if not found then raise exception 'BILLING_NOTICE_NOT_FOUND' using errcode = '22023'; end if;
  if not shop_private.is_billing_payment_requester(
    v_submission.id, v_submission.shop_id, auth.uid()
  ) then raise exception 'SHOP_OWNER_REQUIRED' using errcode = '42501'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'evidenceId', evidence.id,
    'originalFileName', evidence.original_file_name,
    'mimeType', evidence.mime_type,
    'sizeBytes', evidence.size_bytes,
    'sha256', evidence.sha256,
    'retainedUntil', evidence.retained_until,
    'createdAt', evidence.created_at
  ) order by evidence.created_at, evidence.id), '[]'::jsonb)
  into v_result
  from public.shop_billing_payment_evidence evidence
  join storage.objects object on object.bucket_id = 'shop-payment-evidence'
    and object.name = evidence.object_name
  where evidence.submission_id = p_submission_id;
  return v_result;
end;
$$;

-- Storage policies cannot query the private evidence table as authenticated.
-- Keep that table unexposed and perform the reservation lookup as the function
-- owner while retaining the caller's auth.uid() for the requester check.
create function shop_private.billing_payment_evidence_upload_allowed(
  p_object_name text, p_metadata jsonb
) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_billing_payment_evidence evidence
    join public.shop_billing_submissions submission on submission.id = evidence.submission_id
    where evidence.object_name = p_object_name
      and evidence.uploaded_by_user_id = auth.uid()
      and submission.status in ('submitted', 'under_review')
      and shop_private.is_billing_payment_requester(
        evidence.submission_id, evidence.shop_id, auth.uid()
      )
      and lower(coalesce(p_metadata ->> 'mimetype', '')) = evidence.mime_type
      and coalesce((p_metadata ->> 'size')::bigint, 0) = evidence.size_bytes
  );
$$;

create function shop_private.billing_payment_evidence_read_allowed(p_object_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.shop_billing_payment_evidence evidence
    where evidence.object_name = p_object_name
      and evidence.uploaded_by_user_id = auth.uid()
      and shop_private.is_billing_payment_requester(
        evidence.submission_id, evidence.shop_id, auth.uid()
      )
  );
$$;

revoke all on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  from public, anon;
revoke all on function shop_private.billing_payment_evidence_read_allowed(text)
  from public, anon;
grant execute on function shop_private.billing_payment_evidence_upload_allowed(text, jsonb)
  to authenticated, service_role;
grant execute on function shop_private.billing_payment_evidence_read_allowed(text)
  to authenticated, service_role;

-- Storage upload/download is available only to the exact Shop owner who made
-- the billing submission and first reserved this immutable server path.
create policy shop_payment_evidence_owner_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'shop-payment-evidence'
  and shop_private.billing_payment_evidence_upload_allowed(name, metadata)
);

create policy shop_payment_evidence_owner_select on storage.objects
for select to authenticated using (
  bucket_id = 'shop-payment-evidence'
  and shop_private.billing_payment_evidence_read_allowed(name)
);

create function shop_private.billing_payment_evidence_review_access(
  p_submission_id uuid, p_evidence_id uuid, p_expires_in integer
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_evidence public.shop_billing_payment_evidence; v_status text;
begin
  if auth.role() <> 'service_role'
    or nullif(current_setting('shop.super_admin_bridge_principal_id', true), '') is null then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  if p_submission_id is null or p_evidence_id is null
    or p_expires_in is null or p_expires_in not between 30 and 300 then
    raise exception 'BILLING_PAYMENT_EVIDENCE_ACCESS_INVALID' using errcode = '22023';
  end if;
  select evidence.* into v_evidence
  from public.shop_billing_payment_evidence evidence
  join public.shop_billing_submissions submission on submission.id = evidence.submission_id
  join storage.objects object on object.bucket_id = 'shop-payment-evidence'
    and object.name = evidence.object_name
  where evidence.id = p_evidence_id and evidence.submission_id = p_submission_id;
  if not found then
    raise exception 'BILLING_PAYMENT_EVIDENCE_NOT_FOUND' using errcode = '22023';
  end if;
  select submission.status into v_status
  from public.shop_billing_submissions submission
  where submission.id = v_evidence.submission_id;
  return jsonb_build_object(
    'evidenceId', v_evidence.id,
    'submissionId', v_evidence.submission_id,
    'shopId', v_evidence.shop_id,
    'originalFileName', v_evidence.original_file_name,
    'mimeType', v_evidence.mime_type,
    'sizeBytes', v_evidence.size_bytes,
    'sha256', v_evidence.sha256,
    'retainedUntil', v_evidence.retained_until,
    'submissionStatus', v_status,
    'bucket', 'shop-payment-evidence',
    'objectName', v_evidence.object_name,
    'expiresIn', p_expires_in,
    'expiresAt', clock_timestamp() + make_interval(secs => p_expires_in)
  );
end;
$$;

-- A focused query entry point keeps evidence access inside the existing
-- authenticated, environment-bound bridge without widening browser RPCs.
create function public.shop_super_admin_bridge_evidence_access(
  p_principal_id uuid, p_nonce uuid, p_body_digest text, p_envelope jsonb
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_principal public.shop_super_admin_integrations;
  v_receipt public.shop_super_admin_nonce_receipts;
  v_payload jsonb; v_actor jsonb; v_result jsonb; v_audit_id uuid;
  v_request_id uuid; v_correlation_id uuid; v_submission_id uuid; v_evidence_id uuid;
begin
  if auth.role() <> 'service_role' or jsonb_typeof(p_envelope) <> 'object'
    or p_body_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode = '42501';
  end if;
  select * into v_principal from public.shop_super_admin_integrations principal
  where principal.id = p_principal_id and principal.enabled
    and principal.retired_at is null and principal.valid_from <= clock_timestamp()
    and (principal.valid_until is null or principal.valid_until > clock_timestamp())
    and 'shop.billing.query' = any(principal.allowed_operations)
  for update;
  if not found then raise exception 'SHOP_SUPER_ADMIN_AUTHENTICATION_REQUIRED' using errcode = '42501'; end if;
  select * into v_receipt from public.shop_super_admin_nonce_receipts receipt
  where receipt.integration_principal_id = p_principal_id and receipt.nonce = p_nonce
    and receipt.body_digest = p_body_digest and receipt.expires_at > clock_timestamp();
  if not found then raise exception 'SHOP_SUPER_ADMIN_NONCE_REQUIRED' using errcode = '42501'; end if;

  if (p_envelope - array['protocolVersion','operation','operationVersion','requestId',
      'correlationId','sourceBindingId','targetBindingId','targetEnvironmentId',
      'actor','reason','payload']) <> '{}'::jsonb
    or p_envelope ->> 'protocolVersion' <> v_principal.protocol_version
    or p_envelope ->> 'operationVersion' <> '1.0'
    or p_envelope ->> 'operation' <> 'shop.billing.query'
    or p_envelope ->> 'reason' is not null
    or (p_envelope ->> 'sourceBindingId')::uuid <> v_principal.source_binding_id
    or (p_envelope ->> 'targetBindingId')::uuid <> v_principal.target_binding_id
    or (p_envelope ->> 'targetEnvironmentId')::uuid <> v_principal.target_environment_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_request_id := (p_envelope ->> 'requestId')::uuid;
  v_correlation_id := (p_envelope ->> 'correlationId')::uuid;
  if v_receipt.request_id <> v_request_id then
    raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode = '42501';
  end if;
  v_payload := p_envelope -> 'payload'; v_actor := p_envelope -> 'actor';
  if jsonb_typeof(v_payload) <> 'object' or jsonb_typeof(v_actor) <> 'object'
    or (v_payload - array['resource','submissionId','evidenceId','expiresIn']) <> '{}'::jsonb
    or v_payload ->> 'resource' <> 'evidence'
    or (v_actor - array['authorityBindingId','subjectId','roleSnapshot','sessionId']) <> '{}'::jsonb
    or v_actor ->> 'authorityBindingId' is null
    or (v_actor ->> 'authorityBindingId')::uuid <> v_principal.source_binding_id
    or v_actor ->> 'subjectId' is null
    or v_actor ->> 'roleSnapshot' is null
    or length(v_actor ->> 'roleSnapshot') not between 1 and 160
    or length(coalesce(v_actor ->> 'sessionId', '')) > 200 then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
  end if;
  v_submission_id := (v_payload ->> 'submissionId')::uuid;
  v_evidence_id := (v_payload ->> 'evidenceId')::uuid;
  perform set_config('shop.super_admin_bridge_principal_id', p_principal_id::text, true);
  v_result := shop_private.billing_payment_evidence_review_access(
    v_submission_id, v_evidence_id, (v_payload ->> 'expiresIn')::integer
  );
  insert into public.shop_super_admin_requests (
    integration_principal_id, request_id, correlation_id, operation,
    operation_version, is_command, target_resource_id, body_digest, reason,
    external_authority_binding_id, external_subject_id, external_role_snapshot,
    external_session_id, underlying_audit_id, result, result_digest
  ) values (
    p_principal_id, v_request_id, v_correlation_id, 'shop.billing.query',
    '1.0', false, v_submission_id, p_body_digest, null,
    (v_actor ->> 'authorityBindingId')::uuid, (v_actor ->> 'subjectId')::uuid,
    v_actor ->> 'roleSnapshot', nullif(v_actor ->> 'sessionId', ''), null, null,
    md5(v_result::text)
  ) returning id into v_audit_id;
  return jsonb_build_object('data', v_result, 'replayed', false,
    'targetAuditId', v_audit_id, 'targetResultVersion', 1);
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode = '22023';
end;
$$;

create or replace function shop_private.bridge_manifest(p_principal_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with manifest as (
    select jsonb_build_object(
      'adapterId', 'shop-suit-super-admin-bridge', 'suit', 'shop-suit',
      'targetBindingId', principal.target_binding_id,
      'targetEnvironmentId', principal.target_environment_id,
      'audience', principal.audience, 'health', 'ready',
      'manifestSchemaVersion', '1.0', 'protocolVersions', jsonb_build_array('1.0'),
      'manifestRevision', 'ss-sa-evidence-001-v1', 'issuedAt', clock_timestamp(),
      'capabilities', coalesce(jsonb_agg(jsonb_build_object(
        'operation', operation, 'version', '1.0',
        'kind', case when operation like '%.command' then 'command' else 'query' end,
        'idempotency', case when operation like '%.command' then 'exact-request-id' else 'nonce-only' end,
        'members', case operation
          when 'adapter.capabilities.read' then jsonb_build_array('manifest')
          when 'shop.platform.query' then to_jsonb(array['dashboard','shops','shop','audit'])
          when 'shop.platform.command' then to_jsonb(array['suspend_shop','reactivate_shop','add_support_note'])
          when 'shop.billing.query' then to_jsonb(array['queue','configuration','summary','audit','evidence'])
          when 'shop.billing.command' then to_jsonb(array['configure_instructions','mark_under_review','approve','reject','set_price_override'])
          when 'shop.plan.query' then to_jsonb(array['catalog','shop','audit'])
          when 'shop.plan.command' then to_jsonb(array['publish_terms','set_availability','change_subscription',
            'renew_subscription','suspend_subscription','set_price_override','remove_price_override'])
        end
      ) order by operation), '[]'::jsonb)
    ) value
    from public.shop_super_admin_integrations principal,
      unnest(principal.allowed_operations) operation
    where principal.id = p_principal_id
    group by principal.id
  )
  select value || jsonb_build_object('manifestDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'), 'hex'))
  from manifest;
$$;

revoke all on function shop_private.preserve_billing_payment_evidence(),
  shop_private.is_billing_payment_requester(uuid, uuid, uuid),
  shop_private.billing_payment_evidence_review_access(uuid, uuid, integer)
from public, anon, authenticated, service_role;
revoke all on function public.reserve_shop_billing_payment_evidence(uuid, text, text, bigint, text),
  public.shop_billing_payment_evidence_read(uuid)
from public, anon, service_role;
grant execute on function public.reserve_shop_billing_payment_evidence(uuid, text, text, bigint, text),
  public.shop_billing_payment_evidence_read(uuid)
to authenticated;
revoke all on function public.shop_super_admin_bridge_evidence_access(uuid, uuid, text, jsonb)
from public, anon, authenticated;
grant execute on function public.shop_super_admin_bridge_evidence_access(uuid, uuid, text, jsonb)
to service_role;

notify pgrst, 'reload schema';

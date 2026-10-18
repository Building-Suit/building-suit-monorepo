-- DOS-AE-006 target-owned synthetic protocol storage. No target binding,
-- signing reference/material, provider key, live policy or operator grant seeded.
create table public.doctor_administration_nonces(
 source_binding_id uuid not null,key_id text not null check(length(key_id)between 1 and 160),
 nonce uuid not null,request_id uuid not null,
 received_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 primary key(source_binding_id,key_id,nonce),check(pg_catalog.isfinite(expires_at)and expires_at>received_at)
);
create table public.doctor_administration_audit(
 id uuid primary key default pg_catalog.gen_random_uuid(),source_binding_id uuid not null,target_binding_id uuid not null,target_environment_id uuid not null,
 authority_binding_id uuid not null,subject_id uuid not null,role_snapshot text not null check(length(role_snapshot)between 1 and 160),
 key_id text not null check(length(key_id)between 1 and 160),nonce uuid not null,request_id uuid not null,correlation_id uuid not null,
 operation text not null check(operation in('adapter.capabilities.read','doctor.account.query','doctor.plan.query')),
 request_digest text not null check(request_digest~'^[0-9a-f]{64}$'),response_digest text check(response_digest~'^[0-9a-f]{64}$'),
 manifest_digest text not null check(manifest_digest~'^[0-9a-f]{64}$'),outcome text not null check(outcome in('synthetic_read','operator_denied','target_denied')),
 created_at timestamptz not null default clock_timestamp(),database_actor text not null default session_user,
 foreign key(source_binding_id,key_id,nonce)references public.doctor_administration_nonces(source_binding_id,key_id,nonce),
 check(outcome<>'synthetic_read'or response_digest is not null)
);
create index doctor_administration_audit_request on public.doctor_administration_audit(source_binding_id,request_id,created_at);
alter table public.doctor_administration_nonces enable row level security;
alter table public.doctor_administration_nonces force row level security;
alter table public.doctor_administration_audit enable row level security;
alter table public.doctor_administration_audit force row level security;
create policy doctor_administration_nonces_database on public.doctor_administration_nonces for all to postgres using(true)with check(true);
create policy doctor_administration_audit_database on public.doctor_administration_audit for all to postgres using(true)with check(true);
revoke all on public.doctor_administration_nonces,public.doctor_administration_audit from public,anon,authenticated,service_role;
create trigger doctor_administration_nonces_immutable before update or delete or truncate on public.doctor_administration_nonces
 for each statement execute function doctor_private.saas_history_immutable();
create trigger doctor_administration_audit_immutable before update or delete or truncate on public.doctor_administration_audit
 for each statement execute function doctor_private.saas_history_immutable();
create function doctor_private.consume_administration_nonce(p_source uuid,p_key text,p_nonce uuid,p_request uuid,p_expiry timestamptz)returns boolean
language plpgsql volatile security invoker set search_path=''as $$
begin
 if current_setting('transaction_isolation')<>'read committed'then raise exception using errcode='25001',message='DOCTOR_ADMIN_ISOLATION_REQUIRED';end if;
 if p_source is null or p_key is null or length(p_key)not between 1 and 160 or p_nonce is null or p_request is null
  or p_expiry is null or not pg_catalog.isfinite(p_expiry)or p_expiry<=clock_timestamp()then raise exception using errcode='22023',message='DOCTOR_ADMIN_NONCE_INVALID';end if;
 insert into public.doctor_administration_nonces(source_binding_id,key_id,nonce,request_id,expires_at)values(p_source,p_key,p_nonce,p_request,p_expiry)
 on conflict(source_binding_id,key_id,nonce)do nothing;
 return found;
end $$;
create function doctor_private.append_administration_audit(p_input jsonb)returns uuid
language plpgsql volatile security invoker set search_path=''as $$
declare result uuid;
begin
 if jsonb_typeof(p_input)<>'object'or(select array_agg(k order by k)from jsonb_object_keys(p_input)k)is distinct from
 array['authorityBindingId','correlationId','keyId','manifestDigest','nonce','operation','outcome','requestDigest','requestId','responseDigest','roleSnapshot','sourceBindingId','subjectId','targetBindingId','targetEnvironmentId']::text[]then
  raise exception using errcode='22023',message='DOCTOR_ADMIN_AUDIT_INVALID';end if;
 if not exists(select 1 from public.doctor_administration_nonces n where n.source_binding_id=(p_input->>'sourceBindingId')::uuid and n.key_id=p_input->>'keyId'
  and n.nonce=(p_input->>'nonce')::uuid and n.request_id=(p_input->>'requestId')::uuid)then raise exception using errcode='42501',message='DOCTOR_ADMIN_RECEIPT_REQUIRED';end if;
 insert into public.doctor_administration_audit(source_binding_id,target_binding_id,target_environment_id,authority_binding_id,subject_id,role_snapshot,key_id,nonce,request_id,correlation_id,operation,request_digest,response_digest,manifest_digest,outcome)
 values((p_input->>'sourceBindingId')::uuid,(p_input->>'targetBindingId')::uuid,(p_input->>'targetEnvironmentId')::uuid,(p_input->>'authorityBindingId')::uuid,(p_input->>'subjectId')::uuid,p_input->>'roleSnapshot',p_input->>'keyId',(p_input->>'nonce')::uuid,(p_input->>'requestId')::uuid,(p_input->>'correlationId')::uuid,p_input->>'operation',p_input->>'requestDigest',p_input->>'responseDigest',p_input->>'manifestDigest',p_input->>'outcome')returning id into result;
 return result;
end $$;
-- Explicit unavailable projection. It cannot configure a target, infer an
-- external operator or convert an operator grant into payment confirmation.
create function doctor_private.administration_readiness()returns jsonb
language plpgsql volatile security definer set search_path=''as $$
declare actor uuid:=doctor_private.current_actor();
begin
 return jsonb_build_object('subscriber_user_id',actor,'suit','doctor-suit','state','unavailable','target_binding','unconfigured','signing','unconfigured','live_policy','pending','operator_approval','pending',
 'capabilities','[]'::jsonb,'operator_grant_available',false,'payment_confirmed',false,'live_activation',false);
end $$;
create function public.doctor_administration_readiness()returns jsonb
language sql volatile security invoker set search_path=''as $$select doctor_private.administration_readiness()$$;
revoke all on function doctor_private.consume_administration_nonce(uuid,text,uuid,uuid,timestamptz),doctor_private.append_administration_audit(jsonb),
 doctor_private.administration_readiness(),public.doctor_administration_readiness()from public,anon,authenticated,service_role;
grant execute on function doctor_private.administration_readiness(),public.doctor_administration_readiness()to authenticated;

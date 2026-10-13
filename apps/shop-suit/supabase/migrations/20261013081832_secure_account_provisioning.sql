-- Target-owned account provisioning; runtime delivery policy is separately provisioned.
create table public.shop_account_provisioning_settings (
  id boolean primary key check(id), enabled boolean not null default false,
  invitation_ready boolean not null default false,
  invite_redirect_url text not null check(invite_redirect_url ~ '^https://[A-Za-z0-9.-]+/auth/owner-invitation$'),
  auth_timeout_ms integer not null check(auth_timeout_ms between 1000 and 30000),
  lease_seconds integer not null check(lease_seconds between 60 and 300)
);
create table public.shop_account_provisions (
  id uuid primary key default gen_random_uuid(), principal_id uuid not null references public.shop_super_admin_integrations(id),
  email text not null unique check(email=lower(btrim(email))), auth_user_id uuid not null unique default gen_random_uuid(),
  payload jsonb not null, phase text not null default 'reserved' check(phase in ('reserved','active','conflict','review_required')),
  shop_id uuid references public.shops(id), subscription_id uuid references public.subscriptions(id),
  activation_audit_id uuid references public.platform_plan_events(id), active_snapshot jsonb,
  lease_token uuid, lease_until timestamptz, active_command_id uuid, latest_invitation_command_id uuid,
  owner_claimed_at timestamptz, last_event_id uuid, version integer not null default 1,
  created_at timestamptz not null default clock_timestamp()
);
create table public.shop_account_provision_commands (
  id uuid primary key default gen_random_uuid(), principal_id uuid not null references public.shop_super_admin_integrations(id),
  request_id uuid not null, job_id uuid not null references public.shop_account_provisions(id),
  body_digest text not null check(body_digest ~ '^[0-9a-f]{64}$'), envelope jsonb not null,
  action text not null check(action in ('create_and_activate','resend_invitation')),
  invitation_state text not null default 'pending' check(invitation_state in ('pending','sending','sent','claimed','unknown','failed')),
  invitation_before_at timestamptz, invitation_started_at timestamptz, result jsonb,
  created_at timestamptz not null default clock_timestamp(), unique(principal_id,request_id)
);
create table public.shop_account_provision_events (
  id uuid primary key default gen_random_uuid(), job_id uuid references public.shop_account_provisions(id),
  command_id uuid references public.shop_account_provision_commands(id), request_id uuid,
  actor jsonb not null, reason text not null, action text not null, data jsonb not null,
  occurred_at timestamptz not null default clock_timestamp()
);
alter table public.shop_account_provisions add foreign key(active_command_id) references public.shop_account_provision_commands(id);
alter table public.shop_account_provisions add foreign key(latest_invitation_command_id) references public.shop_account_provision_commands(id);
alter table public.shop_account_provisions add foreign key(last_event_id) references public.shop_account_provision_events(id);

do $$ declare name text; begin
 foreach name in array array['shop_account_provisioning_settings','shop_account_provisions','shop_account_provision_commands','shop_account_provision_events'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on public.%I from public,anon,authenticated,service_role',name);
 end loop;
end $$;
create trigger shop_account_provision_events_immutable before update or delete or truncate on public.shop_account_provision_events
 for each statement execute function shop_private.preserve_super_admin_bridge_evidence();
create function shop_private.guard_account_provision_history() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception 'ACCOUNT_HISTORY_IMMUTABLE' using errcode='55000'; end if;
 if tg_table_name='shop_account_provisions' then
  if (to_jsonb(new)-array['phase','shop_id','subscription_id','activation_audit_id','active_snapshot','lease_token','lease_until','active_command_id','latest_invitation_command_id','owner_claimed_at','last_event_id','version'])
    is distinct from (to_jsonb(old)-array['phase','shop_id','subscription_id','activation_audit_id','active_snapshot','lease_token','lease_until','active_command_id','latest_invitation_command_id','owner_claimed_at','last_event_id','version'])
    or (old.active_snapshot is not null and new.active_snapshot is distinct from old.active_snapshot)
    or (old.owner_claimed_at is not null and new.owner_claimed_at is distinct from old.owner_claimed_at)
    or (old.shop_id is not null and new.shop_id is distinct from old.shop_id)
    or (old.subscription_id is not null and new.subscription_id is distinct from old.subscription_id)
    or (old.activation_audit_id is not null and new.activation_audit_id is distinct from old.activation_audit_id) then
   raise exception 'ACCOUNT_HISTORY_IMMUTABLE' using errcode='55000'; end if;
 else
  if (to_jsonb(new)-array['invitation_state','invitation_before_at','invitation_started_at','result'])
    is distinct from (to_jsonb(old)-array['invitation_state','invitation_before_at','invitation_started_at','result'])
    or (old.result is not null and new.result is distinct from old.result) then
   raise exception 'ACCOUNT_HISTORY_IMMUTABLE' using errcode='55000'; end if;
 end if;
 return new;
end $$;
create trigger shop_account_provisions_guard before update or delete on public.shop_account_provisions
 for each row execute function shop_private.guard_account_provision_history();
create trigger shop_account_commands_guard before update or delete on public.shop_account_provision_commands
 for each row execute function shop_private.guard_account_provision_history();
create trigger shop_account_provisions_no_truncate before truncate on public.shop_account_provisions
 for each statement execute function shop_private.preserve_super_admin_bridge_evidence();
create trigger shop_account_commands_no_truncate before truncate on public.shop_account_provision_commands
 for each statement execute function shop_private.preserve_super_admin_bridge_evidence();

create function shop_private.authorize_account_envelope(p_principal uuid,p_nonce uuid,p_digest text,p_envelope jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare principal public.shop_super_admin_integrations; actor jsonb;
begin
 if auth.role() is distinct from 'service_role' or jsonb_typeof(p_envelope) is distinct from 'object'
   or p_digest !~ '^[0-9a-f]{64}$' then raise exception 'SHOP_SUPER_ADMIN_BRIDGE_REQUIRED' using errcode='42501'; end if;
 select * into principal from public.shop_super_admin_integrations where id=p_principal and enabled and retired_at is null
   and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()) for update;
 if principal.id is null or not (p_envelope->>'operation'=any(principal.allowed_operations))
   or p_envelope->>'operation' not in ('shop.account.command','shop.account.query') then
  raise exception 'SHOP_SUPER_ADMIN_CAPABILITY_DENIED' using errcode='42501'; end if;
 if (p_envelope-array['protocolVersion','operation','operationVersion','requestId','correlationId','sourceBindingId','targetBindingId','targetEnvironmentId','actor','reason','payload'])<>'{}'::jsonb
   or p_envelope->>'protocolVersion' is distinct from principal.protocol_version or p_envelope->>'operationVersion' is distinct from '1.0'
   or (p_envelope->>'sourceBindingId')::uuid is distinct from principal.source_binding_id
   or (p_envelope->>'targetBindingId')::uuid is distinct from principal.target_binding_id
   or (p_envelope->>'targetEnvironmentId')::uuid is distinct from principal.target_environment_id
   or (p_envelope->>'requestId')::uuid is null or (p_envelope->>'correlationId')::uuid is null then
  raise exception 'SHOP_SUPER_ADMIN_BINDING_MISMATCH' using errcode='42501'; end if;
 if not exists(select 1 from public.shop_super_admin_nonce_receipts where integration_principal_id=p_principal
   and nonce=p_nonce and request_id=(p_envelope->>'requestId')::uuid and body_digest=p_digest and expires_at>clock_timestamp()) then
  raise exception 'SHOP_SUPER_ADMIN_NONCE_REQUIRED' using errcode='42501'; end if;
 actor:=p_envelope->'actor';
 if jsonb_typeof(actor) is distinct from 'object' or (actor-array['authorityBindingId','subjectId','roleSnapshot','sessionId'])<>'{}'::jsonb
   or (actor->>'authorityBindingId')::uuid is distinct from principal.source_binding_id
   or (actor->>'subjectId')::uuid is null or actor->>'roleSnapshot' is distinct from 'owner'
   or jsonb_typeof(p_envelope->'payload') is distinct from 'object'
   or (p_envelope->>'operation'='shop.account.command' and (p_envelope->>'reason' is null or length(btrim(p_envelope->>'reason')) not between 8 and 1000))
   or (p_envelope->>'operation'='shop.account.query' and p_envelope->'reason' is distinct from 'null'::jsonb) then
  raise exception 'SHOP_SUPER_ADMIN_REQUEST_INVALID' using errcode='22023'; end if;
end $$;
create function shop_private.account_event(p_job uuid,p_command uuid,p_action text,p_data jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare c public.shop_account_provision_commands; event_id uuid;
begin
 select * into c from public.shop_account_provision_commands where id=p_command and job_id=p_job;
 if c.id is null then raise exception 'ACCOUNT_COMMAND_UNAVAILABLE'; end if;
 insert into public.shop_account_provision_events(job_id,command_id,request_id,actor,reason,action,data)
 values(p_job,c.id,c.request_id,c.envelope->'actor',btrim(c.envelope->>'reason'),p_action,p_data) returning id into event_id;
 update public.shop_account_provisions set last_event_id=event_id,version=version+1 where id=p_job;
end $$;
create function shop_private.account_projection(p_job uuid,p_command uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare j public.shop_account_provisions; c public.shop_account_provision_commands; confirmed boolean;
begin
 select * into j from public.shop_account_provisions where id=p_job;
 select * into c from public.shop_account_provision_commands where id=p_command and job_id=j.id;
 select email_confirmed_at is not null into confirmed from auth.users where id=j.auth_user_id;
 return jsonb_build_object('provisioningId',j.id,'phase',j.phase,'email',j.email,
   'shopId',j.shop_id,'subscriptionId',j.subscription_id,'planId',j.payload->>'planId',
   'invitationState',case when confirmed then 'claimed' else c.invitation_state end,
   'ownerVerified',coalesce(confirmed,false),'subscription',j.active_snapshot);
end $$;
create function shop_private.account_reply(p_job uuid,p_command uuid,p_replayed boolean default false)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('data',shop_private.account_projection(j.id,p_command),'replayed',p_replayed,
   'targetAuditId',j.last_event_id,'targetResultVersion',j.version) from public.shop_account_provisions j where j.id=p_job;
$$;

create function public.shop_super_admin_account_begin(p_principal_id uuid,p_nonce uuid,p_body_digest text,p_envelope jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.shop_account_provisioning_settings; j public.shop_account_provisions; c public.shop_account_provision_commands;
 v_payload jsonb; action text; terms public.plan_catalog_terms; token uuid; logical_request uuid; read_event uuid; catalog jsonb;
begin
 perform shop_private.authorize_account_envelope(p_principal_id,p_nonce,p_body_digest,p_envelope);
 select * into cfg from public.shop_account_provisioning_settings where id and enabled and invitation_ready;
 if cfg.id is null then raise exception 'ACCOUNT_PROVISIONING_UNAVAILABLE'; end if;
 v_payload:=p_envelope->'payload'; logical_request:=(p_envelope->>'requestId')::uuid;
 if p_envelope->>'operation'='shop.account.query' then
  if v_payload->>'resource'='catalog' and v_payload-'resource'='{}'::jsonb then
   perform set_config('shop.super_admin_bridge_principal_id',p_principal_id::text,true);
   catalog:=public.platform_plan_read('catalog');
   insert into public.shop_account_provision_events(request_id,actor,reason,action,data)
    values(logical_request,p_envelope->'actor','Account catalog read','catalog_read','{}') returning id into read_event;
   return jsonb_build_object('done',true,'result',jsonb_build_object('data',jsonb_build_object('plans',catalog->'items','businessModes',to_jsonb(enum_range(null::public.business_mode))),
    'targetAuditId',read_event,'targetResultVersion',1,'replayed',false));
  end if;
  if v_payload-array['resource','provisioningId']<>'{}'::jsonb or v_payload->>'resource' is distinct from 'status' then raise exception 'ACCOUNT_REQUEST_INVALID' using errcode='22023'; end if;
  select * into j from public.shop_account_provisions where id=(v_payload->>'provisioningId')::uuid and principal_id=p_principal_id;
  if j.id is null then raise exception 'ACCOUNT_REQUEST_NOT_FOUND' using errcode='42501'; end if;
  insert into public.shop_account_provision_events(job_id,request_id,actor,reason,action,data)
   values(j.id,logical_request,p_envelope->'actor','Account status read','status_read','{}') returning id into read_event;
  return jsonb_build_object('done',true,'result',shop_private.account_reply(j.id,j.latest_invitation_command_id)||jsonb_build_object('targetAuditId',read_event));
 end if;
 action:=v_payload->>'action';
 if action not in ('create_and_activate','resend_invitation') or action is null then raise exception 'ACCOUNT_REQUEST_INVALID' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_principal_id::text||':'||logical_request::text,0));
 select * into c from public.shop_account_provision_commands where principal_id=p_principal_id and request_id=logical_request for update;
 -- Qualify the request ID explicitly below to avoid variable/column ambiguity.
 if c.id is not null then
  if c.body_digest is distinct from p_body_digest or c.envelope is distinct from p_envelope then raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode='22023'; end if;
  if c.result is not null then return jsonb_build_object('done',true,'result',c.result||'{"replayed":true}'::jsonb); end if;
  select * into j from public.shop_account_provisions where id=c.job_id for update;
 else
  if action='create_and_activate' then
   if v_payload-array['action','email','displayName','shopName','businessMode','mainLocationName','planId','catalogTermsId']<>'{}'::jsonb
    or jsonb_typeof(v_payload->'email') is distinct from 'string' or v_payload->>'email'<>lower(btrim(v_payload->>'email'))
    or length(v_payload->>'email') not between 3 and 254 or v_payload->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or jsonb_typeof(v_payload->'displayName') is distinct from 'string' or length(btrim(v_payload->>'displayName')) not between 2 and 120
    or jsonb_typeof(v_payload->'shopName') is distinct from 'string' or length(btrim(v_payload->>'shopName')) not between 2 and 120
    or jsonb_typeof(v_payload->'mainLocationName') is distinct from 'string' or length(btrim(v_payload->>'mainLocationName')) not between 2 and 120
    or not (v_payload->>'businessMode'=any(enum_range(null::public.business_mode)::text[])) or v_payload->>'businessMode' is null then raise exception 'ACCOUNT_REQUEST_INVALID' using errcode='22023'; end if;
   select * into terms from shop_private.current_plan_terms((v_payload->>'planId')::uuid);
   if terms.id is distinct from (v_payload->>'catalogTermsId')::uuid or not exists(select 1 from public.plans where id=terms.plan_id and is_active and is_purchasable and not is_coming_soon) then
    raise exception 'ACCOUNT_PLAN_CHANGED' using errcode='23514'; end if;
   insert into public.shop_account_provisions(principal_id,email,payload) values(p_principal_id,v_payload->>'email',v_payload) returning * into j;
  else
   if v_payload-array['action','provisioningId','acknowledgeUncertainSend']<>'{}'::jsonb or v_payload->'acknowledgeUncertainSend' is distinct from 'true'::jsonb then
    raise exception 'ACCOUNT_REQUEST_INVALID' using errcode='22023'; end if;
   select * into j from public.shop_account_provisions where id=(v_payload->>'provisioningId')::uuid and principal_id=p_principal_id for update;
   if j.id is null or j.phase<>'active' then raise exception 'ACCOUNT_REQUEST_NOT_FOUND' using errcode='42501'; end if;
   if j.lease_until>clock_timestamp() then raise exception 'ACCOUNT_REQUEST_BUSY'; end if;
  end if;
  insert into public.shop_account_provision_commands(principal_id,request_id,job_id,body_digest,envelope,action)
  values(p_principal_id,logical_request,j.id,p_body_digest,p_envelope,action) returning * into c;
  update public.shop_account_provisions set latest_invitation_command_id=c.id where id=j.id;
  perform shop_private.account_event(j.id,c.id,action,jsonb_build_object('planId',j.payload->>'planId'));
 end if;
 if j.lease_until>clock_timestamp() then return jsonb_build_object('done',true,'result',shop_private.account_reply(j.id,c.id)); end if;
 token:=gen_random_uuid();
 update public.shop_account_provisions set lease_token=token,lease_until=clock_timestamp()+make_interval(secs=>cfg.lease_seconds),active_command_id=c.id where id=j.id;
 return jsonb_build_object('done',false,'commandId',c.id,'leaseToken',token,'jobId',j.id,'userId',j.auth_user_id,
  'email',j.email,'displayName',j.payload->>'displayName','phase',j.phase,'invitationState',c.invitation_state,
  'inviteRedirectUrl',cfg.invite_redirect_url,'authTimeoutMs',cfg.auth_timeout_ms);
exception when unique_violation then raise exception 'ACCOUNT_PROVISIONING_REQUEST_EXISTS' using errcode='23505';
end $$;

create function shop_private.create_owner_shop_for_identity(
  p_owner_user_id uuid,
  p_shop_name text,
  p_business_mode public.business_mode
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := p_owner_user_id;
  v_email text;
  v_display_name text;
  v_portal_id uuid;
  v_profile_id uuid;
  v_profile_status text;
  v_existing_shop_id uuid;
  v_shop_id uuid;
  v_trial_plan_id uuid;
  v_trial_days integer;
  v_started_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_business_mode is null then
    raise exception 'INVALID_BUSINESS_MODE' using errcode = '22023';
  end if;
  if p_shop_name is null or length(btrim(p_shop_name)) < 2
     or length(btrim(p_shop_name)) > 120 then
    raise exception 'INVALID_SHOP_NAME' using errcode = '22023';
  end if;

  select auth_user.email,
    nullif(btrim(auth_user.raw_user_meta_data ->> 'display_name'), '')
    into v_email, v_display_name
  from auth.users auth_user
  where auth_user.id = v_user_id
  for update;
  if not found then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select portal.id into v_portal_id
  from public.portals portal
  where portal.key = 'shop-crm' and portal.is_active;
  if v_portal_id is null then raise exception 'PORTAL_UNAVAILABLE'; end if;

  select profile.id, profile.status::text into v_profile_id, v_profile_status
  from public.profiles profile
  where profile.user_id = v_user_id and profile.portal_id = v_portal_id;
  if v_profile_id is null then
    insert into public.profiles (
      user_id, portal_id, display_name, email_snapshot
    ) values (
      v_user_id, v_portal_id, v_display_name, v_email
    ) returning id into v_profile_id;
  elsif v_profile_status <> 'active' then
    raise exception 'PROFILE_INACTIVE';
  end if;

  select membership.shop_id into v_existing_shop_id
  from public.shop_memberships membership
  where membership.profile_id = v_profile_id and membership.role = 'owner'
  order by membership.created_at, membership.id
  limit 1;
  if v_existing_shop_id is not null then return v_existing_shop_id; end if;
  if exists (select 1 from public.subscriptions subscription
      where subscription.profile_id = v_profile_id) then
    raise exception 'SUBSCRIPTION_REQUIRES_REVIEW';
  end if;

  select plan.id, plan.trial_days into v_trial_plan_id, v_trial_days
  from public.plans plan
  where plan.portal_id = v_portal_id
    and plan.slug = 'full-product-trial'
    and plan.is_active and not plan.is_public and not plan.is_purchasable
    and not plan.is_coming_soon and plan.trial_days = 7;
  if v_trial_plan_id is null then raise exception 'TRIAL_UNAVAILABLE'; end if;

  insert into public.shops (portal_id, name, business_mode)
  values (v_portal_id, btrim(p_shop_name), p_business_mode)
  returning id into v_shop_id;

  insert into public.shop_memberships (shop_id, profile_id, role)
  values (v_shop_id, v_profile_id, 'owner');

  insert into public.subscriptions (
    profile_id, plan_id, status, trial_start_at, trial_end_at,
    current_period_start, current_period_end, trial_consumed
  ) values (
    v_profile_id, v_trial_plan_id, 'trialing', v_started_at,
    v_started_at + v_trial_days * interval '1 day', v_started_at,
    v_started_at + v_trial_days * interval '1 day', true
  );

  return v_shop_id;
end;
$$;
revoke all on function shop_private.create_owner_shop_for_identity(uuid,text,public.business_mode) from public,anon,authenticated,service_role;
create or replace function shop_private.create_owner_shop(p_shop_name text,p_business_mode public.business_mode)
returns uuid language sql security definer set search_path='' as $$
 select shop_private.create_owner_shop_for_identity(auth.uid(),p_shop_name,p_business_mode);
$$;

create function public.shop_super_admin_account_step(p_command_id uuid,p_lease_token uuid,p_step text,p_details jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.shop_account_provisions; c public.shop_account_provision_commands; user_row auth.users; terms public.plan_catalog_terms;
 sub_id uuid; shop uuid; activation jsonb; reply jsonb; can_send boolean:=false;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVER_REQUIRED' using errcode='42501'; end if;
 select * into c from public.shop_account_provision_commands where id=p_command_id for update;
 select * into j from public.shop_account_provisions where id=c.job_id for update;
 if j.id is null or j.lease_token is distinct from p_lease_token or j.active_command_id is distinct from c.id or j.lease_until<=clock_timestamp()
  or not exists(select 1 from public.shop_super_admin_integrations where id=j.principal_id and enabled and retired_at is null
   and valid_from<=clock_timestamp() and (valid_until is null or valid_until>clock_timestamp()) and 'shop.account.command'=any(allowed_operations))
  or not exists(select 1 from public.shop_account_provisioning_settings where id and enabled and invitation_ready) then
  raise exception 'ACCOUNT_LEASE_UNAVAILABLE' using errcode='42501'; end if;
 if p_step not in ('domain','invite_start','invite_finish','release','auth_conflict') or jsonb_typeof(p_details) is distinct from 'object'
  or p_details-array['outcome','code']<>'{}'::jsonb then raise exception 'ACCOUNT_STEP_INVALID' using errcode='22023'; end if;
 select * into user_row from auth.users where id=j.auth_user_id for update;
 if p_step in ('domain','invite_start','invite_finish') and (user_row.id is null or lower(user_row.email) is distinct from j.email
  or user_row.raw_app_meta_data->>'bs_admin_provisioning_id' is distinct from j.id::text) then
  raise exception 'ACCOUNT_AUTH_OWNERSHIP_MISMATCH' using errcode='42501'; end if;
 if p_step='auth_conflict' then
  if user_row.id is not null then raise exception 'ACCOUNT_STEP_INVALID'; end if;
  update public.shop_account_provisions set phase='conflict' where id=j.id;
  perform shop_private.account_event(j.id,c.id,'auth_conflict','{}');
 elsif p_step='domain' and j.phase<>'active' then
  begin
   select * into terms from shop_private.current_plan_terms((j.payload->>'planId')::uuid);
   if terms.id is distinct from (j.payload->>'catalogTermsId')::uuid then raise exception 'ACCOUNT_PLAN_CHANGED'; end if;
   if exists(select 1 from public.profiles p join public.shop_memberships m on m.profile_id=p.id where p.user_id=j.auth_user_id and m.role='owner') then
    raise exception 'ACCOUNT_ALREADY_ONBOARDED'; end if;
   perform set_config('shop.super_admin_bridge_principal_id',j.principal_id::text,true);
   shop:=shop_private.create_owner_shop_for_identity(j.auth_user_id,j.payload->>'shopName',(j.payload->>'businessMode')::public.business_mode);
   update public.shop_locations set name=btrim(j.payload->>'mainLocationName'),updated_at=now() where shop_id=shop and is_default;
   if not found then raise exception 'SHOP_DEFAULT_LOCATION_MISSING'; end if;
   select s.id into sub_id from public.subscriptions s join public.shop_memberships m on m.profile_id=s.profile_id where m.shop_id=shop and m.role='owner';
   activation:=public.platform_plan_command(shop_private.bridge_internal_request_id(j.principal_id,c.request_id,'shop.account.command'),
    'activate_trial',btrim(c.envelope->>'reason'),(j.payload->>'planId')::uuid,shop,jsonb_build_object('subscriptionId',sub_id));
   update public.shop_account_provisions set phase='active',shop_id=shop,subscription_id=sub_id,
    activation_audit_id=(activation->>'auditId')::uuid,active_snapshot=activation->'data' where id=j.id;
   perform shop_private.account_event(j.id,c.id,'account_activated',jsonb_build_object('activationAuditId',activation->>'auditId'));
  exception when others then
   update public.shop_account_provisions set phase='review_required' where id=j.id;
   perform shop_private.account_event(j.id,c.id,'domain_requires_review',jsonb_build_object('code',case when sqlerrm='ACCOUNT_PLAN_CHANGED' then 'plan_changed' when sqlerrm='ACCOUNT_ALREADY_ONBOARDED' then 'ownership_review' else 'domain_validation_failed' end));
  end;
 elsif p_step='invite_start' then
  if j.phase<>'active' then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;
  if user_row.email_confirmed_at is not null then
   update public.shop_account_provision_commands set invitation_state='claimed' where id=c.id;
  elsif c.invitation_state in ('sending','unknown') then
   if user_row.invited_at is not null and (c.invitation_before_at is null or user_row.invited_at>c.invitation_before_at) then
    update public.shop_account_provision_commands set invitation_state='sent' where id=c.id;
   else
    update public.shop_account_provision_commands set invitation_state='unknown' where id=c.id;
   end if;
  elsif c.invitation_state='pending' then
   update public.shop_account_provision_commands set invitation_state='sending',invitation_before_at=user_row.invited_at,invitation_started_at=clock_timestamp() where id=c.id;
   can_send:=true;
  end if;
  perform shop_private.account_event(j.id,c.id,'invitation_checked',jsonb_build_object('sendAllowed',can_send));
 elsif p_step='invite_finish' then
  if c.invitation_state<>'sending' then raise exception 'ACCOUNT_STEP_INVALID'; end if;
  update public.shop_account_provision_commands set invitation_state=case
   when user_row.email_confirmed_at is not null then 'claimed'
   when user_row.invited_at is not null and (c.invitation_before_at is null or user_row.invited_at>c.invitation_before_at) then 'sent'
   else 'unknown' end where id=c.id;
  perform shop_private.account_event(j.id,c.id,'invitation_observed','{}');
 elsif p_step='release' then
  perform shop_private.account_event(j.id,c.id,'attempt_finished',jsonb_build_object('code',coalesce(p_details->>'code','complete')));
 end if;
 select * into j from public.shop_account_provisions where id=j.id;
 select * into c from public.shop_account_provision_commands where id=c.id;
 reply:=shop_private.account_reply(j.id,c.id);
 if j.phase='conflict' or (j.phase='active' and c.invitation_state in ('sent','claimed')) then
  update public.shop_account_provision_commands set result=coalesce(result,reply) where id=c.id;
 end if;
 if p_step='release' or j.phase='conflict' or (j.phase='active' and c.invitation_state in ('sent','claimed')) then
  update public.shop_account_provisions set lease_token=null,lease_until=null,active_command_id=null where id=j.id;
 end if;
 return jsonb_build_object('sendAllowed',can_send,'result',reply);
end $$;

create function public.shop_admin_provisioned_owner_claim()
returns jsonb language plpgsql security definer set search_path='' as $$
declare j public.shop_account_provisions; event_id uuid;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'VERIFIED_OWNER_REQUIRED' using errcode='42501'; end if;
 select * into j from public.shop_account_provisions where auth_user_id=auth.uid() and phase='active' for update;
 if j.id is null or not exists(select 1 from public.shop_memberships m join public.profiles p on p.id=m.profile_id where m.shop_id=j.shop_id and m.role='owner' and m.status='active' and p.user_id=auth.uid()) then
  raise exception 'VERIFIED_OWNER_REQUIRED' using errcode='42501'; end if;
 if j.owner_claimed_at is null then
  insert into public.shop_account_provision_events(job_id,actor,reason,action,data)
   values(j.id,jsonb_build_object('subjectId',auth.uid(),'authority','shop-auth'),'Owner verified invitation','owner_claimed','{}') returning id into event_id;
  update public.shop_account_provisions set owner_claimed_at=clock_timestamp(),last_event_id=event_id,version=version+1 where id=j.id;
 end if;
 return jsonb_build_object('shopId',j.shop_id,'subscription',j.active_snapshot);
end $$;

revoke all on function shop_private.guard_account_provision_history(),shop_private.authorize_account_envelope(uuid,uuid,text,jsonb),
 shop_private.account_event(uuid,uuid,text,jsonb),shop_private.account_projection(uuid,uuid),shop_private.account_reply(uuid,uuid,boolean)
 from public,anon,authenticated,service_role;
revoke all on function public.shop_super_admin_account_begin(uuid,uuid,text,jsonb),public.shop_super_admin_account_step(uuid,uuid,text,jsonb),public.shop_admin_provisioned_owner_claim() from public,anon,authenticated,service_role;
grant execute on function public.shop_super_admin_account_begin(uuid,uuid,text,jsonb),public.shop_super_admin_account_step(uuid,uuid,text,jsonb) to service_role;
grant execute on function public.shop_admin_provisioned_owner_claim() to authenticated;

do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.shop_super_admin_integrations'::regclass and pg_get_constraintdef(oid) like '%allowed_operations <@%' loop
  execute format('alter table public.shop_super_admin_integrations drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.shop_super_admin_integrations add constraint shop_super_admin_integrations_supported_operations
 check(allowed_operations <@ array['adapter.capabilities.read','shop.platform.query','shop.platform.command','shop.billing.query','shop.billing.command','shop.plan.query','shop.plan.command','shop.account.query','shop.account.command']);

create or replace function shop_private.bridge_manifest(p_principal_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  with manifest as (
    select jsonb_build_object(
      'adapterId', 'shop-suit-super-admin-bridge', 'suit', 'shop-suit',
      'targetBindingId', principal.target_binding_id,
      'targetEnvironmentId', principal.target_environment_id,
      'audience', principal.audience, 'health', 'ready',
      'manifestSchemaVersion', '1.0', 'protocolVersions', jsonb_build_array('1.0'),
      'manifestRevision', 'sas-account-provisioning-v1', 'issuedAt', clock_timestamp(),
      'capabilities', coalesce(jsonb_agg(jsonb_build_object(
        'operation', operation, 'version', '1.0',
        'kind', case when operation like '%.command' then 'command' else 'query' end,
        'idempotency', case when operation='shop.account.command' then 'staged-request-id' when operation like '%.command' then 'exact-request-id' else 'nonce-only' end,
        'members', case operation
          when 'adapter.capabilities.read' then jsonb_build_array('manifest')
          when 'shop.platform.query' then to_jsonb(array['dashboard','shops','shop','audit'])
          when 'shop.platform.command' then to_jsonb(array['suspend_shop','reactivate_shop','add_support_note'])
          when 'shop.billing.query' then to_jsonb(array['queue','configuration','summary','audit'])
          when 'shop.billing.command' then to_jsonb(array['configure_instructions','mark_under_review','approve','reject','set_price_override','register_private_offer','register_secure_private_offer','revoke_secure_private_offer'])
          when 'shop.account.query' then to_jsonb(array['status','catalog'])
          when 'shop.account.command' then to_jsonb(array['create_and_activate','resend_invitation'])
          when 'shop.plan.query' then to_jsonb(array['catalog','shop','audit'])
          when 'shop.plan.command' then to_jsonb(array['publish_terms','set_availability','change_subscription','activate_trial',
            'renew_subscription','suspend_subscription','set_price_override','remove_price_override'])
        end
      ) order by operation), '[]'::jsonb)
    ) value
    from public.shop_super_admin_integrations principal,
      unnest(principal.allowed_operations) operation
    where principal.id = p_principal_id and (operation not like 'shop.account.%' or exists(select 1 from public.shop_account_provisioning_settings where id and enabled and invitation_ready))
    group by principal.id
  )
  select value || jsonb_build_object('manifestDigest',
    pg_catalog.encode(extensions.digest(pg_catalog.convert_to(value::text, 'UTF8'), 'sha256'), 'hex'))
  from manifest;
$$;

create or replace function public.platform_plan_read(
  p_resource text default 'catalog', p_shop_id uuid default null,
  p_page integer default 1, p_page_size integer default 50
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  perform shop_private.assert_platform_admin(false);
  if p_resource not in ('catalog', 'shop', 'audit')
    or (p_resource = 'shop' and p_shop_id is null)
    or p_page is null or p_page < 1 or p_page > 100000
    or p_page_size is null or p_page_size < 1 or p_page_size > 100 then
    raise exception 'PLATFORM_PLAN_READ_INVALID' using errcode = '22023';
  end if;

  if p_resource = 'catalog' then
    select jsonb_build_object('items', coalesce(jsonb_agg(jsonb_build_object(
      'id', plan.id, 'slug', plan.slug, 'name', current_terms.display_name,
      'isActive', plan.is_active, 'isPublic', plan.is_public,
      'isPurchasable', plan.is_purchasable, 'isComingSoon', plan.is_coming_soon,
      'catalogVersion', current_terms.version, 'catalogTermsId', current_terms.id,
      'priceAmount', current_terms.price_amount, 'currency', current_terms.currency,
      'billingInterval', current_terms.billing_interval,
      'resourceLimits', current_terms.resource_limits,
      'effectiveFrom', current_terms.effective_from,
      'nextTerms', case when next_terms.id is null then null else jsonb_build_object(
        'version', next_terms.version, 'priceAmount', next_terms.price_amount,
        'currency', next_terms.currency, 'billingInterval', next_terms.billing_interval,
        'resourceLimits', next_terms.resource_limits,
        'effectiveFrom', next_terms.effective_from
      ) end,
      'subscriptionCount', (select count(*)::integer from public.subscriptions s where s.plan_id = plan.id),
      'canDelete', false
    ) order by plan.sort_order, plan.slug), '[]'::jsonb)) into v_result
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id and portal.key = 'shop-crm'
    cross join lateral shop_private.current_plan_terms(plan.id) current_terms
    left join lateral (
      select future.* from public.plan_catalog_terms future
      where future.plan_id = plan.id and future.effective_from > clock_timestamp()
      order by future.effective_from, future.version limit 1
    ) next_terms on true;
  elsif p_resource = 'shop' then
    if not exists (select 1 from public.shops shop where shop.id = p_shop_id) then
      raise exception 'PLATFORM_ADMIN_TARGET_NOT_FOUND' using errcode = '22023';
    end if;
    select jsonb_build_object(
      'subscription', shop_private.platform_plan_subscription_snapshot(p_shop_id),
      'availablePlans', coalesce(jsonb_agg(jsonb_build_object(
        'planId', plan.id, 'planSlug', plan.slug, 'planName', terms.display_name,
        'catalogTermsId', terms.id, 'billingInterval', terms.billing_interval,
        'currency', terms.currency, 'listPriceAmount', terms.price_amount,
        'resourceLimits', terms.resource_limits,
        'blockers', shop_private.plan_change_blockers(p_shop_id, terms.resource_limits)
      ) order by plan.sort_order, plan.slug), '[]'::jsonb)
    ) into v_result
    from public.plans plan
    join public.portals portal on portal.id = plan.portal_id and portal.key = 'shop-crm'
    cross join lateral shop_private.current_plan_terms(plan.id) terms
    where plan.is_active and not plan.is_coming_soon;
  else
    with rows as (
      select event.id, event.action, event.plan_id as "planId",
        event.shop_id as "shopId", shop.name as "shopName",
        event.actor_user_id as "actorUserId", event.reason,
        event.before_state as "beforeState", event.after_state as "afterState",
        event.occurred_at as "occurredAt"
      from public.platform_plan_events event
      left join public.shops shop on shop.id = event.shop_id
    ), page_rows as (
      select * from rows order by "occurredAt" desc, id
      limit p_page_size offset (p_page - 1) * p_page_size
    ) select jsonb_build_object(
      'items', coalesce((select jsonb_agg(to_jsonb(row)) from page_rows row), '[]'::jsonb),
      'total', (select count(*)::integer from rows),
      'page', p_page, 'pageSize', p_page_size
    ) into v_result;
  end if;
  return v_result;
end;
$$;
notify pgrst,'reload schema';

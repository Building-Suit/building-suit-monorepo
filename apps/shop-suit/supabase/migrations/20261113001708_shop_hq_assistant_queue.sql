begin;

create table shop_private.hq_assistant_assignments (
  actor_id uuid not null references auth.users(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  agent_id uuid not null default gen_random_uuid() unique,
  enabled boolean not null,
  consent_version integer not null check (consent_version > 0),
  generation bigint not null default 1 check (generation > 0),
  changed_at timestamptz not null default clock_timestamp(),
  primary key (actor_id, shop_id)
);

create table shop_private.hq_assistant_workers (
  auth_user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null,
  changed_at timestamptz not null default clock_timestamp()
);

create table shop_private.hq_assistant_jobs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null,
  shop_id uuid not null,
  location_id uuid not null,
  request_id uuid not null,
  consent_generation bigint not null,
  message_digest bytea not null,
  messages jsonb,
  state text not null default 'queued' check (
    state in ('queued', 'working', 'completed', 'failed', 'expired', 'revoked')
  ),
  created_at timestamptz not null,
  expires_at timestamptz not null,
  worker_id uuid references auth.users(id) on delete set null,
  lease_token uuid,
  lease_expires_at timestamptz,
  intent jsonb,
  intent_expires_at timestamptz,
  foreign key (actor_id, shop_id) references shop_private.hq_assistant_assignments(actor_id, shop_id) on delete cascade,
  foreign key (location_id, shop_id) references public.shop_locations(id, shop_id) on delete cascade,
  unique (actor_id, shop_id, request_id),
  check ((state = 'queued') = (messages is not null)),
  check (state <> 'working' or (lease_token is not null and lease_expires_at is not null)),
  check (intent is null or (state = 'completed' and intent_expires_at is not null))
);

create index hq_assistant_assignments_shop_idx on shop_private.hq_assistant_assignments(shop_id);
create index hq_assistant_jobs_actor_created_idx on shop_private.hq_assistant_jobs(actor_id, created_at);
create index hq_assistant_jobs_created_idx on shop_private.hq_assistant_jobs(created_at);
create index hq_assistant_jobs_location_idx on shop_private.hq_assistant_jobs(location_id, shop_id);
create index hq_assistant_jobs_worker_idx on shop_private.hq_assistant_jobs(worker_id) where worker_id is not null;
create index hq_assistant_jobs_active_idx on shop_private.hq_assistant_jobs(created_at)
  where state in ('queued', 'working');
create index hq_assistant_jobs_intent_idx on shop_private.hq_assistant_jobs(intent_expires_at)
  where intent is not null;

alter table shop_private.hq_assistant_assignments enable row level security;
alter table shop_private.hq_assistant_workers enable row level security;
alter table shop_private.hq_assistant_jobs enable row level security;
revoke all on table shop_private.hq_assistant_assignments, shop_private.hq_assistant_workers, shop_private.hq_assistant_jobs
  from public, anon, authenticated, service_role;

create function shop_private.hq_assistant_consent_version() returns integer
language sql immutable set search_path = ''
as $$ select 1; $$;

-- Worker and owner identities are mutually exclusive, even if membership or
-- allowlist records change after the Auth session was issued.
create function shop_private.hq_assistant_is_worker(p_actor uuid) returns boolean
language sql stable set search_path = ''
as $$
  select exists (
    select 1
    from shop_private.hq_assistant_workers worker
    join auth.users actor on actor.id = worker.auth_user_id
    where worker.auth_user_id = p_actor and worker.enabled
      and actor.email_confirmed_at is not null and actor.deleted_at is null
      and not coalesce(actor.is_anonymous, false)
      and (actor.banned_until is null or actor.banned_until <= statement_timestamp())
      and not exists (
        select 1
        from public.profiles profile
        join public.shop_memberships membership on membership.profile_id = profile.id
        where profile.user_id = actor.id and membership.removed_at is null
      )
  );
$$;

create function shop_private.hq_assistant_is_owner(p_actor uuid, p_shop uuid, p_location uuid default null)
returns boolean language sql volatile set search_path = ''
as $$
  select not exists (
    select 1 from shop_private.hq_assistant_workers worker where worker.auth_user_id = p_actor
  ) and exists (
    select 1
    from auth.users actor
    join public.profiles profile on profile.user_id = actor.id
    join public.shop_memberships membership on membership.profile_id = profile.id
    join public.shops shop on shop.id = membership.shop_id and shop.portal_id = profile.portal_id
    join public.portals portal on portal.id = shop.portal_id
    where actor.id = p_actor and actor.deleted_at is null and not coalesce(actor.is_anonymous, false)
      and (actor.banned_until is null or actor.banned_until <= statement_timestamp())
      and shop.id = p_shop and shop.status = 'active'
      and profile.status = 'active' and membership.role = 'owner' and membership.status = 'active'
      and membership.removed_at is null and portal.key = 'shop-crm' and portal.is_active
    for share of actor, profile, membership, shop, portal
  ) and (p_location is null or exists (
    select 1 from public.shop_locations location
    where location.id = p_location and location.shop_id = p_shop and location.status = 'active'
    for share
  ));
$$;

-- Serialize short queue transitions and their admission checks. Inference runs
-- after the claim transaction commits and holds no database lock.
create function shop_private.hq_assistant_queue_lock() returns void
language sql volatile set search_path = ''
as $$ select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('shop-hq-assistant-queue', 0)); $$;

create function shop_private.hq_assistant_cleanup() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_now := clock_timestamp();
  update shop_private.hq_assistant_jobs job
  set state = 'expired', messages = null, lease_token = null, lease_expires_at = null
  where (job.state = 'queued' and job.expires_at <= v_now)
    or (job.state = 'working' and job.lease_expires_at <= v_now);
  update shop_private.hq_assistant_jobs job
  set state = 'expired', intent = null, intent_expires_at = null, lease_token = null
  where job.intent is not null and job.intent_expires_at <= v_now;
  delete from shop_private.hq_assistant_jobs job where job.created_at <= v_now - interval '1 day';
end;
$$;

-- Provision from the Shop environment's SQL administration session after
-- creating a dedicated confirmed Supabase Auth user. Cleanup stays scheduled
-- when the worker is disabled so pre-existing requests still expire.
create function shop_private.register_shop_hq_assistant_worker(p_auth_user_id uuid, p_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform shop_private.hq_assistant_queue_lock();
  if p_enabled is false then
    update shop_private.hq_assistant_workers
      set enabled = false, changed_at = clock_timestamp() where auth_user_id = p_auth_user_id;
    update shop_private.hq_assistant_jobs job
      set state = 'failed', lease_token = null, lease_expires_at = null
      where job.worker_id = p_auth_user_id and job.state = 'working';
    return;
  end if;
  if p_enabled is null or not exists (
    select 1 from auth.users actor
    where actor.id = p_auth_user_id and actor.email_confirmed_at is not null and actor.deleted_at is null
      and not coalesce(actor.is_anonymous, false)
      and (actor.banned_until is null or actor.banned_until <= statement_timestamp())
      and not exists (
        select 1 from public.profiles profile
        join public.shop_memberships membership on membership.profile_id = profile.id
        where profile.user_id = actor.id
      )
  ) then
    raise exception 'SHOP_HQ_ASSISTANT_TECHNICAL_ACCOUNT_REQUIRED' using errcode = '22023';
  end if;

  insert into shop_private.hq_assistant_workers (auth_user_id, enabled) values (p_auth_user_id, p_enabled)
  on conflict (auth_user_id) do update set enabled = excluded.enabled, changed_at = clock_timestamp();
  perform cron.schedule('shop-hq-assistant-cleanup', '* * * * *', 'select shop_private.hq_assistant_cleanup();');
end;
$$;

create function public.shop_hq_assistant_can_receive() returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.jwt()->>'is_anonymous', 'false') <> 'true'
    and shop_private.hq_assistant_is_worker(auth.uid());
$$;

create policy shop_hq_assistant_receive on realtime.messages for select to authenticated
  using (extension = 'broadcast' and topic = 'shop-hq-assistant-jobs'
    and topic = (select realtime.topic()) and (select public.shop_hq_assistant_can_receive()));
create policy shop_hq_assistant_receive_guard on realtime.messages as restrictive for select to authenticated
  using (case when topic = 'shop-hq-assistant-jobs' or (select realtime.topic()) = 'shop-hq-assistant-jobs'
    then extension = 'broadcast' and topic = 'shop-hq-assistant-jobs'
      and topic = (select realtime.topic()) and (select public.shop_hq_assistant_can_receive()) else true end);
create policy shop_hq_assistant_no_anon_receive on realtime.messages as restrictive for select to anon
  using (topic <> 'shop-hq-assistant-jobs' and coalesce((select realtime.topic()), '') <> 'shop-hq-assistant-jobs');
create policy shop_hq_assistant_no_client_send on realtime.messages as restrictive for insert to public
  with check (topic <> 'shop-hq-assistant-jobs' and coalesce((select realtime.topic()), '') <> 'shop-hq-assistant-jobs');

create function public.shop_hq_assistant_access(p_shop_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
    or not shop_private.hq_assistant_is_owner(auth.uid(), p_shop_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  return jsonb_build_object('agentName', 'Shop Suit Agent', 'enabled', exists (
    select 1 from shop_private.hq_assistant_assignments assignment
    where assignment.actor_id = auth.uid() and assignment.shop_id = p_shop_id
      and assignment.enabled and assignment.consent_version = shop_private.hq_assistant_consent_version()
  ));
end;
$$;

create function public.shop_hq_assistant_authorize(p_shop_id uuid, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_version integer := shop_private.hq_assistant_consent_version();
begin
  perform shop_private.hq_assistant_queue_lock();
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
    or not shop_private.hq_assistant_is_owner(v_actor, p_shop_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  if p_enabled is null then
    raise exception 'SHOP_HQ_ASSISTANT_CONSENT_REQUIRED' using errcode = '22023';
  end if;

  insert into shop_private.hq_assistant_assignments as assignment (actor_id, shop_id, enabled, consent_version)
    values (v_actor, p_shop_id, p_enabled, v_version)
  on conflict (actor_id, shop_id) do update
    set enabled = excluded.enabled, consent_version = excluded.consent_version,
      generation = assignment.generation + 1, changed_at = clock_timestamp()
    where (assignment.enabled, assignment.consent_version) is distinct from (excluded.enabled, excluded.consent_version);
  update shop_private.hq_assistant_jobs job
  set state = 'revoked', messages = null, intent = null, intent_expires_at = null,
    lease_token = null, lease_expires_at = null
  from shop_private.hq_assistant_assignments assignment
  where job.actor_id = v_actor and job.shop_id = p_shop_id
    and assignment.actor_id = v_actor and assignment.shop_id = p_shop_id
    and (not assignment.enabled or job.consent_generation <> assignment.generation)
    and job.state in ('queued', 'working', 'completed');
  return jsonb_build_object('agentName', 'Shop Suit Agent', 'enabled', p_enabled);
end;
$$;

create function public.shop_hq_assistant_enqueue(p_shop_id uuid, p_location_id uuid, p_request_id uuid, p_messages jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_generation bigint;
  v_count integer;
  v_digest bytea;
  v_now timestamptz;
  v_job shop_private.hq_assistant_jobs%rowtype;
begin
  perform shop_private.hq_assistant_queue_lock();
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' or p_location_id is null
    or not shop_private.hq_assistant_is_owner(v_actor, p_shop_id, p_location_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;

  select assignment.generation into v_generation
  from shop_private.hq_assistant_assignments assignment
  where assignment.actor_id = v_actor and assignment.shop_id = p_shop_id and assignment.enabled
    and assignment.consent_version = shop_private.hq_assistant_consent_version();
  if not found then
    raise exception 'SHOP_HQ_ASSISTANT_CONSENT_REQUIRED' using errcode = '42501';
  end if;

  if p_request_id is null or jsonb_typeof(p_messages) is distinct from 'array'
    or octet_length(p_messages::text) > 32768 then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_MESSAGES' using errcode = '22023';
  end if;
  v_count := jsonb_array_length(p_messages);
  if v_count not between 1 and 12
    or p_messages->(v_count - 1)->>'role' is distinct from 'user'
    or exists (
      select 1 from jsonb_array_elements(p_messages) as item(value)
      where jsonb_typeof(item.value) <> 'object' or not (item.value ?& array['role', 'content'])
        or case when jsonb_typeof(item.value) = 'object' then
          (item.value - array['role', 'content']) <> '{}'::jsonb else true end
        or coalesce(item.value->>'role', '') not in ('user', 'assistant')
        or jsonb_typeof(item.value->'content') is distinct from 'string'
        or (item.value->>'content') !~ '[^[:space:]]' or octet_length(item.value->>'content') > 2000
    ) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_MESSAGES' using errcode = '22023';
  end if;

  v_digest := extensions.digest(convert_to(p_request_id::text || p_messages::text, 'UTF8'), 'sha256');
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.actor_id = v_actor and job.shop_id = p_shop_id and job.request_id = p_request_id;
  if found then
    if (v_job.location_id, v_job.consent_generation, v_job.message_digest)
      is distinct from (p_location_id, v_generation, v_digest) then
      raise exception 'SHOP_HQ_ASSISTANT_REQUEST_CONFLICT' using errcode = '23505';
    end if;
    return jsonb_build_object('jobId', v_job.id);
  end if;

  if not exists (
    select 1 from shop_private.hq_assistant_workers worker
    where worker.enabled and shop_private.hq_assistant_is_worker(worker.auth_user_id)
  ) then
    raise exception 'SHOP_HQ_ASSISTANT_NO_WORKER' using errcode = '55000';
  end if;
  perform shop_private.hq_assistant_cleanup();
  v_now := clock_timestamp();
  if exists (
    select 1 from shop_private.hq_assistant_jobs job
    where job.actor_id = v_actor and job.state in ('queued', 'working')
  ) or (
    select count(*) from shop_private.hq_assistant_jobs job
    where job.actor_id = v_actor and job.created_at > v_now - interval '1 minute'
  ) >= 12 or (
    select count(*) from shop_private.hq_assistant_jobs job where job.state in ('queued', 'working')
  ) >= 32 then
    raise exception 'SHOP_HQ_ASSISTANT_CAPACITY' using errcode = '54000';
  end if;

  insert into shop_private.hq_assistant_jobs
    (actor_id, shop_id, location_id, request_id, consent_generation, message_digest, messages, created_at, expires_at)
  values (v_actor, p_shop_id, p_location_id, p_request_id, v_generation, v_digest, p_messages, v_now, v_now + interval '2 minutes')
  returning * into v_job;
  perform realtime.send('{}'::jsonb, 'jobs', 'shop-hq-assistant-jobs', true);
  return jsonb_build_object('jobId', v_job.id);
end;
$$;

create function public.shop_hq_assistant_job(p_shop_id uuid, p_location_id uuid, p_job_id uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_job shop_private.hq_assistant_jobs%rowtype;
  v_now timestamptz;
begin
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' or p_location_id is null
    or not shop_private.hq_assistant_is_owner(v_actor, p_shop_id, p_location_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.id = p_job_id and job.actor_id = v_actor and job.shop_id = p_shop_id and job.location_id = p_location_id;
  if not found then
    raise exception 'SHOP_HQ_ASSISTANT_JOB_UNAVAILABLE' using errcode = '42501';
  end if;
  if v_job.state = 'revoked' or not exists (
    select 1 from shop_private.hq_assistant_assignments assignment
    where assignment.actor_id = v_actor and assignment.shop_id = p_shop_id and assignment.enabled
      and assignment.generation = v_job.consent_generation
      and assignment.consent_version = shop_private.hq_assistant_consent_version()
  ) then
    return jsonb_build_object('state', 'revoked');
  end if;
  v_now := clock_timestamp();
  if (v_job.state = 'queued' and v_job.expires_at <= v_now)
    or (v_job.state = 'working' and v_job.lease_expires_at <= v_now)
    or (v_job.state = 'completed' and v_job.intent_expires_at <= v_now) then
    return jsonb_build_object('state', 'expired');
  end if;
  if v_job.state = 'completed' then
    return jsonb_build_object('state', v_job.state, 'intent', v_job.intent);
  end if;
  return jsonb_build_object('state', v_job.state);
end;
$$;

create function public.shop_hq_assistant_claim() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid := auth.uid();
  v_job shop_private.hq_assistant_jobs%rowtype;
  v_token uuid;
begin
  perform shop_private.hq_assistant_queue_lock();
  if not public.shop_hq_assistant_can_receive() then
    raise exception 'SHOP_HQ_ASSISTANT_WORKER_REQUIRED' using errcode = '42501';
  end if;
  perform shop_private.hq_assistant_cleanup();
  for v_job in
    select * from shop_private.hq_assistant_jobs job where job.state = 'queued' order by job.created_at, job.id
  loop
    if not exists (
      select 1 from shop_private.hq_assistant_assignments assignment
      where assignment.actor_id = v_job.actor_id and assignment.shop_id = v_job.shop_id and assignment.enabled
        and assignment.generation = v_job.consent_generation
        and assignment.consent_version = shop_private.hq_assistant_consent_version()
    ) or not shop_private.hq_assistant_is_owner(v_job.actor_id, v_job.shop_id, v_job.location_id) then
      update shop_private.hq_assistant_jobs job set state = 'revoked', messages = null where job.id = v_job.id;
      continue;
    end if;

    if v_job.expires_at <= clock_timestamp() then
      update shop_private.hq_assistant_jobs job set state = 'expired', messages = null where job.id = v_job.id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update shop_private.hq_assistant_jobs job
    set state = 'working', messages = null, worker_id = v_worker, lease_token = v_token,
      lease_expires_at = least(v_job.expires_at, clock_timestamp() + interval '60 seconds')
    where job.id = v_job.id;
    return jsonb_build_object('jobId', v_job.id, 'leaseToken', v_token, 'messages', v_job.messages);
  end loop;
  return null;
end;
$$;

create function shop_private.hq_assistant_valid_intent(p_intent jsonb) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_keys constant text[] := array['kind', 'customerName', 'services', 'paymentMethod', 'reply'];
begin
  if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text) > 8192 then
    return false;
  end if;
  if not (p_intent ?& v_keys) or (p_intent - v_keys) <> '{}'::jsonb
    or jsonb_typeof(p_intent->'reply') is distinct from 'string'
    or length(btrim(p_intent->>'reply')) not between 1 and 1000
    or length(p_intent->>'reply') > 1000
    or jsonb_typeof(p_intent->'services') is distinct from 'array' then
    return false;
  end if;
  if p_intent->>'kind' = 'reply' then
    return p_intent->'customerName' = 'null'::jsonb and p_intent->'services' = '[]'::jsonb
      and p_intent->'paymentMethod' = 'null'::jsonb;
  end if;
  return coalesce(p_intent->>'kind' = 'service_sale', false)
    and jsonb_typeof(p_intent->'customerName') = 'string'
    and length(btrim(p_intent->>'customerName')) between 2 and 160
    and length(p_intent->>'customerName') <= 160
    and (p_intent->'paymentMethod' = 'null'::jsonb or coalesce(p_intent->>'paymentMethod', '') in ('cash', 'card', 'transfer'))
    and jsonb_array_length(p_intent->'services') between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(p_intent->'services') as item(value)
      where jsonb_typeof(item.value) <> 'string' or length(btrim(item.value #>> '{}')) not between 2 and 120
        or length(item.value #>> '{}') > 120
    );
end;
$$;

create function public.shop_hq_assistant_finish(p_job_id uuid, p_lease_token uuid, p_intent jsonb, p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  v_worker uuid := auth.uid();
  v_job shop_private.hq_assistant_jobs%rowtype;
begin
  perform shop_private.hq_assistant_queue_lock();
  if not public.shop_hq_assistant_can_receive() then
    raise exception 'SHOP_HQ_ASSISTANT_WORKER_REQUIRED' using errcode = '42501';
  end if;
  if p_succeeded is null or (p_succeeded and not shop_private.hq_assistant_valid_intent(p_intent))
    or (not p_succeeded and p_intent is not null and p_intent <> 'null'::jsonb) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_RESULT' using errcode = '22023';
  end if;

  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.id = p_job_id and job.worker_id = v_worker and job.lease_token = p_lease_token
    and job.state in ('working', 'completed', 'failed');
  if not found then return false; end if;
  if not exists (
    select 1 from shop_private.hq_assistant_assignments assignment
    where assignment.actor_id = v_job.actor_id and assignment.shop_id = v_job.shop_id and assignment.enabled
      and assignment.generation = v_job.consent_generation
      and assignment.consent_version = shop_private.hq_assistant_consent_version()
  ) or not shop_private.hq_assistant_is_owner(v_job.actor_id, v_job.shop_id, v_job.location_id) then
    update shop_private.hq_assistant_jobs job
    set state = 'revoked', intent = null, intent_expires_at = null, lease_token = null, lease_expires_at = null
    where job.id = p_job_id;
    return false;
  end if;
  if v_job.state = 'completed' then return p_succeeded and v_job.intent = p_intent; end if;
  if v_job.state = 'failed' then return not p_succeeded; end if;

  if v_job.lease_expires_at <= clock_timestamp() then
    update shop_private.hq_assistant_jobs job
    set state = 'expired', lease_token = null, lease_expires_at = null where job.id = p_job_id;
    return false;
  end if;
  update shop_private.hq_assistant_jobs job
  set state = case when p_succeeded then 'completed' else 'failed' end,
    intent = case when p_succeeded then p_intent end,
    intent_expires_at = case when p_succeeded then clock_timestamp() + interval '15 minutes' end,
    lease_expires_at = null
  where job.id = p_job_id;
  return true;
end;
$$;

revoke all on function shop_private.hq_assistant_consent_version(),
  shop_private.hq_assistant_is_worker(uuid), shop_private.hq_assistant_is_owner(uuid, uuid, uuid),
  shop_private.hq_assistant_queue_lock(), shop_private.hq_assistant_cleanup(),
  shop_private.register_shop_hq_assistant_worker(uuid, boolean), shop_private.hq_assistant_valid_intent(jsonb)
from public, anon, authenticated, service_role;

revoke all on function public.shop_hq_assistant_can_receive(), public.shop_hq_assistant_access(uuid),
  public.shop_hq_assistant_authorize(uuid, boolean), public.shop_hq_assistant_enqueue(uuid, uuid, uuid, jsonb),
  public.shop_hq_assistant_job(uuid, uuid, uuid), public.shop_hq_assistant_claim(),
  public.shop_hq_assistant_finish(uuid, uuid, jsonb, boolean)
from public, anon, authenticated, service_role;

grant execute on function public.shop_hq_assistant_can_receive(), public.shop_hq_assistant_access(uuid),
  public.shop_hq_assistant_authorize(uuid, boolean), public.shop_hq_assistant_enqueue(uuid, uuid, uuid, jsonb),
  public.shop_hq_assistant_job(uuid, uuid, uuid), public.shop_hq_assistant_claim(),
  public.shop_hq_assistant_finish(uuid, uuid, jsonb, boolean)
to authenticated;

notify pgrst, 'reload schema';
commit;

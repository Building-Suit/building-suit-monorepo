begin;

create or replace function shop_private.hq_assistant_consent_version() returns integer
language sql immutable set search_path = ''
as $$ select 2; $$;

-- One reusable employee per Shop. Consent stays bound to the owner's Auth
-- identity and its current Shop membership, independently of staffing.
create table shop_private.hq_assistant_employees (
  shop_id uuid primary key references public.shops(id) on delete cascade,
  id uuid not null default gen_random_uuid() unique
);
create table shop_private.hq_assistant_department (
  singleton boolean primary key default true check (singleton),
  head_id uuid not null default gen_random_uuid() unique
);
insert into shop_private.hq_assistant_department default values;

alter table shop_private.hq_assistant_employees enable row level security;
alter table shop_private.hq_assistant_department enable row level security;
revoke all on table shop_private.hq_assistant_employees, shop_private.hq_assistant_department
from public, anon, authenticated, service_role;

insert into shop_private.hq_assistant_employees (shop_id) select id from public.shops;
create function shop_private.hq_assistant_roster_changed() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into shop_private.hq_assistant_employees (shop_id) values (new.id) on conflict (shop_id) do nothing;
    if new.status <> 'active' then return null; end if;
  elsif tg_op = 'DELETE' then
    if old.status <> 'active' then return null; end if;
  elsif (old.status = 'active') = (new.status = 'active') and (
    new.status <> 'active' or (old.name, old.portal_id) is not distinct from (new.name, new.portal_id)
  ) then
    return null;
  end if;
  perform realtime.send('{}'::jsonb, 'staff', 'shop-hq-assistant-jobs', true);
  return null;
end;
$$;
create trigger shop_hq_assistant_roster_changed
after insert or update of name, status, portal_id or delete on public.shops
for each row execute function shop_private.hq_assistant_roster_changed();

alter table shop_private.hq_assistant_workers
  add column queue_enabled boolean not null default false,
  add constraint hq_assistant_workers_queue_requires_registration check (enabled or not queue_enabled);

alter table shop_private.hq_assistant_jobs
  add column employee_id uuid references shop_private.hq_assistant_employees(id) on delete cascade,
  add column stage text not null default 'waiting'
    check (stage in ('waiting','assigned','employee','sale_pending','review_pending','reviewing','fix_pending','closed')),
  add column context_messages jsonb,
  add column owner_message text,
  add column transcript_expires_at timestamptz,
  add column updates jsonb not null default '[]'::jsonb,
  add column feedback text,
  add column review_recovery_count integer not null default 0 check (review_recovery_count in (0,1)),
  add column fix_count integer not null default 0 check (fix_count in (0,1)),
  add column employee_finish_worker uuid,
  add column employee_finish_token uuid,
  add column employee_finish_digest bytea,
  add column sale_attempts jsonb not null default '[]'::jsonb,
  add column review_finish_worker uuid,
  add column review_finish_token uuid,
  add column review_finish_digest bytea;

-- The earlier preview had no workforce or review contract. Preserve its
-- terminal idempotency receipts while clearing payloads that cannot migrate.
update shop_private.hq_assistant_jobs
set stage = 'closed', state = case when state in ('queued','working','completed') then 'expired' else state end,
  messages = null, intent = null, intent_expires_at = null, lease_token = null, lease_expires_at = null;

create unique index hq_assistant_one_active_per_employee_idx
on shop_private.hq_assistant_jobs (employee_id) where employee_id is not null and stage <> 'closed';
create index hq_assistant_jobs_stage_idx on shop_private.hq_assistant_jobs(stage, created_at)
where stage <> 'closed';
create index hq_assistant_jobs_recent_idx on shop_private.hq_assistant_jobs(actor_id, shop_id, location_id, created_at desc);

create function shop_private.hq_assistant_signal_owner(p_job_id uuid) returns void
language sql volatile set search_path = ''
as $$ select realtime.send('{}'::jsonb, 'reply', 'shop-hq-assistant-owner:' || p_job_id::text, true); $$;

create function shop_private.hq_assistant_signal_staff() returns void
language sql volatile set search_path = ''
as $$ select realtime.send('{}'::jsonb, 'jobs', 'shop-hq-assistant-jobs', true); $$;

create function shop_private.hq_assistant_current_consent(p_job shop_private.hq_assistant_jobs) returns boolean
language sql volatile set search_path = ''
as $$
  select shop_private.hq_assistant_is_owner(p_job.actor_id, p_job.shop_id, p_job.location_id)
    and exists (
      select 1 from shop_private.hq_assistant_assignments assignment
      where assignment.actor_id = p_job.actor_id and assignment.shop_id = p_job.shop_id and assignment.enabled
        and assignment.generation = p_job.consent_generation
        and assignment.consent_version = shop_private.hq_assistant_consent_version()
    );
$$;

create function shop_private.hq_assistant_latest_action(p_updates jsonb) returns jsonb
language sql immutable set search_path = ''
as $$
  select action.value from jsonb_array_elements(p_updates) with ordinality as action(value, sequence)
  where action.value->>'kind' in ('receipt','clarification')
  order by action.sequence desc limit 1;
$$;

create function shop_private.hq_assistant_append_update(p_job_id uuid, p_update jsonb) returns void
language sql volatile set search_path = ''
as $$
  update shop_private.hq_assistant_jobs job
  set updates = job.updates || jsonb_build_array(
    p_update || jsonb_build_object('sequence', jsonb_array_length(job.updates) + 1)
  )
  where job.id = p_job_id;
$$;

create or replace function shop_private.hq_assistant_cleanup() returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_now timestamptz;
  v_job shop_private.hq_assistant_jobs%rowtype;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_now := clock_timestamp();
  for v_job in
    select * from shop_private.hq_assistant_jobs job
    where job.stage <> 'closed'
      and (job.state in ('failed','revoked') or job.expires_at <= v_now
        or (job.stage in ('employee','sale_pending','reviewing') and job.lease_expires_at <= v_now))
  loop
    if v_job.stage = 'sale_pending' then
      perform shop_private.hq_assistant_append_update(v_job.id,
        '{"kind":"clarification","outcome":{"kind":"sale_unavailable"}}'::jsonb);
    end if;
    if (v_job.stage = 'sale_pending' or (v_job.stage = 'reviewing' and v_job.review_recovery_count = 0))
      and v_job.expires_at > v_now and v_job.state = 'completed' then
      update shop_private.hq_assistant_jobs set stage = 'review_pending', worker_id = null,
        review_recovery_count = case when v_job.stage = 'reviewing' then 1 else review_recovery_count end,
        lease_token = null, lease_expires_at = null where id = v_job.id;
    else
      update shop_private.hq_assistant_jobs
      set stage = 'closed', state = case when state in ('queued','working') then 'expired' else state end,
        messages = null, context_messages = null, feedback = null, lease_token = null, lease_expires_at = null
      where id = v_job.id;
    end if;
    perform shop_private.hq_assistant_signal_owner(v_job.id);
    perform shop_private.hq_assistant_signal_staff();
  end loop;
  update shop_private.hq_assistant_jobs job
  set state = case when state = 'revoked' then state else 'expired' end,
    stage = 'closed', messages = null, context_messages = null, owner_message = null,
    updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, feedback = null, intent = null, intent_expires_at = null,
    lease_token = null, lease_expires_at = null, transcript_expires_at = null
  where job.transcript_expires_at <= v_now;
  delete from shop_private.hq_assistant_jobs job where job.created_at <= v_now - interval '1 day';
end;
$$;

-- Reuse the existing validated, rate-limited admission operation. Its original
-- implementation and ACL remain private after renaming.
alter function public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb) set schema shop_private;
alter function shop_private.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb) rename to hq_assistant_enqueue_validated;
revoke all on function shop_private.hq_assistant_enqueue_validated(uuid,uuid,uuid,jsonb)
from public, anon, authenticated, service_role;

create function public.shop_hq_assistant_enqueue(p_shop_id uuid,p_location_id uuid,p_request_id uuid,p_messages jsonb)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_receipt jsonb;
begin
  v_receipt := shop_private.hq_assistant_enqueue_validated(p_shop_id,p_location_id,p_request_id,p_messages);
  if not exists (
    select 1 from shop_private.hq_assistant_workers worker
    where worker.queue_enabled and shop_private.hq_assistant_is_worker(worker.auth_user_id)
  ) then
    raise exception 'SHOP_HQ_ASSISTANT_QUEUE_DISABLED' using errcode = '55000';
  end if;
  update shop_private.hq_assistant_jobs job
  set owner_message = p_messages->-1->>'content', transcript_expires_at = job.created_at + interval '15 minutes'
  where job.id = (v_receipt->>'jobId')::uuid and job.state = 'queued' and job.stage = 'waiting'
    and job.transcript_expires_at is null;
  if found and (select count(*) from shop_private.hq_assistant_jobs job where job.stage <> 'closed') > 32 then
    raise exception 'SHOP_HQ_ASSISTANT_CAPACITY' using errcode = '54000';
  end if;
  return v_receipt;
end;
$$;

create or replace function public.shop_hq_assistant_authorize(p_shop_id uuid, p_enabled boolean) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_version integer := shop_private.hq_assistant_consent_version();
  v_job_id uuid;
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

  for v_job_id in
    update shop_private.hq_assistant_jobs job
    set state = 'revoked', stage = 'closed', messages = null, context_messages = null, owner_message = null,
      updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, feedback = null, intent = null,
      intent_expires_at = null, transcript_expires_at = null,
      lease_token = null, lease_expires_at = null
    from shop_private.hq_assistant_assignments assignment
    where job.actor_id = v_actor and job.shop_id = p_shop_id
      and assignment.actor_id = v_actor and assignment.shop_id = p_shop_id
      and (not assignment.enabled or job.consent_generation <> assignment.generation)
      and (job.stage <> 'closed' or job.transcript_expires_at is not null)
    returning job.id
  loop
    perform shop_private.hq_assistant_signal_owner(v_job_id);
    perform shop_private.hq_assistant_signal_staff();
  end loop;
  return jsonb_build_object('agentName', 'Shop Suit Agent', 'enabled', p_enabled);
end;
$$;

create function shop_private.hq_assistant_owner_projection(p_job shop_private.hq_assistant_jobs) returns jsonb
language plpgsql volatile set search_path = ''
as $$
declare v_now timestamptz := clock_timestamp();
begin
  if p_job.state = 'revoked' or not shop_private.hq_assistant_current_consent(p_job) then
    return '{"state":"revoked","updates":[],"reviewPending":false}'::jsonb;
  end if;
  if p_job.state = 'expired' or p_job.transcript_expires_at <= v_now
    or (p_job.state = 'queued' and p_job.expires_at <= v_now)
    or (p_job.state = 'working' and p_job.lease_expires_at <= v_now) then
    return '{"state":"expired","updates":[],"reviewPending":false}'::jsonb;
  end if;
  return jsonb_build_object(
    'state', case when p_job.stage = 'sale_pending' then 'working' else p_job.state end,
    'updates', p_job.updates, 'reviewPending', p_job.state = 'completed' and p_job.stage <> 'closed' and p_job.expires_at > v_now);
end;
$$;

create or replace function public.shop_hq_assistant_job(p_shop_id uuid,p_location_id uuid,p_job_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_job shop_private.hq_assistant_jobs%rowtype;
begin
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' or p_location_id is null
    or not shop_private.hq_assistant_is_owner(auth.uid(), p_shop_id, p_location_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.id = p_job_id and job.actor_id = auth.uid() and job.shop_id = p_shop_id and job.location_id = p_location_id;
  if not found then
    raise exception 'SHOP_HQ_ASSISTANT_JOB_UNAVAILABLE' using errcode = '42501';
  end if;
  return shop_private.hq_assistant_owner_projection(v_job);
end;
$$;

create function public.shop_hq_assistant_recent(p_shop_id uuid,p_location_id uuid)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_result jsonb;
begin
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' or p_location_id is null
    or not shop_private.hq_assistant_is_owner(auth.uid(), p_shop_id, p_location_id) then
    raise exception 'SHOP_HQ_ASSISTANT_OWNER_REQUIRED' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(
    jsonb_build_object('jobId', job.id, 'requestId', job.request_id, 'ownerMessage', job.owner_message)
    || shop_private.hq_assistant_owner_projection(job)
    order by job.created_at, job.id
  ), '[]'::jsonb) into v_result
  from shop_private.hq_assistant_jobs job
  where job.id in (
    select recent.id from shop_private.hq_assistant_jobs recent
    join shop_private.hq_assistant_assignments assignment
      on assignment.actor_id = recent.actor_id and assignment.shop_id = recent.shop_id
    where recent.actor_id = auth.uid() and recent.shop_id = p_shop_id and recent.location_id = p_location_id
      and recent.transcript_expires_at > clock_timestamp() and recent.state <> 'revoked'
      and assignment.enabled and assignment.generation = recent.consent_generation
      and assignment.consent_version = shop_private.hq_assistant_consent_version()
    order by recent.created_at desc, recent.id desc limit 20
  );
  return v_result;
end;
$$;

create function public.shop_hq_assistant_can_receive_owner(p_topic text) returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_job shop_private.hq_assistant_jobs%rowtype;
begin
  if coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true'
    or coalesce(p_topic,'') !~ '^shop-hq-assistant-owner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.id = split_part(p_topic, ':', 2)::uuid and job.actor_id = auth.uid()
    and job.state <> 'revoked' and job.transcript_expires_at > clock_timestamp();
  return found and shop_private.hq_assistant_current_consent(v_job);
end;
$$;

create policy shop_hq_assistant_owner_receive on realtime.messages for select to authenticated
using (extension = 'broadcast' and topic = (select realtime.topic())
  and public.shop_hq_assistant_can_receive_owner(topic));
create policy shop_hq_assistant_owner_guard on realtime.messages as restrictive for select to authenticated
using (case when topic like 'shop-hq-assistant-owner:%' or (select realtime.topic()) like 'shop-hq-assistant-owner:%'
  then extension = 'broadcast' and topic = (select realtime.topic())
    and public.shop_hq_assistant_can_receive_owner(topic) else true end);
create policy shop_hq_assistant_owner_no_anon on realtime.messages as restrictive for select to anon
using (topic not like 'shop-hq-assistant-owner:%' and coalesce((select realtime.topic()), '') not like 'shop-hq-assistant-owner:%');
create policy shop_hq_assistant_owner_no_send on realtime.messages as restrictive for insert to public
with check (topic not like 'shop-hq-assistant-owner:%' and coalesce((select realtime.topic()), '') not like 'shop-hq-assistant-owner:%');

create function shop_private.hq_assistant_require_worker() returns uuid
language plpgsql volatile set search_path = ''
as $$
begin
  if not public.shop_hq_assistant_can_receive() then
    raise exception 'SHOP_HQ_ASSISTANT_WORKER_REQUIRED' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create function shop_private.hq_assistant_require_queue_worker() returns uuid
language plpgsql volatile set search_path = ''
as $$
declare v_worker uuid := shop_private.hq_assistant_require_worker();
begin
  if not exists (
    select 1 from shop_private.hq_assistant_workers worker
    where worker.auth_user_id = v_worker and worker.queue_enabled
  ) then
    raise exception 'SHOP_HQ_ASSISTANT_QUEUE_DISABLED' using errcode = '42501';
  end if;
  return v_worker;
end;
$$;

create function public.shop_hq_assistant_dispatch() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_job shop_private.hq_assistant_jobs%rowtype; v_employee uuid;
begin
  perform shop_private.hq_assistant_queue_lock();
  perform shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  for v_job in
    select job.* from shop_private.hq_assistant_jobs job
    join shop_private.hq_assistant_employees employee on employee.shop_id = job.shop_id
    where job.stage = 'waiting' and not exists (
      select 1 from shop_private.hq_assistant_jobs busy
      where busy.employee_id = employee.id and busy.stage <> 'closed'
    )
    order by job.created_at, job.id
  loop
    if not shop_private.hq_assistant_current_consent(v_job) then
      update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed',
        messages = null, owner_message = null, transcript_expires_at = null where id = v_job.id;
      continue;
    end if;
    select id into v_employee from shop_private.hq_assistant_employees where shop_id = v_job.shop_id;
    update shop_private.hq_assistant_jobs set employee_id = v_employee, stage = 'assigned' where id = v_job.id;
    return jsonb_build_object('jobId', v_job.id, 'employeeId', v_employee,
      'employeeTemplate', 'shop-suit-agent-v1', 'headAgentId', 'AG-SHOP-001',
      'headId', (select head_id from shop_private.hq_assistant_department));
  end loop;
  return null;
end;
$$;

create or replace function public.shop_hq_assistant_claim() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_token uuid;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  for v_job in
    select * from shop_private.hq_assistant_jobs job
    where job.stage in ('assigned','fix_pending') order by job.created_at, job.id
  loop
    if not shop_private.hq_assistant_current_consent(v_job) then
      update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed', messages = null,
        context_messages = null, owner_message = null, updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, intent = null,
        intent_expires_at = null, transcript_expires_at = null, feedback = null where id = v_job.id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update shop_private.hq_assistant_jobs set stage = 'employee',
      state = case when state = 'queued' then 'working' else state end,
      context_messages = coalesce(context_messages, messages), messages = null,
      worker_id = v_worker, lease_token = v_token,
      expires_at = case when v_job.stage = 'assigned' then clock_timestamp() + interval '5 minutes' else expires_at end,
      lease_expires_at = case when v_job.stage = 'assigned' then clock_timestamp() + interval '60 seconds'
        else least(expires_at, clock_timestamp() + interval '60 seconds') end
    where id = v_job.id;
    perform shop_private.hq_assistant_signal_owner(v_job.id);
    return jsonb_build_object('jobId', v_job.id, 'leaseToken', v_token, 'employeeId', v_job.employee_id,
      'employeeTemplate', 'shop-suit-agent-v1', 'messages', coalesce(v_job.context_messages, v_job.messages),
      'feedback', v_job.feedback, 'outcome', shop_private.hq_assistant_latest_action(v_job.updates));
  end loop;
  return null;
end;
$$;

create or replace function shop_private.hq_assistant_valid_intent(p_intent jsonb) returns boolean
language plpgsql immutable set search_path = ''
as $$
declare
  v_keys constant text[] := array['kind','customerName','customerPhone','services','paymentMethod','paidAmount','paymentReceived','reply'];
  v_amount numeric;
begin
  if jsonb_typeof(p_intent) is distinct from 'object' or octet_length(p_intent::text) > 8192 then
    return false;
  end if;
  if not (p_intent ?& v_keys) or (p_intent - v_keys) <> '{}'::jsonb
    or jsonb_typeof(p_intent->'reply') is distinct from 'string'
    or (p_intent->>'reply') !~ '[^[:space:]]' or length(p_intent->>'reply') > 1000
    or jsonb_typeof(p_intent->'services') is distinct from 'array'
    or jsonb_typeof(p_intent->'paymentReceived') is distinct from 'boolean' then
    return false;
  end if;
  if p_intent->>'kind' = 'reply' then
    return p_intent->'customerName' = 'null'::jsonb and p_intent->'customerPhone' = 'null'::jsonb
      and p_intent->'services' = '[]'::jsonb and p_intent->'paymentMethod' = 'null'::jsonb
      and p_intent->'paidAmount' = 'null'::jsonb and p_intent->'paymentReceived' = 'false'::jsonb;
  end if;
  if jsonb_typeof(p_intent->'paidAmount') = 'number' then
    v_amount := (p_intent->>'paidAmount')::numeric;
    if v_amount <= 0 or v_amount > 9999999999.99 or v_amount <> round(v_amount, 2) then return false; end if;
  elsif p_intent->'paidAmount' <> 'null'::jsonb then
    return false;
  end if;
  return coalesce(p_intent->>'kind' = 'service_sale', false)
    and jsonb_typeof(p_intent->'customerName') = 'string'
    and length(btrim(p_intent->>'customerName')) between 2 and 160 and length(p_intent->>'customerName') <= 160
    and (p_intent->'customerPhone' = 'null'::jsonb or
      (jsonb_typeof(p_intent->'customerPhone') = 'string' and length(btrim(p_intent->>'customerPhone')) between 7 and 32))
    and (p_intent->'paymentMethod' = 'null'::jsonb or coalesce(p_intent->>'paymentMethod', '') in ('cash','card','transfer'))
    and jsonb_array_length(p_intent->'services') between 1 and 6
    and not exists (
      select 1 from jsonb_array_elements(p_intent->'services') as item(value)
      where jsonb_typeof(item.value) <> 'string' or length(btrim(item.value #>> '{}')) not between 2 and 120
        or length(item.value #>> '{}') > 120
    );
end;
$$;

create or replace function public.shop_hq_assistant_finish(p_job_id uuid,p_lease_token uuid,p_intent jsonb,p_succeeded boolean)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_digest bytea; v_sale_pending boolean;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  if p_succeeded is null or (p_succeeded and not shop_private.hq_assistant_valid_intent(p_intent))
    or (not p_succeeded and p_intent is not null and p_intent <> 'null'::jsonb) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_RESULT' using errcode = '22023';
  end if;
  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then return false; end if;
  v_digest := extensions.digest(convert_to(jsonb_build_array(p_lease_token,p_succeeded,p_intent)::text,'UTF8'),'sha256');
  if v_job.employee_finish_token = p_lease_token and v_job.employee_finish_worker = v_worker then
    return v_job.employee_finish_digest = v_digest;
  end if;
  if v_job.stage <> 'employee' or v_job.worker_id is distinct from v_worker
    or v_job.lease_token is distinct from p_lease_token or p_lease_token is null
    or v_job.lease_expires_at <= clock_timestamp() then return false; end if;
  v_sale_pending := p_succeeded and p_intent->>'kind' = 'service_sale'
    and not (v_job.updates @> '[{"kind":"receipt"}]'::jsonb);
  if p_succeeded then
    perform shop_private.hq_assistant_append_update(p_job_id,jsonb_build_object('kind','reply','text',p_intent->>'reply'));
  end if;
  update shop_private.hq_assistant_jobs
  set state = case when p_succeeded or v_job.state = 'completed' then 'completed' else 'failed' end,
    stage = case when v_sale_pending then 'sale_pending' when p_succeeded then 'review_pending' else 'closed' end,
    intent = case when p_succeeded then p_intent else intent end,
    intent_expires_at = case when p_succeeded then transcript_expires_at else intent_expires_at end,
    context_messages = case when p_succeeded then context_messages end,
    feedback = null,
    worker_id = case when v_sale_pending then v_worker end,
    lease_token = case when v_sale_pending then p_lease_token end,
    lease_expires_at = case when v_sale_pending then least(expires_at, clock_timestamp() + interval '60 seconds') end,
    employee_finish_worker = v_worker, employee_finish_token = p_lease_token, employee_finish_digest = v_digest
  where id = p_job_id;
  perform shop_private.hq_assistant_signal_owner(p_job_id);
  perform shop_private.hq_assistant_signal_staff();
  return true;
end;
$$;

create function public.shop_hq_assistant_sale_claim() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs job
  where job.stage = 'sale_pending' and job.worker_id = v_worker and job.lease_expires_at > clock_timestamp()
  order by job.created_at, job.id limit 1;
  if not found then return null; end if;
  if not shop_private.hq_assistant_current_consent(v_job) then
    update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed', owner_message = null,
      context_messages = null, updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, intent = null, intent_expires_at = null,
      transcript_expires_at = null, lease_token = null, lease_expires_at = null where id = v_job.id;
    return null;
  end if;
  return jsonb_build_object('jobId',v_job.id,'leaseToken',v_job.lease_token);
end;
$$;

create function shop_private.assert_shop_hq_sale_job(p_job_id uuid,p_lease_token uuid) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_action jsonb;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  select * into v_job from shop_private.hq_assistant_jobs job where job.id = p_job_id
    and job.transcript_expires_at > clock_timestamp()
  for update;
  if not found or not shop_private.hq_assistant_current_consent(v_job) then
    raise exception 'SHOP_HQ_ASSISTANT_SALE_JOB_UNAVAILABLE' using errcode = '42501';
  end if;
  select attempt.value->'outcome' into v_action from jsonb_array_elements(v_job.sale_attempts) attempt(value)
  where attempt.value->>'workerId' = v_worker::text and attempt.value->>'leaseToken' = p_lease_token::text;
  if found then return jsonb_build_object('priorOutcome', v_action); end if;
  if v_job.stage <> 'sale_pending' or v_job.worker_id is distinct from v_worker
    or p_lease_token is null or v_job.lease_token is distinct from p_lease_token
    or v_job.lease_expires_at <= clock_timestamp() or v_job.expires_at <= clock_timestamp()
    or v_job.intent->>'kind' is distinct from 'service_sale' then
    raise exception 'SHOP_HQ_ASSISTANT_SALE_JOB_UNAVAILABLE' using errcode = '42501';
  end if;
  return jsonb_build_object('actorId',v_job.actor_id,'shopId',v_job.shop_id,'locationId',v_job.location_id,
    'agentId',v_job.employee_id,'intent',v_job.intent,'payment',to_jsonb(v_job)->'payment_evidence',
    'requestId',v_job.request_id,'createdAt',v_job.created_at,'ownerMessage',v_job.owner_message,
    'contextMessages',v_job.context_messages);
end;
$$;

create function shop_private.hq_assistant_complete_sale_stage(p_job_id uuid,p_update jsonb) returns void
language plpgsql set search_path = ''
as $$
begin
  update shop_private.hq_assistant_jobs set stage = 'review_pending',
    sale_attempts = sale_attempts || jsonb_build_array(jsonb_build_object(
      'workerId',worker_id,'leaseToken',lease_token,
      'outcome',case when p_update->>'kind' = 'receipt' then p_update else p_update->'outcome' end
    )),
    worker_id = null, lease_token = null, lease_expires_at = null where id = p_job_id and stage = 'sale_pending';
  if not found then raise exception 'SHOP_HQ_ASSISTANT_SALE_JOB_UNAVAILABLE' using errcode = '42501'; end if;
  perform shop_private.hq_assistant_append_update(p_job_id,p_update);
  perform shop_private.hq_assistant_signal_owner(p_job_id);
  perform shop_private.hq_assistant_signal_staff();
end;
$$;

create function shop_private.hq_assistant_append_receipt(p_job_id uuid,p_invoice_id uuid) returns void
language sql set search_path = ''
as $$
  select shop_private.hq_assistant_complete_sale_stage(p_job_id,
    jsonb_build_object('kind','receipt','invoiceId',p_invoice_id));
$$;

create function shop_private.hq_assistant_close_sale_attempt(p_job_id uuid,p_outcome jsonb) returns void
language sql set search_path = ''
as $$
  select shop_private.hq_assistant_complete_sale_stage(p_job_id,
    jsonb_build_object('kind','clarification','outcome',p_outcome));
$$;

create function public.shop_hq_assistant_review_claim() returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_token uuid; v_head uuid; v_batch jsonb := '[]';
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  perform shop_private.hq_assistant_cleanup();
  select head_id into v_head from shop_private.hq_assistant_department;
  for v_job in
    select * from shop_private.hq_assistant_jobs job
    where job.stage = 'review_pending' order by job.created_at, job.id
  loop
    if not shop_private.hq_assistant_current_consent(v_job) then
      update shop_private.hq_assistant_jobs set state = 'revoked', stage = 'closed', owner_message = null,
        context_messages = null, updates = '[]'::jsonb, sale_attempts = '[]'::jsonb, intent = null, intent_expires_at = null,
        transcript_expires_at = null where id = v_job.id;
      continue;
    end if;
    v_token := gen_random_uuid();
    update shop_private.hq_assistant_jobs set stage = 'reviewing',
      worker_id = v_worker, lease_token = v_token,
      lease_expires_at = least(expires_at, clock_timestamp() + interval '140 seconds')
    where id = v_job.id;
    v_batch := v_batch || jsonb_build_array(jsonb_build_object('jobId',v_job.id,'leaseToken',v_token,
      'headId',v_head,'headAgentId','AG-SHOP-001','employeeId',v_job.employee_id,
      'employeeTemplate','shop-suit-agent-v1','messages',v_job.context_messages,'intent',v_job.intent,
      'outcome',shop_private.hq_assistant_latest_action(v_job.updates)));
    exit when jsonb_array_length(v_batch) = 4;
  end loop;
  return v_batch;
end;
$$;

create function public.shop_hq_assistant_review_finish(p_job_id uuid,p_lease_token uuid,p_approved boolean,p_feedback text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare v_worker uuid; v_job shop_private.hq_assistant_jobs%rowtype; v_digest bytea; v_fix boolean;
begin
  perform shop_private.hq_assistant_queue_lock();
  v_worker := shop_private.hq_assistant_require_queue_worker();
  if p_approved is null or (p_approved and p_feedback is not null)
    or (p_feedback is not null and (octet_length(p_feedback) > 2000 or p_feedback !~ '[^[:space:]]')) then
    raise exception 'SHOP_HQ_ASSISTANT_INVALID_REVIEW' using errcode = '22023';
  end if;
  perform shop_private.hq_assistant_cleanup();
  select * into v_job from shop_private.hq_assistant_jobs where id = p_job_id;
  if not found or v_job.transcript_expires_at is null or v_job.transcript_expires_at <= clock_timestamp()
    or not shop_private.hq_assistant_current_consent(v_job) then return false; end if;
  v_digest := extensions.digest(convert_to(jsonb_build_array(p_lease_token,p_approved,p_feedback)::text,'UTF8'),'sha256');
  if v_job.review_finish_token = p_lease_token and v_job.review_finish_worker = v_worker then
    return v_job.review_finish_digest = v_digest;
  end if;
  if v_job.stage <> 'reviewing' or v_job.worker_id is distinct from v_worker
    or v_job.lease_token is distinct from p_lease_token or p_lease_token is null
    or v_job.lease_expires_at <= clock_timestamp() then return false; end if;
  v_fix := not p_approved and p_feedback is not null and v_job.fix_count = 0
    and v_job.expires_at > clock_timestamp() + interval '10 seconds';
  update shop_private.hq_assistant_jobs
  set stage = case when v_fix then 'fix_pending' else 'closed' end,
    context_messages = case when v_fix then context_messages end,
    feedback = case when v_fix then p_feedback end,
    fix_count = case when v_fix then 1 else fix_count end,
    review_recovery_count = case when v_fix then 0 else review_recovery_count end,
    worker_id = null, lease_token = null, lease_expires_at = null,
    review_finish_worker = v_worker, review_finish_token = p_lease_token, review_finish_digest = v_digest
  where id = p_job_id;
  perform shop_private.hq_assistant_signal_owner(p_job_id);
  perform shop_private.hq_assistant_signal_staff();
  return true;
end;
$$;

-- Disablement fences active writes before an operator can re-enable the worker.
create or replace function shop_private.register_shop_hq_assistant_worker(p_auth_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform shop_private.hq_assistant_queue_lock();
  if p_enabled is false then
    update shop_private.hq_assistant_workers
      set enabled = false, queue_enabled = false, changed_at = clock_timestamp() where auth_user_id = p_auth_user_id;
    update shop_private.hq_assistant_jobs set lease_expires_at = clock_timestamp()
      where worker_id = p_auth_user_id and stage in ('employee','sale_pending','reviewing');
    perform shop_private.hq_assistant_cleanup();
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

-- Roster registration is sufficient for metadata delivery. Work execution
-- requires a separate explicit, database-side operator action.
create function shop_private.set_shop_hq_assistant_queue_enabled(p_auth_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform shop_private.hq_assistant_queue_lock();
  if p_enabled is null or not shop_private.hq_assistant_is_worker(p_auth_user_id) then
    raise exception 'SHOP_HQ_ASSISTANT_TECHNICAL_ACCOUNT_REQUIRED' using errcode = '22023';
  end if;
  update shop_private.hq_assistant_workers
  set queue_enabled = p_enabled, changed_at = clock_timestamp()
  where auth_user_id = p_auth_user_id and queue_enabled is distinct from p_enabled;
  if not found then return; end if;
  if not p_enabled then
    update shop_private.hq_assistant_jobs set lease_expires_at = clock_timestamp()
    where worker_id = p_auth_user_id and stage in ('employee','sale_pending','reviewing');
    perform shop_private.hq_assistant_cleanup();
  end if;
  perform shop_private.hq_assistant_signal_staff();
end;
$$;

create function public.shop_hq_assistant_staff(p_after_employee_id uuid default null,p_limit integer default 50)
returns jsonb language plpgsql security definer set search_path = ''
as $$
declare v_staff jsonb;
begin
  perform shop_private.hq_assistant_require_worker();

  select coalesce(jsonb_agg(jsonb_build_object('employeeId',staff.id,'employeeTemplate','shop-suit-agent-v1',
    'shopId',staff.shop_id,'shopName',staff.name,'state',staff.state) order by staff.id),'[]'::jsonb) into v_staff
  from (
    select employee.id, employee.shop_id,
      coalesce(nullif(left(btrim(regexp_replace(shop.name, '[[:cntrl:][:space:]]+', ' ', 'g')), 200), ''), 'Shop Suit') as name,
      case when exists (
        select 1 from shop_private.hq_assistant_jobs job
        where job.employee_id = employee.id and job.stage <> 'closed' and job.expires_at > clock_timestamp()
      ) then 'busy' else 'idle' end as state
    from shop_private.hq_assistant_employees employee
    join public.shops shop on shop.id = employee.shop_id
    join public.portals portal on portal.id = shop.portal_id
    where (p_after_employee_id is null or employee.id > p_after_employee_id)
      and shop.status = 'active' and portal.key = 'shop-crm' and portal.is_active
    order by employee.id limit greatest(1,least(coalesce(p_limit,50),100))
  ) staff;
  return v_staff;
end;
$$;

revoke all on function shop_private.hq_assistant_roster_changed(), shop_private.hq_assistant_signal_owner(uuid),
  shop_private.hq_assistant_signal_staff(), shop_private.hq_assistant_current_consent(shop_private.hq_assistant_jobs),
  shop_private.hq_assistant_latest_action(jsonb), shop_private.hq_assistant_append_update(uuid,jsonb),
  shop_private.hq_assistant_owner_projection(shop_private.hq_assistant_jobs),
  shop_private.hq_assistant_require_worker(), shop_private.hq_assistant_require_queue_worker(),
  shop_private.set_shop_hq_assistant_queue_enabled(uuid,boolean), shop_private.assert_shop_hq_sale_job(uuid,uuid),
  shop_private.hq_assistant_complete_sale_stage(uuid,jsonb), shop_private.hq_assistant_append_receipt(uuid,uuid),
  shop_private.hq_assistant_close_sale_attempt(uuid,jsonb)
from public,anon,authenticated,service_role;

revoke all on function public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb), public.shop_hq_assistant_recent(uuid,uuid),
  public.shop_hq_assistant_can_receive_owner(text), public.shop_hq_assistant_dispatch(), public.shop_hq_assistant_sale_claim(),
  public.shop_hq_assistant_review_claim(), public.shop_hq_assistant_review_finish(uuid,uuid,boolean,text),
  public.shop_hq_assistant_staff(uuid,integer)
from public,anon,authenticated,service_role;

grant execute on function public.shop_hq_assistant_enqueue(uuid,uuid,uuid,jsonb), public.shop_hq_assistant_recent(uuid,uuid),
  public.shop_hq_assistant_can_receive_owner(text), public.shop_hq_assistant_dispatch(), public.shop_hq_assistant_sale_claim(),
  public.shop_hq_assistant_review_claim(), public.shop_hq_assistant_review_finish(uuid,uuid,boolean,text),
  public.shop_hq_assistant_staff(uuid,integer) to authenticated;

notify pgrst, 'reload schema';
commit;

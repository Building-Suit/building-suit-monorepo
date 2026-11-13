-- Durable event-driven wakeups. There is one pending one-shot dispatch job,
-- never a permanent data/queue polling schedule. All commands contain only a
-- private helper name; the worker token stays in Vault and pg_net's queue.

create table hq_private.brain_dispatch_state (
  root_id text primary key references hq_private.brain_sync_state(root_id),
  generation_seen bigint not null,
  attempts integer not null default 0 check (attempts between 0 and 6),
  circuit_open boolean not null default false,
  due_at timestamptz,
  last_request_id bigint,
  last_error text check (last_error in ('dispatch-unavailable','attempts-exhausted','configuration-required')),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table hq_private.brain_dispatch_state enable row level security;
revoke all on hq_private.brain_dispatch_state from public,anon,authenticated,service_role;
insert into hq_private.brain_dispatch_state(root_id,generation_seen)
  select root_id,generation from hq_private.brain_sync_state
  where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';

-- Callers first lock the Brain state, then dispatch state, then cron metadata.
-- This consistent order also applies to the callback running inside cron.
create function hq_private.brain_dispatch_cancel() returns void
language plpgsql security definer set search_path='' as $$
declare v_job record;
begin
  for v_job in select j.jobid from cron.job j where j.jobname='hq-brain-sync-once' loop
    perform cron.unschedule(v_job.jobid);
  end loop;
  update hq_private.brain_dispatch_state set due_at=null,updated_at=pg_catalog.clock_timestamp()
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
end;
$$;

create function hq_private.brain_dispatch_schedule(p_due_at timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare v_seconds integer; v_schedule text; v_wall timestamp; v_zone text;
begin
  if p_due_at is null or not pg_catalog.isfinite(p_due_at) then raise exception 'HQ_INVALID_DISPATCH_TIME' using errcode='22023'; end if;
  perform hq_private.brain_dispatch_cancel();
  v_seconds := greatest(1,pg_catalog.ceil(extract(epoch from p_due_at-pg_catalog.clock_timestamp()))::integer+1);
  if v_seconds<=59 then
    v_schedule := v_seconds::text||' seconds';
  else
    -- pg_cron second intervals support 1..59 seconds. A longer deadline is an
    -- absolute calendar minute rounded strictly up, not repeated short polls.
    v_zone := coalesce(nullif(pg_catalog.current_setting('cron.timezone',true),''),'GMT');
    v_wall := (pg_catalog.date_trunc('minute',p_due_at)+interval '1 minute') at time zone v_zone;
    v_schedule := extract(minute from v_wall)::integer::text||' '||extract(hour from v_wall)::integer::text||' '||
      extract(day from v_wall)::integer::text||' '||extract(month from v_wall)::integer::text||' *';
  end if;
  perform cron.schedule('hq-brain-sync-once',v_schedule,'select hq_private.brain_dispatch_tick();');
  update hq_private.brain_dispatch_state set due_at=p_due_at,updated_at=pg_catalog.clock_timestamp()
    where root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
end;
$$;

create function hq_private.brain_dispatch_enqueue() returns boolean
language plpgsql security definer set search_path='' as $$
declare v_dispatch hq_private.brain_dispatch_state; v_request bigint; v_delay integer;
begin
  select d.* into v_dispatch from hq_private.brain_dispatch_state d
    where d.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  if v_dispatch.circuit_open then return false; end if;
  if v_dispatch.attempts>=6 then
    perform hq_private.brain_dispatch_cancel();
    update hq_private.brain_dispatch_state set circuit_open=true,last_error='attempts-exhausted',updated_at=pg_catalog.clock_timestamp()
      where root_id=v_dispatch.root_id;
    return false;
  end if;
  if not exists(select 1 from hq_private.brain_worker_configuration c where c.singleton) then
    perform hq_private.brain_dispatch_cancel();
    update hq_private.brain_dispatch_state set circuit_open=true,last_error='configuration-required',updated_at=pg_catalog.clock_timestamp()
      where root_id=v_dispatch.root_id;
    return false;
  end if;
  update hq_private.brain_dispatch_state set attempts=attempts+1,last_error=null,last_request_id=null,updated_at=pg_catalog.clock_timestamp()
    where root_id=v_dispatch.root_id returning * into v_dispatch;
  begin
    v_request := hq_private.invoke_brain_sync('run');
    update hq_private.brain_dispatch_state set last_request_id=v_request where root_id=v_dispatch.root_id;
  exception when others then
    -- No provider error body/credential is persisted. A one-shot below also
    -- covers a failed pre-claim HTTP request whose result arrives asynchronously.
    update hq_private.brain_dispatch_state set last_error='dispatch-unavailable' where root_id=v_dispatch.root_id;
  end;
  v_delay := least(300,45*(2 ^ least(v_dispatch.attempts-1,3))::integer);
  perform hq_private.brain_dispatch_schedule(pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>v_delay));
  return v_request is not null;
end;
$$;

create function hq_private.brain_dispatch_reconcile(p_reset boolean default false) returns boolean
language plpgsql security definer set search_path='' as $$
declare v_state hq_private.brain_sync_state; v_dispatch hq_private.brain_dispatch_state;
begin
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  select d.* into v_dispatch from hq_private.brain_dispatch_state d where d.root_id=v_state.root_id for update;
  if p_reset or v_dispatch.generation_seen<v_state.generation then
    update hq_private.brain_dispatch_state set generation_seen=v_state.generation,attempts=0,circuit_open=false,last_error=null,
      updated_at=pg_catalog.clock_timestamp() where root_id=v_state.root_id returning * into v_dispatch;
  end if;
  if v_state.generation<=v_state.completed_generation and not v_state.full_reconcile then
    perform hq_private.brain_dispatch_cancel();
    update hq_private.brain_dispatch_state set attempts=0,circuit_open=false,last_error=null,last_request_id=null where root_id=v_state.root_id;
    return false;
  end if;
  if v_state.lease_owner is not null and v_state.lease_expires_at>pg_catalog.clock_timestamp() then
    -- Claim/renewal only arms the crash watchdog; it never queues a data run.
    update hq_private.brain_dispatch_state set last_request_id=null where root_id=v_state.root_id;
    perform hq_private.brain_dispatch_schedule(v_state.lease_expires_at+interval '1 second');
    return false;
  end if;
  if v_dispatch.circuit_open then perform hq_private.brain_dispatch_cancel(); return false; end if;
  if v_dispatch.attempts>=6 then return hq_private.brain_dispatch_enqueue(); end if;
  if v_state.retry_at>pg_catalog.clock_timestamp() then
    perform hq_private.brain_dispatch_schedule(v_state.retry_at+interval '1 second');
    return false;
  end if;
  -- Several notifications can commit before pg_net's queued HTTP request
  -- reaches the worker. That request will claim the newest generation; retain
  -- its existing pre-claim watchdog instead of queuing another request.
  if v_dispatch.last_request_id is not null and v_dispatch.due_at>pg_catalog.clock_timestamp() then return false; end if;
  return hq_private.brain_dispatch_enqueue();
end;
$$;

create function hq_private.brain_dispatch_tick() returns boolean
language plpgsql security definer set search_path='' as $$
declare v_state hq_private.brain_sync_state; v_dispatch hq_private.brain_dispatch_state;
begin
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  select d.* into v_dispatch from hq_private.brain_dispatch_state d where d.root_id=v_state.root_id for update;
  -- Unschedule before any external enqueue. A process/transaction failure
  -- rolls this back together with the work, retaining the durable wakeup.
  perform hq_private.brain_dispatch_cancel();
  if v_dispatch.due_at is not null and v_dispatch.due_at>pg_catalog.clock_timestamp() then
    perform hq_private.brain_dispatch_schedule(v_dispatch.due_at);
    return false;
  end if;
  return hq_private.brain_dispatch_reconcile(false);
end;
$$;

create function hq_private.brain_dispatch_state_changed() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_reset boolean;
begin
  -- Reset the consecutive dispatch budget for a new source event or actual
  -- successful commit, never for worker heartbeat/lease/observation changes.
  v_reset := new.generation>old.generation or new.completed_generation>old.completed_generation
    or new.last_success_at is distinct from old.last_success_at;
  perform hq_private.brain_dispatch_reconcile(v_reset);
  return null;
end;
$$;
create trigger hq_brain_durable_dispatch after update of generation,completed_generation,full_reconcile,
  lease_owner,lease_expires_at,retry_at,last_success_at on hq_private.brain_sync_state
  for each row execute function hq_private.brain_dispatch_state_changed();

create function hq_private.brain_dispatch_recover() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_queued boolean; v_circuit boolean;
begin
  perform hq_private.require_brain_service();
  v_queued := hq_private.brain_dispatch_reconcile(true);
  select d.circuit_open into v_circuit from hq_private.brain_dispatch_state d
    where d.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  return pg_catalog.jsonb_build_object('queued',v_queued,'circuitOpen',v_circuit);
end;
$$;
create function public.hq_brain_dispatch_recover() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.brain_dispatch_recover(); $$;
revoke all on function hq_private.brain_dispatch_cancel(),hq_private.brain_dispatch_schedule(timestamptz),
  hq_private.brain_dispatch_enqueue(),hq_private.brain_dispatch_reconcile(boolean),hq_private.brain_dispatch_tick(),
  hq_private.brain_dispatch_state_changed(),hq_private.brain_dispatch_recover(),public.hq_brain_dispatch_recover()
  from public,anon,authenticated,service_role;
grant execute on function hq_private.brain_dispatch_recover(),public.hq_brain_dispatch_recover() to service_role;

-- A circuit stops direct/duplicate worker invocations as well as cron wakes.
create or replace function hq_private.brain_sync_claim(p_owner uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_state hq_private.brain_sync_state; v_claimed boolean := false; v_channel jsonb;
begin
  perform hq_private.require_brain_service();
  if p_owner is null or p_owner = '00000000-0000-0000-0000-000000000000'::uuid then
    raise exception 'HQ_INVALID_OWNER' using errcode = '22023';
  end if;
  select s.* into v_state from hq_private.brain_sync_state s
    where s.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' for update;
  if (v_state.generation>v_state.completed_generation or v_state.full_reconcile)
    and not exists(select 1 from hq_private.brain_dispatch_state d where d.root_id=v_state.root_id and d.circuit_open)
    and v_state.retry_at <= pg_catalog.clock_timestamp() and
    (v_state.lease_owner is null or v_state.lease_expires_at <= pg_catalog.clock_timestamp() or v_state.lease_owner = p_owner)
    and not exists(select 1 from hq_private.brain_sync_receipts r where r.owner_id = p_owner) then
    update hq_private.brain_sync_state set lease_owner = p_owner,
      lease_generation = case when lease_owner = p_owner then lease_generation else generation end,
      lease_expires_at = pg_catalog.clock_timestamp() + interval '3 minutes',
      updated_at = pg_catalog.clock_timestamp()
      where root_id=v_state.root_id returning * into v_state;
    v_claimed := true;
  end if;
  select pg_catalog.jsonb_build_object('id',c.channel_id,'resourceId',c.resource_id,'expiresAt',c.expires_at)
    into v_channel from hq_private.brain_channels c
    where c.confirmed_at is not null and c.expires_at > pg_catalog.clock_timestamp()
    order by c.expires_at desc,c.channel_id limit 1;
  return pg_catalog.jsonb_build_object('claimed',v_claimed,'rootId',v_state.root_id,
    'cursor',v_state.cursor,'generation',case when v_claimed then v_state.lease_generation else v_state.generation end,
    'fullReconcile',v_state.full_reconcile,'leaseExpiresAt',case when v_claimed then v_state.lease_expires_at else null end,
    'retryAt',v_state.retry_at,'channel',v_channel);
end;
$$;

-- Applying this authorized forward setup recovers already pending work once.
-- An idle or unconfigured install makes no worker/data request.
do $$
begin
  if exists(select 1 from hq_private.brain_worker_configuration where singleton) then
    perform hq_private.brain_dispatch_reconcile(false);
  end if;
end;
$$;

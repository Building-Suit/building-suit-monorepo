-- DISPOSABLE SOURCE PROPOSAL ONLY. Requires the applied 20261109150515 shape.
-- Not an activation migration. No cron job is installed by this file.
-- A separately reviewed owner setup would install hq-live-watchdog with
-- '* * * * *' / 'select hq_private.live_dispatch_watchdog()'. Tests do so locally.
-- No new credentials, grants, RPCs, data replay, circuit reset or cleanup.
-- Jobs use a new format_version=3 fence. Old dispatcher bodies select only
-- version 2 and therefore cannot reserve jobs or open the browser circuit for
-- a jobs failure, even if they begin selection after this atomic replacement.
-- An old callback may still remove the hot wake; the independent cold watchdog
-- recovers it. Existing browser v2 and quarantined v1 rows are never rewritten.
-- The original hq-live-once job becomes a hot, one-second backlog dispatcher.
-- A missed/canceled hot wake is recovered by the durable minute watchdog.
-- Nominal idle cost: 1,440 cold launches/day plus cron run-log retention.
-- Nominal cold latency: up to 60 seconds plus hot launch/connection/queue time;
-- outages, lock contention and failed authentication have no finite SLA here.
-- Five-minute cold polling (288 launches/day) is an UNSELECTED alternative:
-- its cold delay exceeds the existing 150-second presence freshness window.
-- Minimum retry deadlines and six-reservation budget remain unchanged; a
-- future-only retry may wait another cold interval after becoming due.
-- One publication per hot tick limits sustained service to roughly 60/minute
-- before connection/transaction overhead. Idle rate is not a pricing promise.

-- BEGIN ADAPTIVE SCHEMA PREPARATION
-- Apply the complete proposal in one transaction. Existing v1/v2 rows are
-- untouched; jobs is a new strictly constrained v3 envelope, not a topic field.
alter table hq_private.live_invalidations
  drop constraint live_invalidations_event_check,
  drop constraint live_invalidations_format_version_check;
alter table hq_private.live_invalidations
  add constraint live_invalidations_event_check check (event in ('invalidate','presence','jobs')),
  add constraint live_invalidations_format_version_check check (format_version in (1,2,3)),
  add constraint live_invalidations_v3_event_check check (format_version<>3 or event='jobs'),
  add constraint live_invalidations_jobs_shape_check check (event<>'jobs' or
    (format_version=3 and kind='agents' and payload is not null and payload='{}'::jsonb));
create index hq_live_v3_jobs_pending_idx on hq_private.live_invalidations(next_attempt_at,created_at,id)
  where delivered_at is null and format_version=3 and event='jobs';
-- Existing circuit_open/last_error remain the browser lane and are never reset.
-- Jobs wakes have their own breaker so UI failures cannot permanently suppress
-- the worker's only push wake. Budgets/tokens remain per outbox event.
alter table hq_private.live_dispatch_state
  add column jobs_circuit_open boolean not null default false,
  add column jobs_last_error text check (jobs_last_error in ('publication-unverified','attempts-exhausted'));
-- END ADAPTIVE SCHEMA PREPARATION

-- BEGIN ADAPTIVE ROUTINE DEFINITIONS
-- Test seams distinguish schema-lock behavior from old-CALL compatibility;
-- these markers do not authorize a split production deployment.
-- Keep the existing helper signature; only the jobs event chooses version 3.
create or replace function hq_private.live_enqueue_v2(p_kind text,p_event text,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare key text; begin
  if p_kind is null or p_kind not in ('brain','company','access','agents')
    or p_event is null or p_event not in ('invalidate','presence','jobs')
    or p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  if (p_event='jobs' and (p_kind<>'agents' or p_payload<>'{}'::jsonb)) or
    (p_event='invalidate' and p_payload<>pg_catalog.jsonb_build_object('kind',p_kind)) or
    (p_event='presence' and (p_kind<>'agents' or p_payload-array['observedAt','agentId','taskId']::text[]<>'{}'::jsonb
      or not (p_payload ?& array['observedAt','agentId','taskId'])
      or pg_catalog.jsonb_typeof(p_payload->'observedAt')<>'string'
      or pg_catalog.jsonb_typeof(p_payload->'agentId') not in ('string','null')
      or pg_catalog.jsonb_typeof(p_payload->'taskId') not in ('string','null')))
    or pg_catalog.octet_length(p_payload::text)>1024 then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  key:='hq.live_emitted_v2_'||p_event||'_'||p_kind;
  if pg_catalog.current_setting(key,true)='1' then return; end if;
  insert into hq_private.live_invalidations(kind,format_version,event,payload)
    values(p_kind,case when p_event='jobs' then 3 else 2 end,p_event,p_payload);
  perform pg_catalog.set_config(key,'1',true);
end $$;

create or replace function hq_private.live_deliver(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare item hq_private.live_invalidations; expected jsonb; delivery_topic text; begin
  select * into item from hq_private.live_invalidations where id=p_id for update;
  if not found then raise exception 'HQ_INVALID_LIVE_ID' using errcode='22023'; end if;
  if item.format_version=1 then raise exception 'HQ_LIVE_LEGACY_UNVERIFIED'; end if;
  if not ((item.format_version=2 and item.event in ('invalidate','presence'))
    or (item.format_version=3 and item.event='jobs')) then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  if item.delivered_at is not null then return true; end if;
  if item.attempt_token is null or item.attempts=0 then raise exception 'HQ_LIVE_ATTEMPT_REQUIRED'; end if;
  -- No caller-controlled destination. Jobs wakes contain no task or user data.
  if item.event='jobs' then
    if item.kind is distinct from 'agents' or item.payload is distinct from '{}'::jsonb then
      raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
    end if;
    delivery_topic:='hq-agent-jobs';
  elsif item.event in ('invalidate','presence') then
    delivery_topic:='hq-live';
  else
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  expected:=item.payload||pg_catalog.jsonb_build_object('id',item.id);
  perform realtime.send(expected,item.event,delivery_topic,true);
  -- Provider generates an independent messages.id. Correlate payload.id only.
  if not exists(select 1 from realtime.messages m where m.topic=delivery_topic and m.event=item.event
    and m.extension='broadcast' and m.private and m.payload=expected
    and m.inserted_at >= (pg_catalog.transaction_timestamp() at time zone 'UTC')) then
    raise exception 'HQ_LIVE_PUBLICATION_UNVERIFIED';
  end if;
  update hq_private.live_invalidations set delivered_at=pg_catalog.clock_timestamp(),last_error=null,attempt_token=null where id=p_id;
  return true;
end $$;

-- Preserve both effects of workforce_wake without either synchronous send.
-- The worker consumes any broadcast on its existing private jobs channel;
-- only kind=roster has special meaning. The id-only jobs receipt changes none
-- of its claim, lease, journal or late-discard authority checks.
create or replace function hq_private.workforce_wake() returns void
language plpgsql security definer set search_path='' as $$ begin
  perform hq_private.live_emit('agents');
  perform hq_private.live_enqueue_v2('agents','jobs','{}'::jsonb);
end $$;

-- All callers are dispatcher-side and hold the state row lock. p_due is
-- retained for already-running old procedure bodies; it is diagnostic only.
-- A delayed old callback may arm an unnecessary hot wake, which the next tick
-- removes. It cannot change the independent cold-watchdog schedule.
create or replace function hq_private.live_dispatch_schedule(p_due timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare existing_job record; begin
  if p_due is null or not pg_catalog.isfinite(p_due) then raise exception 'HQ_INVALID_DISPATCH_TIME' using errcode='22023'; end if;
  select * into existing_job from cron.job where jobname='hq-live-once' and username=current_user;
  if found and (existing_job.database<>pg_catalog.current_database()
    or existing_job.command<>'call hq_private.live_dispatch_tick()') then
    raise exception 'HQ_LIVE_HOT_JOB_COLLISION';
  end if;
  if existing_job.jobid is null or not existing_job.active or existing_job.schedule<>'1 second' then
    perform cron.schedule('hq-live-once','1 second','call hq_private.live_dispatch_tick()');
  end if;
  update hq_private.live_dispatch_state set due_at=p_due where singleton;
end $$;

-- Keep cancel's identity/ACL, but its scope remains ONLY the hot job.
create or replace function hq_private.live_dispatch_cancel() returns void
language plpgsql security definer set search_path='' as $$
declare j record; begin
  for j in select jobid,database,command from cron.job where jobname='hq-live-once' and username=current_user loop
    if j.database<>pg_catalog.current_database() or j.command<>'call hq_private.live_dispatch_tick()' then
      raise exception 'HQ_LIVE_HOT_JOB_COLLISION';
    end if;
    perform cron.unschedule(j.jobid);
  end loop;
  update hq_private.live_dispatch_state set due_at=null where singleton;
end $$;

-- The cold watchdog only ensures due work has a hot wake. It never cancels
-- an in-flight hot publisher just because its reserved row is not yet due.
-- Empty/future-only queues perform no writes or scheduler mutations here.
create function hq_private.live_dispatch_watchdog() returns void
language plpgsql security invoker set search_path='' as $$
declare state hq_private.live_dispatch_state; next_due timestamptz; begin
  if current_user<>pg_catalog.pg_get_userbyid((select relowner from pg_catalog.pg_class
      where oid='hq_private.live_dispatch_state'::pg_catalog.regclass)) then
    raise exception 'HQ_LIVE_OWNER_REQUIRED' using errcode='42501';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton;
  if not exists(select 1 from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs'))
      and delivered_at is null and next_attempt_at<=pg_catalog.clock_timestamp()
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open))) then return; end if;
  select * into state from hq_private.live_dispatch_state where singleton for update skip locked;
  if not found then return; end if;
  select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
  if next_due<=pg_catalog.clock_timestamp() then perform hq_private.live_dispatch_schedule(next_due); end if;
end $$;

-- p_generation is retained for in-flight old CALLs, not a producer fence.
-- Producers never touch state. A row committed just after the final queue read
-- may lose the hot wake, but the independent watchdog bounds that cold delay.
create or replace function hq_private.live_dispatch_reconcile(p_id uuid,p_token uuid,p_generation bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare state hq_private.live_dispatch_state; current_item hq_private.live_invalidations; next_due timestamptz;
begin
  if p_id is null or p_token is null or p_generation is null or p_generation<0 then
    raise exception 'HQ_INVALID_LIVE_RECONCILE' using errcode='22023';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton for update;
  select * into current_item from hq_private.live_invalidations where id=p_id and ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs'));
  -- Never reopen either lane or let a jobs callback erase browser diagnostics.
  if current_item.event='jobs' and not state.jobs_circuit_open then
    if current_item.delivered_at is not null then
      update hq_private.live_dispatch_state set jobs_last_error=null where singleton;
    elsif current_item.attempt_token=p_token then
      update hq_private.live_dispatch_state set jobs_last_error='publication-unverified' where singleton;
    end if;
  elsif current_item.event in ('invalidate','presence') and not state.circuit_open then
    if current_item.delivered_at is not null then
      update hq_private.live_dispatch_state set last_error=null where singleton;
    elsif current_item.attempt_token=p_token then
      update hq_private.live_dispatch_state set last_error='publication-unverified' where singleton;
    end if;
  end if;
  select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
  if next_due<=pg_catalog.clock_timestamp() then
    perform hq_private.live_dispatch_schedule(next_due);
  else
    perform hq_private.live_dispatch_cancel();
    update hq_private.live_dispatch_state set due_at=next_due where singleton;
  end if;
end $$;

create or replace procedure hq_private.live_dispatch_tick()
language plpgsql security invoker as $$
declare state hq_private.live_dispatch_state; item hq_private.live_invalidations;
  token uuid; observed_generation bigint; next_due timestamptz;
begin
  perform pg_catalog.set_config('search_path','',true);
  if current_user<>pg_catalog.pg_get_userbyid((select c.relowner from pg_catalog.pg_class c
      where c.oid='hq_private.live_dispatch_state'::pg_catalog.regclass)) then
    raise exception 'HQ_LIVE_OWNER_REQUIRED' using errcode='42501';
  end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then
    raise exception 'HQ_LIVE_READ_COMMITTED_REQUIRED' using errcode='25001';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton for update;
  observed_generation:=state.generation;
  select * into item from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
    and next_attempt_at<=pg_catalog.clock_timestamp()
    and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open))
    order by created_at,id limit 1 for update skip locked;
  if not found then
    select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
    perform hq_private.live_dispatch_cancel();
    update hq_private.live_dispatch_state set due_at=next_due where singleton;
    return;
  end if;
  if item.attempts>=6 then
    update hq_private.live_invalidations set last_error='attempts-exhausted',attempt_token=null where id=item.id;
    if item.event='jobs' then
      update hq_private.live_dispatch_state set jobs_circuit_open=true,jobs_last_error='attempts-exhausted' where singleton;
      state.jobs_circuit_open:=true;
    else
      update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted' where singleton;
      state.circuit_open:=true;
    end if;
    select min(next_attempt_at) into next_due from hq_private.live_invalidations where ((format_version=2 and event in ('invalidate','presence')) or (format_version=3 and event='jobs')) and delivered_at is null
      and ((event='jobs' and not state.jobs_circuit_open) or (event<>'jobs' and not state.circuit_open));
    if next_due<=pg_catalog.clock_timestamp() then perform hq_private.live_dispatch_schedule(next_due);
    else
      perform hq_private.live_dispatch_cancel();
      update hq_private.live_dispatch_state set due_at=next_due where singleton;
    end if;
    return;
  end if;
  token:=pg_catalog.gen_random_uuid();
  next_due:=pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>least(300,5*(2^item.attempts)::integer));
  update hq_private.live_invalidations set attempts=attempts+1,attempt_token=token,next_attempt_at=next_due where id=item.id;
  update hq_private.live_dispatch_state set due_at=next_due where singleton;
  -- Durable reservation survives cancellation; the fixed watchdog recovers it.
  commit;

  perform pg_catalog.set_config('search_path','',true);
  begin
    -- Lock only this outbox row; never state/cron while publishing. A stale run
    -- cannot publish an attempt that another invocation has already superseded.
    perform 1 from hq_private.live_invalidations where id=item.id and attempt_token=token for update;
    if found then perform hq_private.live_deliver(item.id); end if;
  exception when others then
    update hq_private.live_invalidations set last_error='publication-unverified' where id=item.id and attempt_token=token;
  end;
  -- query_canceled is deliberately NOT caught by WHEN OTHERS.
  commit;

  perform hq_private.live_dispatch_reconcile(item.id,token,observed_generation);
end $$;

-- CREATE OR REPLACE preserves existing ACLs and owners. The new watchdog is
-- private; no service/application role receives direct or inherited authority.
revoke all on function hq_private.live_dispatch_watchdog() from public,anon,authenticated,service_role;
DO $private_watchdog$
declare app_role text; private_routine text; begin
  if exists(select 1 from pg_catalog.pg_proc p,
      lateral pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a
      where p.oid='hq_private.live_dispatch_watchdog()'::pg_catalog.regprocedure and a.grantee<>p.proowner) then
    raise exception 'HQ_LIVE_WATCHDOG_UNEXPECTED_ACL';
  end if;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    foreach private_routine in array array['hq_private.live_dispatch_watchdog()',
      'hq_private.workforce_wake()','hq_private.live_deliver(uuid)','hq_private.live_enqueue_v2(text,text,jsonb)'] loop
      if pg_catalog.has_function_privilege(app_role,private_routine,'EXECUTE') then
        raise exception 'HQ_LIVE_PRIVATE_EFFECTIVE_ACCESS: %, %',app_role,private_routine;
      end if;
    end loop;
  end loop;
end $private_watchdog$;

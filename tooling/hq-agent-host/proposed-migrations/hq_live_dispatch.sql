-- REVIEW-ONLY. Not in the deployer migration directory. Applying this unit is
-- an operational activation and requires separate reviewed rollout approval.
-- No credentials, Edge routes, public RPCs or grants are added. pg_cron runs
-- the existing database owner's private procedure, never an application role.
-- Historical pending rows have unknown delivery and are never replayed.

alter table hq_private.live_invalidations
  add column format_version integer not null default 1 check (format_version in (1,2)),
  add column event text not null default 'invalidate' check (event in ('invalidate','presence')),
  add column payload jsonb,
  add column attempts integer not null default 0 check (attempts between 0 and 6),
  add column attempt_token uuid,
  add column next_attempt_at timestamptz not null default pg_catalog.clock_timestamp(),
  add column last_error text check (last_error in ('publication-unverified','attempts-exhausted'));
-- Default stays legacy: only the validated producer explicitly writes v2.
create index hq_live_v2_pending_idx on hq_private.live_invalidations(next_attempt_at,created_at,id)
  where delivered_at is null and format_version=2;

create table hq_private.live_dispatch_state (
  singleton boolean primary key default true check(singleton),
  generation bigint not null default 0 check(generation>=0),
  circuit_open boolean not null default false,
  due_at timestamptz,
  last_error text check(last_error in ('publication-unverified','attempts-exhausted'))
);
alter table hq_private.live_dispatch_state enable row level security;
revoke all on hq_private.live_dispatch_state from public,anon,authenticated,service_role;
insert into hq_private.live_dispatch_state(singleton) values(true);

create function hq_private.live_dispatch_cancel() returns void
language plpgsql security definer set search_path='' as $$
declare j record; begin
  for j in select jobid from cron.job where jobname='hq-live-once' and username=current_user loop
    perform cron.unschedule(j.jobid);
  end loop;
  update hq_private.live_dispatch_state set due_at=null where singleton;
end $$;

-- Caller holds dispatch state. No transport or outbox row lock is taken here.
create function hq_private.live_dispatch_schedule(p_due timestamptz) returns void
language plpgsql security definer set search_path='' as $$
declare seconds integer; schedule text; wall timestamp; zone text; begin
  if p_due is null or not pg_catalog.isfinite(p_due) then raise exception 'HQ_INVALID_DISPATCH_TIME' using errcode='22023'; end if;
  seconds:=greatest(1,pg_catalog.ceil(extract(epoch from p_due-pg_catalog.clock_timestamp()))::integer+1);
  if seconds<=59 then schedule:=seconds::text||' seconds';
  else
    zone:=coalesce(nullif(pg_catalog.current_setting('cron.timezone',true),''),'GMT');
    wall:=(pg_catalog.date_trunc('minute',p_due)+interval '1 minute') at time zone zone;
    schedule:=extract(minute from wall)::integer::text||' '||extract(hour from wall)::integer::text||' '||
      extract(day from wall)::integer::text||' '||extract(month from wall)::integer::text||' *';
  end if;
  perform cron.schedule('hq-live-once',schedule,'call hq_private.live_dispatch_tick()');
  update hq_private.live_dispatch_state set due_at=p_due where singleton;
end $$;

create function hq_private.live_enqueue_v2(p_kind text,p_event text,p_payload jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare state hq_private.live_dispatch_state; key text; begin
  if p_kind is null or p_kind not in ('brain','company','access','agents')
    or p_event is null or p_event not in ('invalidate','presence')
    or p_payload is null or pg_catalog.jsonb_typeof(p_payload)<>'object' then
    raise exception 'HQ_INVALID_LIVE_EVENT' using errcode='22023';
  end if;
  if (p_event='invalidate' and p_payload<>pg_catalog.jsonb_build_object('kind',p_kind)) or
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
  select * into state from hq_private.live_dispatch_state where singleton for update;
  insert into hq_private.live_invalidations(kind,format_version,event,payload)
    values(p_kind,2,p_event,p_payload);
  update hq_private.live_dispatch_state set generation=generation+1 where singleton;
  -- New events never reset a failure budget/circuit or supersede an armed retry.
  if not state.circuit_open and state.due_at is null then
    perform hq_private.live_dispatch_schedule(pg_catalog.clock_timestamp());
  end if;
  perform pg_catalog.set_config(key,'1',true);
end $$;

create or replace function hq_private.live_emit(p_kind text) returns void
language plpgsql security definer set search_path='' as $$ begin
  perform hq_private.live_enqueue_v2(p_kind,'invalidate',pg_catalog.jsonb_build_object('kind',p_kind));
end $$;

create or replace function hq_private.live_deliver(p_id uuid) returns boolean
language plpgsql security definer set search_path='' as $$
declare item hq_private.live_invalidations; expected jsonb; begin
  select * into item from hq_private.live_invalidations where id=p_id for update;
  if not found then raise exception 'HQ_INVALID_LIVE_ID' using errcode='22023'; end if;
  if item.format_version<>2 then raise exception 'HQ_LIVE_LEGACY_UNVERIFIED'; end if;
  if item.delivered_at is not null then return true; end if;
  if item.attempt_token is null or item.attempts=0 then raise exception 'HQ_LIVE_ATTEMPT_REQUIRED'; end if;
  expected:=item.payload||pg_catalog.jsonb_build_object('id',item.id);
  perform realtime.send(expected,item.event,'hq-live',true);
  -- Provider generates an independent messages.id. Correlate payload.id only.
  if not exists(select 1 from realtime.messages m where m.topic='hq-live' and m.event=item.event
    and m.extension='broadcast' and m.private and m.payload=expected
    and m.inserted_at >= (pg_catalog.transaction_timestamp() at time zone 'UTC')) then
    raise exception 'HQ_LIVE_PUBLICATION_UNVERIFIED';
  end if;
  update hq_private.live_invalidations set delivered_at=pg_catalog.clock_timestamp(),last_error=null,attempt_token=null where id=p_id;
  return true;
end $$;

-- Retain signature/ACL of the old service-only recovery RPC, but explicitly
-- refuse ad-hoc publication. A service caller must not replay a reserved token
-- indefinitely, bypass the owner circuit or replay legacy rows. No production
-- caller was found; this deliberate recovery-contract change requires review.
create or replace function hq_private.live_flush(p_limit integer default 20) returns integer
language plpgsql security definer set search_path='' as $$ begin
  perform hq_private.require_brain_service();
  if p_limit is null or p_limit not between 1 and 100 then raise exception 'HQ_INVALID_LIVE_LIMIT' using errcode='22023'; end if;
  raise exception 'HQ_LIVE_OWNER_DISPATCH_REQUIRED' using errcode='55000';
end $$;

-- Separate no-transport reconciliation makes the generation/token fence
-- independently testable and keeps old callbacks from overwriting newer state.
create function hq_private.live_dispatch_reconcile(p_id uuid,p_token uuid,p_generation bigint) returns void
language plpgsql security invoker set search_path='' as $$
declare state hq_private.live_dispatch_state; current_item hq_private.live_invalidations; next_due timestamptz;
begin
  if p_id is null or p_token is null or p_generation is null or p_generation<0 then
    raise exception 'HQ_INVALID_LIVE_RECONCILE' using errcode='22023';
  end if;
  select * into state from hq_private.live_dispatch_state where singleton for update;
  if state.circuit_open then perform hq_private.live_dispatch_cancel(); return; end if;
  select min(next_attempt_at) into next_due from hq_private.live_invalidations where format_version=2 and delivered_at is null;
  -- Another owner invocation may have superseded this reservation between
  -- its COMMIT and row-lock acquisition. Durable delivery wins; a stale token
  -- must not overwrite a newer attempt's diagnostic outcome.
  select * into current_item from hq_private.live_invalidations where id=p_id;
  if current_item.delivered_at is not null then
    update hq_private.live_dispatch_state set last_error=null where singleton;
  elsif current_item.attempt_token=p_token then
    update hq_private.live_dispatch_state set last_error='publication-unverified' where singleton;
  end if;
  if next_due is null and state.generation=p_generation then
    perform hq_private.live_dispatch_cancel();
  else
    -- A newer generation retains a wake even if this snapshot appears drained.
    perform hq_private.live_dispatch_schedule(greatest(coalesce(next_due,pg_catalog.clock_timestamp()),pg_catalog.clock_timestamp()+interval '1 second'));
  end if;
end $$;

-- Invoker-only owner procedure: SECURITY DEFINER or a procedure SET clause would
-- prohibit COMMIT. All names are qualified and each transaction sets an empty
-- local search_path. No public/application role receives EXECUTE or schema access.
create procedure hq_private.live_dispatch_tick()
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
  if state.circuit_open then perform hq_private.live_dispatch_cancel(); return; end if;
  observed_generation:=state.generation;
  select * into item from hq_private.live_invalidations where format_version=2 and delivered_at is null
    and next_attempt_at<=pg_catalog.clock_timestamp() order by created_at,id limit 1 for update skip locked;
  if not found then
    select min(next_attempt_at) into next_due from hq_private.live_invalidations where format_version=2 and delivered_at is null;
    if next_due is null then perform hq_private.live_dispatch_cancel();
    else perform hq_private.live_dispatch_schedule(greatest(next_due,pg_catalog.clock_timestamp()+interval '1 second')); end if;
    return;
  end if;
  if item.attempts>=6 then
    update hq_private.live_invalidations set last_error='attempts-exhausted',attempt_token=null where id=item.id;
    update hq_private.live_dispatch_state set circuit_open=true,last_error='attempts-exhausted' where singleton;
    perform hq_private.live_dispatch_cancel(); return;
  end if;
  token:=pg_catalog.gen_random_uuid();
  next_due:=pg_catalog.clock_timestamp()+pg_catalog.make_interval(secs=>least(300,5*(2^item.attempts)::integer));
  update hq_private.live_invalidations set attempts=attempts+1,attempt_token=token,next_attempt_at=next_due where id=item.id;
  perform hq_private.live_dispatch_schedule(next_due);
  -- Durable attempt and retry survive a transport error, cancellation or crash.
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

-- The claim also invokes presence after its status update. Keeping its existing
-- synchronous realtime.send would leave the same transport dependency in claim.
create or replace function hq_private.worker_presence(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_seen timestamptz:=clock_timestamp(); v_count integer; v_agent text; v_task uuid; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  update hq_private.agent_workers set last_seen_at=v_seen where worker_id=p_worker_id and enabled;
  get diagnostics v_count=row_count;
  if v_count<>1 or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select j.agent_id,coalesce(j.task_id,j.id) into v_agent,v_task from public.hq_agent_jobs j
    where j.worker_id=p_worker_id and j.status='working' and j.lease_expires_at>v_seen order by j.started_at desc,j.id limit 1;
  perform hq_private.live_enqueue_v2('agents','presence',jsonb_build_object('observedAt',v_seen,'agentId',v_agent,'taskId',v_task));
  return jsonb_build_object('accepted',true);
end $$;

revoke all on function hq_private.live_dispatch_cancel(),hq_private.live_dispatch_schedule(timestamptz),
  hq_private.live_enqueue_v2(text,text,jsonb),hq_private.live_dispatch_reconcile(uuid,uuid,bigint) from public,anon,authenticated,service_role;
revoke all on procedure hq_private.live_dispatch_tick() from public,anon,authenticated,service_role;
-- Existing routine owners, grants, signatures, channel policies and worker
-- guards are retained by CREATE OR REPLACE. No activation-time recovery of old
-- entries, schedule creation, new credentials, role grants or data cleanup.

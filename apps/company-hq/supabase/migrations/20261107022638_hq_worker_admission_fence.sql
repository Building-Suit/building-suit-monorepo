-- Canonical phase-1 forward migration: fence and exact staging-worker initial pause.
-- REVIEW PROPOSAL ONLY. Outside the active migrations directory deliberately.
-- Apply before the five pilot proposals, in one approved staging transaction.
-- This fences claims, NOT recovery/roster/Drive publication or legacy shutdown.
begin;
-- PG17 staging: bound only this migration transaction, never worker sessions.
-- Refuse a busy install and roll back rather than consume a heartbeat deadline.
set local lock_timeout='1s';
set local statement_timeout='5s';
set local transaction_timeout='8s';
-- Global order: queue -> jobs -> worker registry. Heartbeat does not take queue
-- and updates jobs before registry; presence's jobs SELECT is compatible with
-- SHARE ROW EXCLUSIVE. Acquire these BEFORE FK/trigger DDL can invert the order.
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
lock table public.hq_agent_jobs in share row exclusive mode;
lock table hq_private.agent_workers in share row exclusive mode;
create table hq_private.worker_admission_pauses (
  worker_id uuid primary key references hq_private.agent_workers(worker_id),
  paused boolean not null,
  generation bigint not null check(generation > 0),
  request_id uuid not null,
  reason text not null check(length(reason) between 1 and 200),
  changed_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table hq_private.worker_admission_pauses enable row level security;
revoke all on hq_private.worker_admission_pauses from public,anon,authenticated,service_role;

-- Administrative SQL only. Never callable by the technical worker or founder.
-- CAS generation makes stale retries/unpause fail rather than undo a newer hold.
create function hq_private.set_worker_admission_pause(p_worker_id uuid,p_paused boolean,p_expected_generation bigint,p_request_id uuid,p_reason text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_generation bigint; v_previous hq_private.worker_admission_pauses;
begin
  if p_worker_id is null or p_request_id is null or p_paused is null or p_expected_generation is null or p_expected_generation<0
    or p_reason is null or length(p_reason) not between 1 and 200 then
    raise exception 'HQ_ADMISSION_ARGUMENTS' using errcode='22023';
  end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'HQ_ADMISSION_ISOLATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if not exists(select 1 from hq_private.agent_workers where worker_id=p_worker_id and enabled) then
    raise exception 'HQ_WORKER_REQUIRED' using errcode='42501';
  end if;
  select * into v_previous from hq_private.worker_admission_pauses where worker_id=p_worker_id for update;
  v_generation:=coalesce(v_previous.generation,0);
  if v_previous.request_id=p_request_id then
    if v_previous.paused is distinct from p_paused or v_generation<>p_expected_generation+1 or v_previous.reason<>p_reason then
      raise exception 'HQ_ADMISSION_REQUEST_REUSED' using errcode='PT409';
    end if;
    return pg_catalog.jsonb_build_object('paused',v_previous.paused,'generation',v_generation);
  end if;
  if v_generation<>p_expected_generation then raise exception 'HQ_ADMISSION_GENERATION' using errcode='PT409'; end if;
  insert into hq_private.worker_admission_pauses(worker_id,paused,generation,request_id,reason)
    values(p_worker_id,p_paused,v_generation+1,p_request_id,p_reason)
    on conflict(worker_id) do update set paused=excluded.paused,generation=excluded.generation,request_id=excluded.request_id,reason=excluded.reason,changed_at=pg_catalog.clock_timestamp();
  return pg_catalog.jsonb_build_object('paused',p_paused,'generation',v_generation+1);
end $$;
revoke all on function hq_private.set_worker_admission_pause(uuid,boolean,bigint,uuid,text) from public,anon,authenticated,service_role;

create function hq_private.worker_admission_status(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_pause hq_private.worker_admission_pauses; v_active bigint;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'HQ_ADMISSION_ISOLATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into v_pause from hq_private.worker_admission_pauses where worker_id=p_worker_id;
  -- Include expired working leases. Expiry is not proof inference has stopped.
  select count(*) into v_active from public.hq_agent_jobs where worker_id=p_worker_id and status='working';
  return pg_catalog.jsonb_build_object('paused',coalesce(v_pause.paused,false),'generation',coalesce(v_pause.generation,0),'activeJobs',v_active);
end $$;
create function public.hq_worker_admission_status(p_worker_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_admission_status(p_worker_id); $$;
revoke all on function hq_private.worker_admission_status(uuid),public.hq_worker_admission_status(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_admission_status(uuid),public.hq_worker_admission_status(uuid) to authenticated;

-- Authoritative admission backstop for a function body already executing when
-- this migration commits. CREATE TRIGGER serializes with existing table writers;
-- later writes, even from an old cached function body, cannot create a lease.
-- Raising rolls the complete old claim transaction back, including cleanup.
-- Same-worker/same-lease heartbeat and completion are deliberately unaffected.
create function hq_private.guard_worker_admission() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.status is distinct from 'working' then return new; end if;
  if tg_op='UPDATE' and old.status='working' and old.worker_id is not distinct from new.worker_id
    and old.lease_token is not distinct from new.lease_token then return new; end if;
  if pg_catalog.current_setting('transaction_isolation')<>'read committed' then raise exception 'HQ_ADMISSION_ISOLATION'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if exists(select 1 from hq_private.worker_admission_pauses where worker_id=new.worker_id and paused) then
    raise exception 'HQ_ADMISSION_PAUSED' using errcode='PT409';
  end if;
  return new;
end $$;
revoke all on function hq_private.guard_worker_admission() from public,anon,authenticated,service_role;
create trigger hq_worker_admission_backstop before insert or update of status,worker_id,lease_token on public.hq_agent_jobs
  for each row execute function hq_private.guard_worker_admission();

-- Preserve the reviewed function, grants and overloads. Fail closed on any
-- unreviewed source drift. Inject after queue-lock + second auth check, BEFORE
-- cleanup, blocked-state writes, lease recovery or claim selection. Subsequent
-- department wrappers preserve this fenced implementation as their delegate.
do $patch$
declare v_oid oid:=pg_catalog.to_regprocedure('hq_private.worker_claim(uuid,integer,integer)'); v_source text; v_definition text;
  v_anchor constant text:='  update public.hq_agent_jobs j set status=''blocked'',error=''meeting-binding-stale''';
  v_guard constant text:='  if pg_catalog.current_setting(''transaction_isolation'')<>''read committed'' then raise exception ''HQ_ADMISSION_ISOLATION''; end if;
  if exists(select 1 from hq_private.worker_admission_pauses where worker_id=p_worker_id and paused) then
    return pg_catalog.jsonb_build_object(''job'',null,''admissionPaused'',true);
  end if;
';
begin
  select prosrc into v_source from pg_catalog.pg_proc where oid=v_oid;
  if v_source is null or pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_source,'UTF8')),'hex')<>'d848519cefda8b7ceadb205ddc35c0e92a0e06adaf6ecbfb9906468eb62f9e72' then
    raise exception 'HQ_ADMISSION_CLAIM_SOURCE_DRIFT';
  end if;
  v_definition:=pg_catalog.pg_get_functiondef(v_oid);
  if length(v_definition)-length(replace(v_definition,v_anchor,''))<>length(v_anchor) then
    raise exception 'HQ_ADMISSION_CLAIM_ANCHOR';
  end if;
  execute replace(v_definition,v_anchor,v_guard||v_anchor);
end $patch$;
-- Owner-approved phase 1, staging dpruoncalmwicrqhqelu only. Not a credential.
-- Scope to the independently verified existing worker; never disable its auth.
do $initial_pause$
declare
  v_worker constant uuid:='3ead9a59-d84b-4e95-9871-abba0b129404';
  v_request constant uuid:='fe6d97b2-d55f-45c6-9306-581e942649c0';
begin
  if (select count(*) from hq_private.agent_workers)<>1
    or not exists(select 1 from hq_private.agent_workers where worker_id=v_worker and enabled) then
    raise exception 'HQ_BOOTSTRAP_WORKER_IDENTITY_MISMATCH';
  end if;
  perform hq_private.set_worker_admission_pause(v_worker,true,0,v_request,'owner-approved staging phase-1 admission pause');
end $initial_pause$;
commit;

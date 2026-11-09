-- Staging-only activation: trusted deployment configuration must independently
-- verify project dpruoncalmwicrqhqelu. current_database()='postgres' is NOT a
-- project identity check; the hosted project_ref GUC is unavailable.
-- Run the entire file and migration-ledger update in one outer transaction.
-- No inner BEGIN/COMMIT: these would break the deployer's transaction boundary.
-- ON COMMIT DROP makes statement-by-statement autocommit fail at preflight,
-- before any persistent DDL. Deployment must stop on the first SQL error.
create temporary table hq_live_activation_snapshot (
  label text primary key,
  value jsonb not null
) on commit drop;

DO $preflight$
declare spec record; routine record; owner_id oid; app_role text;
begin
  if pg_catalog.to_regclass('pg_temp.hq_live_activation_snapshot') is null then
    raise exception 'HQ_LIVE_ACTIVATION_OUTER_TRANSACTION_REQUIRED';
  end if;
  if current_user<>'postgres' or session_user<>'postgres' or pg_catalog.current_database()<>'postgres' then
    raise exception 'HQ_LIVE_ACTIVATION_OWNER_DATABASE_MISMATCH';
  end if;
  if pg_catalog.current_setting('server_version_num')::integer not between 170000 and 179999
    or (select extversion from pg_catalog.pg_extension where extname='pg_cron') is distinct from '1.6.4' then
    raise exception 'HQ_LIVE_ACTIVATION_UNVERIFIED_RUNTIME';
  end if;
  if pg_catalog.current_setting('cron.database_name',true) is distinct from 'postgres'
    or pg_catalog.current_setting('cron.use_background_workers',true) is distinct from 'off'
    or pg_catalog.current_setting('cron.timezone',true) is distinct from 'GMT'
    or pg_catalog.current_setting('cron.host',true) is distinct from 'localhost'
    or pg_catalog.current_setting('cron.launch_active_jobs',true) is distinct from 'on'
    or pg_catalog.current_setting('cron.enable_superuser_jobs',true) is distinct from 'on'
    or pg_catalog.current_setting('cron.log_run',true) is distinct from 'on' then
    raise exception 'HQ_LIVE_ACTIVATION_CRON_CONFIG_DRIFT';
  end if;
  select oid into strict owner_id from pg_catalog.pg_roles where rolname='postgres';
  if not exists(select 1 from pg_catalog.pg_roles where oid=owner_id and not rolsuper and rolbypassrls)
    or not exists(select 1 from pg_catalog.pg_namespace where nspname='hq_private' and nspowner=owner_id) then
    raise exception 'HQ_LIVE_ACTIVATION_OWNER_AUTHORITY_DRIFT';
  end if;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.pg_has_role(app_role,owner_id,'USAGE') or pg_catalog.pg_has_role(app_role,owner_id,'SET')
      or pg_catalog.has_schema_privilege(app_role,'hq_private','CREATE') then
      raise exception 'HQ_LIVE_ACTIVATION_APPLICATION_OWNER_ACCESS: %',app_role;
    end if;
  end loop;
  if not pg_catalog.has_schema_privilege(current_user,'cron','USAGE')
    or not pg_catalog.has_function_privilege(current_user,'cron.schedule(text,text,text)','EXECUTE')
    or not pg_catalog.has_function_privilege(current_user,'cron.unschedule(bigint)','EXECUTE')
    or not pg_catalog.has_schema_privilege(current_user,'realtime','USAGE')
    or not pg_catalog.has_function_privilege(current_user,'realtime.send(jsonb,text,text,boolean)','EXECUTE')
    or not pg_catalog.has_table_privilege(current_user,'realtime.messages','SELECT')
    or not pg_catalog.has_table_privilege(current_user,'realtime.messages','INSERT') then
    raise exception 'HQ_LIVE_ACTIVATION_EXISTING_PRIVILEGES_REQUIRED';
  end if;
  if exists(select 1 from pg_catalog.pg_proc p where p.oid in
      ('cron.schedule(text,text,text)'::pg_catalog.regprocedure,'cron.unschedule(bigint)'::pg_catalog.regprocedure)
      and (pg_catalog.pg_get_userbyid(p.proowner)<>'supabase_admin' or p.prosecdef or p.prokind<>'f')) then
    raise exception 'HQ_LIVE_ACTIVATION_CRON_ROUTINE_DRIFT';
  end if;
  if exists(select 1 from cron.job where jobname='hq-live-once') then
    raise exception 'HQ_LIVE_ACTIVATION_JOB_NAME_COLLISION';
  end if;
  if pg_catalog.to_regclass('hq_private.live_dispatch_state') is not null
    or pg_catalog.to_regclass('hq_private.hq_live_v2_pending_idx') is not null
    or exists(select 1 from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid=p.pronamespace
      where n.nspname='hq_private' and p.proname in ('live_enqueue_v2','live_dispatch_cancel',
        'live_dispatch_schedule','live_dispatch_reconcile','live_dispatch_tick')) then
    raise exception 'HQ_LIVE_ACTIVATION_OBJECT_COLLISION';
  end if;
  -- Reject default grants instead of silently inheriting access from another
  -- administrator. Existing public/storage-specific defaults do not apply here.
  if exists(select 1 from pg_catalog.pg_default_acl d
      where d.defaclrole=owner_id and d.defaclnamespace in (0,'hq_private'::pg_catalog.regnamespace)
      and d.defaclobjtype in ('f','r')) then
    raise exception 'HQ_LIVE_ACTIVATION_DEFAULT_ACL_REVIEW_REQUIRED';
  end if;
  perform pg_catalog.set_config('lock_timeout','5s',true);
  lock table hq_private.live_invalidations in access exclusive mode;
  if not exists(select 1 from pg_catalog.pg_class c where c.oid='hq_private.live_invalidations'::pg_catalog.regclass
      and c.relowner=owner_id and c.relkind='r' and c.relrowsecurity)
    or exists(select 1 from pg_catalog.pg_attribute where attrelid='hq_private.live_invalidations'::pg_catalog.regclass
      and not attisdropped and attnum>0 and attname not in ('id','kind','created_at','delivered_at'))
    or (select count(*) from pg_catalog.pg_attribute where attrelid='hq_private.live_invalidations'::pg_catalog.regclass
      and not attisdropped and attnum>0)<>4 then
    raise exception 'HQ_LIVE_ACTIVATION_OUTBOX_SCHEMA_DRIFT';
  end if;
  if exists(select 1 from pg_catalog.pg_class c,
      lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      where c.oid='hq_private.live_invalidations'::pg_catalog.regclass and a.grantee<>owner_id)
    or exists(select 1 from pg_catalog.pg_attribute a,
      lateral pg_catalog.aclexplode(a.attacl) g
      where a.attrelid='hq_private.live_invalidations'::pg_catalog.regclass and g.grantee<>owner_id) then
    raise exception 'HQ_LIVE_ACTIVATION_OUTBOX_ACL_DRIFT';
  end if;
  for spec in select * from (values
    ('hq_private.live_flush(integer)','97650fa59af2cbee07a60c453a14fd66','service_role'),
    ('hq_private.live_deliver(uuid)','2abd64fb896bfd79efabbe1a8d3e7c21',null),
    ('hq_private.live_emit(text)','79eb60861a8f735cae7892e88c10c881',null),
    ('hq_private.worker_presence(uuid)','ebdba0ceeb97ee1acdc8f8de699f47e8','authenticated')
  ) expected(signature,body_md5,allowed_role) loop
    select p.* into routine from pg_catalog.pg_proc p where p.oid=pg_catalog.to_regprocedure(spec.signature);
    if not found then raise exception 'HQ_LIVE_ACTIVATION_ROUTINE_MISSING: %',spec.signature; end if;
    if routine.proowner<>owner_id or not routine.prosecdef or routine.prokind<>'f'
      or routine.proconfig is distinct from array['search_path=""']::text[]
      or pg_catalog.md5(routine.prosrc)<>spec.body_md5 then
      raise exception 'HQ_LIVE_ACTIVATION_ROUTINE_DRIFT: %',spec.signature;
    end if;
    if exists(select 1 from pg_catalog.aclexplode(coalesce(routine.proacl,pg_catalog.acldefault('f',routine.proowner))) a
      where a.grantee<>owner_id and (spec.allowed_role is null
        or a.grantee<>(select oid from pg_catalog.pg_roles where rolname=spec.allowed_role)
        or a.is_grantable)) then
      raise exception 'HQ_LIVE_ACTIVATION_ROUTINE_ACL_DRIFT: %',spec.signature;
    end if;
    if spec.allowed_role is not null and not pg_catalog.has_function_privilege(spec.allowed_role,routine.oid,'EXECUTE') then
      raise exception 'HQ_LIVE_ACTIVATION_EXISTING_CALLER_REQUIRED: %',spec.signature;
    end if;
    insert into pg_temp.hq_live_activation_snapshot values(spec.signature,
      pg_catalog.jsonb_build_object('owner',routine.proowner,'acl',routine.proacl,'config',routine.proconfig,
        'result',routine.prorettype,'args',routine.proargtypes::text,'security_definer',routine.prosecdef));
  end loop;
  select p.* into strict routine from pg_catalog.pg_proc p where p.oid='realtime.send(jsonb,text,text,boolean)'::pg_catalog.regprocedure;
  if pg_catalog.pg_get_userbyid(routine.proowner)<>'supabase_realtime_admin'
    or routine.prokind<>'f' or routine.prosecdef or routine.proconfig is not null
    or pg_catalog.md5(routine.prosrc)<>'c12384e30dda994bf2e0d23daeaea20b'
    or pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid))<>'77afe4a67a0330f080cb562cec0898bd'
    or routine.proacl::text is distinct from '{=X/supabase_realtime_admin,supabase_realtime_admin=X/supabase_realtime_admin,postgres=X/supabase_realtime_admin,dashboard_user=X/supabase_realtime_admin}' then
    raise exception 'HQ_LIVE_ACTIVATION_PROVIDER_DRIFT';
  end if;
  insert into pg_temp.hq_live_activation_snapshot values('provider',pg_catalog.to_jsonb(routine));
  for spec in select * from (values
    ('hq_private.require_brain_service()','187710e01e4ea8cdd7026d13cf7d1a6f',null),
    ('public.hq_live_flush(integer)','8e333ce0ccc3c2c8d4cd7fc5d9e70478','service_role'),
    ('public.hq_worker_presence(uuid)','8599cd38317c439e398bee2d5aa70470','authenticated')
  ) expected(signature,definition_md5,allowed_role) loop
    select p.* into strict routine from pg_catalog.pg_proc p where p.oid=spec.signature::pg_catalog.regprocedure;
    if routine.proowner<>owner_id or routine.prosecdef or routine.prokind<>'f'
      or routine.proconfig is distinct from array['search_path=""']::text[]
      or pg_catalog.md5(pg_catalog.pg_get_functiondef(routine.oid))<>spec.definition_md5
      or exists(select 1 from pg_catalog.aclexplode(coalesce(routine.proacl,pg_catalog.acldefault('f',routine.proowner))) a
        where a.grantee<>owner_id and (spec.allowed_role is null
          or a.grantee<>(select oid from pg_catalog.pg_roles where rolname=spec.allowed_role) or a.is_grantable)) then
      raise exception 'HQ_LIVE_ACTIVATION_WRAPPER_GUARD_DRIFT: %',spec.signature;
    end if;
    insert into pg_temp.hq_live_activation_snapshot values('unchanged:'||spec.signature,pg_catalog.to_jsonb(routine));
  end loop;
  insert into pg_temp.hq_live_activation_snapshot
    select 'legacy',coalesce(pg_catalog.jsonb_agg(pg_catalog.to_jsonb(i) order by id),'[]'::jsonb)
      from hq_private.live_invalidations i;
  insert into pg_temp.hq_live_activation_snapshot
    select 'outbox_acl',pg_catalog.jsonb_build_object('owner',relowner,'acl',relacl,'rls',relrowsecurity)
      from pg_catalog.pg_class where oid='hq_private.live_invalidations'::pg_catalog.regclass;
end $preflight$;

-- BEGIN EXACT REVIEWED PROPOSAL BODY
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
declare seconds integer; schedule text; begin
  if p_due is null or not pg_catalog.isfinite(p_due) then raise exception 'HQ_INVALID_DISPATCH_TIME' using errcode='22023'; end if;
  -- A recurring bounded wake survives a missed scheduler window. The durable
  -- next_attempt_at still enforces backoff: early ticks consume no attempt.
  -- Drain/circuit reconciliation removes the job, so idle queues never poll.
  seconds:=least(59,greatest(1,pg_catalog.ceil(extract(epoch from p_due-pg_catalog.clock_timestamp()))+1))::integer;
  schedule:=seconds::text||' seconds';
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
-- END EXACT REVIEWED PROPOSAL BODY

DO $postflight$
declare spec record; routine record; actual jsonb; owner_id oid; app_role text; relation_name text;
begin
  select oid into strict owner_id from pg_catalog.pg_roles where rolname='postgres';
  for spec in select label,value from pg_temp.hq_live_activation_snapshot where label like 'hq_private.%' loop
    select p.* into strict routine from pg_catalog.pg_proc p where p.oid=spec.label::pg_catalog.regprocedure;
    actual:=pg_catalog.jsonb_build_object('owner',routine.proowner,'acl',routine.proacl,'config',routine.proconfig,
      'result',routine.prorettype,'args',routine.proargtypes::text,'security_definer',routine.prosecdef);
    if actual is distinct from spec.value then raise exception 'HQ_LIVE_ACTIVATION_EXISTING_CONTRACT_CHANGED: %',spec.label; end if;
  end loop;
  for spec in select label,value from pg_temp.hq_live_activation_snapshot where label like 'unchanged:%' loop
    select pg_catalog.to_jsonb(p) into actual from pg_catalog.pg_proc p
      where p.oid=pg_catalog.substring(spec.label,11)::pg_catalog.regprocedure;
    if actual is distinct from spec.value then raise exception 'HQ_LIVE_ACTIVATION_GUARD_CHANGED: %',spec.label; end if;
  end loop;
  select pg_catalog.to_jsonb(p) into actual from pg_catalog.pg_proc p where p.oid='realtime.send(jsonb,text,text,boolean)'::pg_catalog.regprocedure;
  if actual is distinct from (select value from pg_temp.hq_live_activation_snapshot where label='provider') then
    raise exception 'HQ_LIVE_ACTIVATION_PROVIDER_CHANGED';
  end if;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',id,'kind',kind,'created_at',created_at,
      'delivered_at',delivered_at) order by id),'[]'::jsonb) into actual from hq_private.live_invalidations;
  if actual is distinct from (select value from pg_temp.hq_live_activation_snapshot where label='legacy')
    or exists(select 1 from hq_private.live_invalidations where format_version<>1 or event<>'invalidate'
      or payload is not null or attempts<>0 or attempt_token is not null or last_error is not null) then
    raise exception 'HQ_LIVE_ACTIVATION_LEGACY_ROWS_CHANGED';
  end if;
  select pg_catalog.jsonb_build_object('owner',relowner,'acl',relacl,'rls',relrowsecurity) into actual
    from pg_catalog.pg_class where oid='hq_private.live_invalidations'::pg_catalog.regclass;
  if actual is distinct from (select value from pg_temp.hq_live_activation_snapshot where label='outbox_acl') then
    raise exception 'HQ_LIVE_ACTIVATION_OUTBOX_ACCESS_CHANGED';
  end if;
  for spec in select * from (values
    ('hq_private.live_enqueue_v2(text,text,jsonb)','f',true),
    ('hq_private.live_dispatch_cancel()','f',true),
    ('hq_private.live_dispatch_schedule(timestamp with time zone)','f',true),
    ('hq_private.live_dispatch_reconcile(uuid,uuid,bigint)','f',false),
    ('hq_private.live_dispatch_tick()','p',false)
  ) expected(signature,kind,security_definer) loop
    select p.* into strict routine from pg_catalog.pg_proc p where p.oid=spec.signature::pg_catalog.regprocedure;
    if routine.proowner<>owner_id or routine.prokind::text<>spec.kind or routine.prosecdef<>spec.security_definer
      or (spec.kind='p' and routine.proconfig is not null)
      or (spec.kind='f' and routine.proconfig is distinct from array['search_path=""']::text[])
      or exists(select 1 from pg_catalog.aclexplode(coalesce(routine.proacl,pg_catalog.acldefault('f',routine.proowner))) a
        where a.grantee<>owner_id) then
      raise exception 'HQ_LIVE_ACTIVATION_PRIVATE_ROUTINE_DRIFT: %',spec.signature;
    end if;
    foreach app_role in array array['anon','authenticated','service_role'] loop
      if pg_catalog.has_function_privilege(app_role,routine.oid,'EXECUTE') then
        raise exception 'HQ_LIVE_ACTIVATION_EFFECTIVE_ROUTINE_ACCESS: %, %',app_role,spec.signature;
      end if;
    end loop;
  end loop;
  foreach app_role in array array['anon','authenticated','service_role'] loop
    if pg_catalog.has_function_privilege(app_role,'hq_private.live_deliver(uuid)','EXECUTE')
      or pg_catalog.has_function_privilege(app_role,'hq_private.live_emit(text)','EXECUTE') then
      raise exception 'HQ_LIVE_ACTIVATION_EFFECTIVE_PUBLISHER_ACCESS: %',app_role;
    end if;
    foreach relation_name in array array['hq_private.live_invalidations','hq_private.live_dispatch_state'] loop
      if pg_catalog.has_table_privilege(app_role,relation_name,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
        or pg_catalog.has_any_column_privilege(app_role,relation_name,'SELECT,INSERT,UPDATE,REFERENCES') then
        raise exception 'HQ_LIVE_ACTIVATION_EFFECTIVE_TABLE_ACCESS: %, %',app_role,relation_name;
      end if;
    end loop;
  end loop;
  if not exists(select 1 from pg_catalog.pg_class c where c.oid='hq_private.live_dispatch_state'::pg_catalog.regclass
      and c.relowner=owner_id and c.relrowsecurity)
    or exists(select 1 from pg_catalog.pg_class c,
      lateral pg_catalog.aclexplode(coalesce(c.relacl,pg_catalog.acldefault('r',c.relowner))) a
      where c.oid='hq_private.live_dispatch_state'::pg_catalog.regclass and a.grantee<>owner_id)
    or (select count(*) from hq_private.live_dispatch_state)<>1
    or not exists(select 1 from hq_private.live_dispatch_state where singleton and generation=0
      and not circuit_open and due_at is null and last_error is null)
    or exists(select 1 from cron.job where jobname='hq-live-once') then
    raise exception 'HQ_LIVE_ACTIVATION_UNEXPECTED_INITIAL_STATE';
  end if;
end $postflight$;
-- Temporary evidence disappears only when the outer deployment transaction commits.

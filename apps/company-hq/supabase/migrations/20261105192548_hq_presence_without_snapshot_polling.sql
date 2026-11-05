-- Liveness is a lightweight observation, not a business snapshot change.
-- Keep the existing worker/session guard and host heartbeat. No new polling,
-- schedule, table grant or provider permission is introduced.
create or replace function hq_private.worker_presence(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_seen timestamptz:=clock_timestamp(); v_count integer; v_agent text; v_task uuid; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  update hq_private.agent_workers set last_seen_at=v_seen where worker_id=p_worker_id and enabled;
  get diagnostics v_count=row_count;
  if v_count<>1 or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select j.agent_id,coalesce(j.task_id,j.id) into v_agent,v_task from public.hq_agent_jobs j
    where j.worker_id=p_worker_id and j.status='working' and j.lease_expires_at>v_seen order by j.started_at desc,j.id limit 1;
  -- Ephemeral, founder-private telemetry: reconnect snapshots cover missed
  -- frames. This never enters the durable application invalidation outbox.
  begin
    perform realtime.send(jsonb_build_object('observedAt',v_seen,'agentId',v_agent,'taskId',v_task),'presence','hq-live',true);
  exception when others then
    -- Missing telemetry expires honestly at the client. It cannot cancel an
    -- otherwise valid job lease or force a second model invocation.
    null;
  end;
  return jsonb_build_object('accepted',true);
end $$;

-- Claims previously obtained their work-start refresh indirectly from the
-- unconditional presence invalidation. Emit only real job state transitions;
-- lease renewal and timestamp-only heartbeats leave the UI snapshot untouched.
create function hq_private.live_agent_job_changed() returns trigger
language plpgsql security definer set search_path='' as $$ begin
  if tg_op='UPDATE' and (new.status,new.agent_id,new.task_id,new.error,new.completed_at)
    is not distinct from (old.status,old.agent_id,old.task_id,old.error,old.completed_at) then return new; end if;
  perform hq_private.live_emit('agents');
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
create trigger hq_live_agent_job after insert or update or delete on public.hq_agent_jobs
  for each row execute function hq_private.live_agent_job_changed();
revoke all on function hq_private.live_agent_job_changed() from public,anon,authenticated,service_role;

create or replace function hq_private.worker_sync_roster(p_worker_id uuid,p_agents jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb; v_count integer; v_digest text; v_before jsonb; v_after jsonb; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_agents) is distinct from 'array' or jsonb_array_length(p_agents)<>10 or octet_length(p_agents::text)>50000
    then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select count(distinct x->>'id') into v_count from jsonb_array_elements(p_agents) x;
  if v_count<>10 then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  select jsonb_agg(jsonb_build_array(r.id,r.source_digest,r.enabled,r.manager_id) order by r.id) into v_before from hq_private.agent_roster r;
  for a in select * from jsonb_array_elements(p_agents) loop
    if jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'id','') not in
      ('AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001')
      or coalesce(char_length(a->>'name'),0) not between 1 and 120
      or coalesce(char_length(a->>'lifecycle'),0) not between 1 and 160
      or (coalesce(a->>'name','')||coalesce(a->>'lifecycle','')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]'
      or coalesce(a->>'profileFileId','') !~ '^[A-Za-z0-9_-]{8,200}$'
      or coalesce(a->>'model','') !~ '^gpt-[A-Za-z0-9.-]{1,70}$'
      or coalesce(a->>'effort','') not in ('minimal','low','medium','high','xhigh')
      or jsonb_typeof(a->'skillFileIds') is distinct from 'array' or jsonb_array_length(a->'skillFileIds')>10
      or exists(select 1 from jsonb_array_elements_text(a->'skillFileIds') s where s !~ '^[A-Za-z0-9_-]{8,200}$')
      or (a->>'departmentKey' is not null and not exists(select 1 from public.hq_departments d where d.department_key=a->>'departmentKey'))
      or a->>'managerId'=a->>'id' or (a->>'managerId' is not null and not exists(select 1 from jsonb_array_elements(p_agents) b where b->>'id'=a->>'managerId'))
      or not exists(select 1 from hq_private.brain_files f where f.file_id=a->>'profileFileId' and f.in_scope and not f.trashed
        and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')
      or exists(select 1 from jsonb_array_elements_text(a->'skillFileIds') s where not exists(select 1 from hq_private.brain_files f
        where f.file_id=s and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')) then
      raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
    v_digest:=encode(extensions.digest(a::text,'sha256'),'hex');
    insert into hq_private.agent_roster(id,name,role,department_key,enabled,profile_file_id,skill_file_ids,lifecycle,model,effort,source_digest)
      values(a->>'id',a->>'name',case a->>'id' when 'AG-CEO-001' then 'CEO' when 'AG-HR-001' then 'HR Lead'
        else coalesce(a->>'departmentKey','Employee') end,a->>'departmentKey',true,a->>'profileFileId',a->'skillFileIds',a->>'lifecycle',a->>'model',a->>'effort',v_digest)
      on conflict(id) do update set name=excluded.name,department_key=excluded.department_key,enabled=true,profile_file_id=excluded.profile_file_id,
        skill_file_ids=excluded.skill_file_ids,lifecycle=excluded.lifecycle,model=excluded.model,effort=excluded.effort,source_digest=excluded.source_digest;
  end loop;
  update hq_private.agent_roster r set manager_id=item->>'managerId' from jsonb_array_elements(p_agents) item where r.id=item->>'id';
  select jsonb_agg(jsonb_build_array(r.id,r.source_digest,r.enabled,r.manager_id) order by r.id) into v_after from hq_private.agent_roster r;
  if v_before is distinct from v_after then
    perform hq_private.live_emit('agents');
    perform hq_private.live_emit('company');
  end if;
  return jsonb_build_object('accepted',true,'count',10);
end $$;

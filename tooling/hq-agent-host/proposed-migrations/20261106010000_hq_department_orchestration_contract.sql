-- Bind worker orchestration to current canonical roster data and HR evidence.
-- This migration creates no employees or qualifications and executes no work.
alter table hq_private.agent_roster add column model_tier text
  check(model_tier is null or model_tier in ('T1_WORKER','T2_HEAD','T3_EXEC'));

create table hq_private.workforce_qualifications (
  agent_id text primary key references hq_private.agent_roster(id),
  scope text not null check(scope='bounded-drafting-v1'),
  evidence_file_id text not null references hq_private.brain_files(file_id),
  evidence_source_version text not null check(evidence_source_version ~ '^[0-9]{1,40}$'),
  reviewer_id text not null references hq_private.agent_roster(id),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  qualified_at timestamptz not null default clock_timestamp(),
  check(reviewer_id='AG-HR-003')
);
alter table hq_private.workforce_qualifications enable row level security;
revoke all on hq_private.workforce_qualifications from public,anon,authenticated,service_role;
create trigger hq_workforce_qualification_immutable before update or delete on hq_private.workforce_qualifications
  for each row execute function hq_private.immutable_record();

create function hq_private.workforce_agent_binding_digest(p_agent_id text) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(jsonb_build_array(r.id,r.department_key,r.profile_file_id,
    (select f.source_version from hq_private.brain_files f where f.file_id=r.profile_file_id),r.skill_file_ids,
    (select coalesce(jsonb_agg(jsonb_build_array(f.file_id,f.source_version) order by f.file_id),'[]'::jsonb)
      from hq_private.brain_files f where f.file_id in (select jsonb_array_elements_text(r.skill_file_ids))),
    r.model_tier,r.manager_id,r.lifecycle,r.model,r.effort,r.source_digest)::text,'sha256'),'hex')
  from hq_private.agent_roster r where r.id=p_agent_id
$$;
revoke all on function hq_private.workforce_agent_binding_digest(text) from public,anon,authenticated,service_role;

create function hq_private.workforce_agent_qualified(p_agent_id text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from hq_private.agent_roster r
    join hq_private.agent_roster m on m.id=r.manager_id
    join hq_private.workforce_qualifications q on q.agent_id=r.id
    join hq_private.brain_files e on e.file_id=q.evidence_file_id and e.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and e.in_scope and not e.trashed
    where r.id=p_agent_id and r.enabled and r.model_tier='T1_WORKER' and m.model_tier='T2_HEAD'
      and r.department_key=m.department_key and r.lifecycle !~* '(configured|candidate|trial|pending|suspended|inactive|retired|terminated|archived|paused|testing-only)'
      and q.scope='bounded-drafting-v1' and q.reviewer_id='AG-HR-003'
      and e.source_version=q.evidence_source_version
      and q.binding_digest=hq_private.workforce_agent_binding_digest(r.id))
$$;
revoke all on function hq_private.workforce_agent_qualified(text) from public,anon,authenticated,service_role;

create function hq_private.workforce_qualification_context(p_agent_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select case when hq_private.workforce_agent_qualified(r.id) then jsonb_build_object(
    'status','qualified','evidenceId',q.evidence_file_id,'profileFileId',r.profile_file_id,
    'skillFileIds',r.skill_file_ids,'bindingDigest',q.binding_digest,'scope',q.scope,
    'modelTier',r.model_tier,'managerId',r.manager_id,'departmentKey',r.department_key) else null end
  from hq_private.agent_roster r left join hq_private.workforce_qualifications q on q.agent_id=r.id
  where r.id=p_agent_id
$$;
revoke all on function hq_private.workforce_qualification_context(text) from public,anon,authenticated,service_role;

-- A qualified worker may execute only after its direct head has completed
-- task-ack with that exact worker as delegate. Qualification alone is not
-- permission to bypass task scoping.
create function hq_private.workforce_head_authorized(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.hq_agent_jobs j
      join hq_private.agent_roster a on a.id=j.agent_id
      join hq_private.agent_roster m on m.id=a.manager_id
    where j.id=p_job_id and j.kind in ('task-start','task-work')
      and a.model_tier='T1_WORKER' and m.model_tier='T2_HEAD'
      and m.department_key=a.department_key and hq_private.workforce_agent_qualified(a.id)
      and ((j.kind='task-start' and exists(
        select 1 from public.hq_agent_jobs ack where ack.id=j.depends_on
          and ack.kind='task-ack' and ack.status='completed' and ack.agent_id=m.id
          and ack.result_text::jsonb->>'delegateId'=a.id))
        or (j.kind='task-work' and exists(
          select 1 from public.hq_agent_jobs start_job
            join public.hq_agent_jobs ack on ack.id=start_job.depends_on
          where start_job.id=j.depends_on and start_job.kind='task-start' and start_job.status='completed'
            and start_job.agent_id=a.id and ack.kind='task-ack' and ack.status='completed'
            and ack.agent_id=m.id and ack.result_text::jsonb->>'delegateId'=a.id)))
  )
$$;
revoke all on function hq_private.workforce_head_authorized(uuid) from public,anon,authenticated,service_role;

-- The canonical Brain registry is the source of identity and reporting lines.
-- Keep the existing ten identities and accept additional explicitly tiered T1
-- direct reports; no qualification is imported from identity/profile alone.
create or replace function hq_private.worker_sync_roster(p_worker_id uuid,p_agents jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb; v_count integer; v_digest text; v_id text; v_before jsonb; v_after jsonb; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_agents) is distinct from 'array' or jsonb_array_length(p_agents)<10 or jsonb_array_length(p_agents)>50 or octet_length(p_agents::text)>200000
    then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select count(distinct x->>'id') into v_count from jsonb_array_elements(p_agents) x;
  if v_count<>jsonb_array_length(p_agents) then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  select jsonb_agg(jsonb_build_array(r.id,r.source_digest,r.enabled,r.manager_id,r.model_tier) order by r.id)
    into v_before from hq_private.agent_roster r;
  foreach v_id in array array['AG-CEO-001','AG-HR-001','AG-HR-002','AG-HR-003','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001','AG-DEV-001'] loop
    if not exists(select 1 from jsonb_array_elements(p_agents) x where x->>'id'=v_id) then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  end loop;
  for a in select * from jsonb_array_elements(p_agents) loop
    if jsonb_typeof(a) is distinct from 'object' or coalesce(a->>'id','') !~ '^AG-[A-Z]+-[0-9]{3}$'
      or coalesce(char_length(a->>'name'),0) not between 1 and 120 or coalesce(char_length(a->>'lifecycle'),0) not between 1 and 160
      or (coalesce(a->>'name','')||coalesce(a->>'lifecycle','')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]'
      or a->>'modelTier' not in ('T1_WORKER','T2_HEAD','T3_EXEC')
      or coalesce(a->>'profileFileId','') !~ '^[A-Za-z0-9_-]{8,200}$'
      or coalesce(a->>'model','') !~ '^gpt-[A-Za-z0-9.-]{1,70}$'
      or coalesce(a->>'effort','') not in ('minimal','low','medium','high','xhigh')
      or jsonb_typeof(a->'skillFileIds') is distinct from 'array' or jsonb_array_length(a->'skillFileIds')>10
      or exists(select 1 from jsonb_array_elements_text(a->'skillFileIds') s where s !~ '^[A-Za-z0-9_-]{8,200}$')
      or (a->>'departmentKey' is not null and not exists(select 1 from public.hq_departments d where d.department_key=a->>'departmentKey'))
      or a->>'managerId'=a->>'id' or (a->>'managerId' is not null and not exists(select 1 from jsonb_array_elements(p_agents) b where b->>'id'=a->>'managerId'))
      or (a->>'modelTier'='T3_EXEC' and (a->>'id'<>'AG-CEO-001' or a->>'managerId' is not null))
      or (a->>'modelTier'='T2_HEAD' and (a->>'managerId'<>'AG-CEO-001' or a->>'departmentKey' is null))
      or (a->>'modelTier'='T1_WORKER' and (a->>'managerId' is null or a->>'departmentKey' is null or not exists(
        select 1 from jsonb_array_elements(p_agents) b where b->>'id'=a->>'managerId' and b->>'modelTier'='T2_HEAD' and b->>'departmentKey'=a->>'departmentKey')))
      or not exists(select 1 from hq_private.brain_files f where f.file_id=a->>'profileFileId' and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')
      or exists(select 1 from jsonb_array_elements_text(a->'skillFileIds') s where not exists(select 1 from hq_private.brain_files f
        where f.file_id=s and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')) then
      raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
    v_digest:=encode(extensions.digest(a::text,'sha256'),'hex');
    insert into hq_private.agent_roster(id,name,role,department_key,enabled,profile_file_id,skill_file_ids,lifecycle,model,effort,source_digest,manager_id,model_tier)
      values(a->>'id',a->>'name',case a->>'id' when 'AG-CEO-001' then 'CEO' when 'AG-HR-001' then 'HR Lead'
        else coalesce(nullif(a->>'role',''),a->>'departmentKey','Employee') end,
        a->>'departmentKey',true,a->>'profileFileId',a->'skillFileIds',a->>'lifecycle',a->>'model',a->>'effort',v_digest,a->>'managerId',a->>'modelTier')
      on conflict(id) do update set name=excluded.name,role=excluded.role,department_key=excluded.department_key,enabled=true,
        profile_file_id=excluded.profile_file_id,skill_file_ids=excluded.skill_file_ids,lifecycle=excluded.lifecycle,
        model=excluded.model,effort=excluded.effort,source_digest=excluded.source_digest,manager_id=excluded.manager_id,model_tier=excluded.model_tier;
  end loop;
  update hq_private.agent_roster r set enabled=false
    where r.enabled and not exists(select 1 from jsonb_array_elements(p_agents) x where x->>'id'=r.id);
  select jsonb_agg(jsonb_build_array(r.id,r.source_digest,r.enabled,r.manager_id,r.model_tier) order by r.id)
    into v_after from hq_private.agent_roster r;
  if v_before is distinct from v_after then
    perform hq_private.live_emit('agents');
    perform hq_private.live_emit('company');
  end if;
  return jsonb_build_object('accepted',true,'count',v_count);
end $$;

-- Bind live claims to the authoritative qualification table and expose only
-- eligible direct reports to a department head's orchestration stage.
create function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job jsonb; v_context jsonb; v_agent hq_private.agent_roster; v_manager hq_private.agent_roster; v_assignee hq_private.agent_roster; v_roster jsonb; begin
  v_job:=v->'job'; if v_job is null or jsonb_typeof(v_job)<>'object' then return v; end if;
  select * into v_agent from hq_private.agent_roster where id=v_job->>'agent_id';
  select * into v_manager from hq_private.agent_roster where id=v_agent.manager_id;
  v_context:=v_job->'context';
  v_context:=jsonb_set(v_context,'{agent}',coalesce(v_context->'agent','{}'::jsonb)||jsonb_build_object(
    'modelTier',v_agent.model_tier,'managerId',v_agent.manager_id,'managerModelTier',v_manager.model_tier,'departmentKey',v_agent.department_key,
    'qualification',hq_private.workforce_qualification_context(v_agent.id),
    'headAuthorization',hq_private.workforce_head_authorized((v_job->>'id')::uuid)));
  if v_context->'assignee'->>'id' is not null then
    select * into v_assignee from hq_private.agent_roster where id=v_context->'assignee'->>'id';
    v_context:=jsonb_set(v_context,'{assignee}',v_context->'assignee'||jsonb_build_object(
      'managerId',v_assignee.manager_id,'modelTier',v_assignee.model_tier),true);
  end if;
  if v_context->>'mode'='task-ack' then
    select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',r.role,'departmentKey',r.department_key,
      'lifecycle',r.lifecycle,'managerId',r.manager_id,'modelTier',r.model_tier,'profileFileId',r.profile_file_id,
      'skillFileIds',r.skill_file_ids,'qualification',hq_private.workforce_qualification_context(r.id)) order by r.id),'[]'::jsonb)
      into v_roster from hq_private.agent_roster r
      where r.manager_id=v_agent.id and r.model_tier='T1_WORKER' and hq_private.workforce_agent_qualified(r.id);
    v_context:=jsonb_set(v_context,'{roster}',v_roster,true);
  end if;
  v_job:=jsonb_set(v_job,'{context}',v_context,true);
  return jsonb_set(v,'{job}',v_job,true);
end $$;
revoke all on function hq_private.workforce_enrich_claim(jsonb) from public,anon,authenticated,service_role;
do $do$ begin
  if to_regprocedure('hq_private.worker_claim(uuid,integer)') is not null then
    alter function hq_private.worker_claim(uuid,integer) rename to worker_claim_before_department;
  end if;
  if to_regprocedure('hq_private.worker_claim(uuid,integer,integer)') is not null then
    alter function hq_private.worker_claim(uuid,integer,integer) rename to worker_claim_before_department_meeting;
  end if;
end $do$;
do $do$ begin
  if to_regprocedure('hq_private.worker_claim_before_department_meeting(uuid,integer,integer)') is not null then
    execute $sql$create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
      language sql security definer set search_path='' as $$ select hq_private.workforce_enrich_claim(
        hq_private.worker_claim_before_department_meeting(p_worker_id,p_lease_seconds,0)) $$ $sql$;
  else
    execute $sql$create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
      language sql security definer set search_path='' as $$ select hq_private.workforce_enrich_claim(
        hq_private.worker_claim_before_department(p_worker_id,p_lease_seconds)) $$ $sql$;
  end if;
  if to_regprocedure('hq_private.worker_claim_before_department_meeting(uuid,integer,integer)') is not null then
    execute $sql$create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
      language sql security definer set search_path='' as $$ select hq_private.workforce_enrich_claim(
        hq_private.worker_claim_before_department_meeting(p_worker_id,p_lease_seconds,p_meeting_protocol)) $$ $sql$;
  end if;
end $do$;

-- A T1 worker's artifact goes to the actual T2 direct manager before Steve's
-- independent review. Existing HR direct reports keep the same route.
create function hq_private.route_worker_review_to_head() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_task public.hq_business_tasks; v_parent public.hq_agent_jobs; v_author hq_private.agent_roster; v_head hq_private.agent_roster; begin
  if new.kind<>'ceo-review' or new.task_id is null then return new; end if;
  select * into v_parent from public.hq_agent_jobs where id=new.depends_on;
  if v_parent.kind not in ('task-work','task-start') then return new; end if;
  select * into v_task from public.hq_business_tasks where id=new.task_id;
  select * into v_author from hq_private.agent_roster where id=v_task.assignee_id;
  select * into v_head from hq_private.agent_roster where id=v_author.manager_id;
  if v_author.model_tier='T1_WORKER' and v_head.model_tier='T2_HEAD' and v_head.department_key=v_author.department_key then
    new.kind:='head-review'; new.agent_id:=v_head.id;
  end if;
  return new;
end $$;
revoke all on function hq_private.route_worker_review_to_head() from public,anon,authenticated,service_role;
create trigger hq_route_worker_review_to_head before insert on public.hq_agent_jobs
  for each row execute function hq_private.route_worker_review_to_head();

-- Replace the initial staffing attribution with data-driven manager/tier lookup.
drop trigger hq_department_staffing_need_after_block on public.hq_agent_jobs;
create or replace function hq_private.record_department_staffing_need() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_head hq_private.agent_roster; v_agent hq_private.agent_roster; v_founder uuid;
begin
  if new.status<>'blocked' or new.error<>'staffing-required' or new.task_id is null then return new; end if;
  select * into v_agent from hq_private.agent_roster where id=new.agent_id;
  if v_agent.model_tier='T2_HEAD' then v_head:=v_agent;
  else select * into v_head from hq_private.agent_roster where id=v_agent.manager_id and model_tier='T2_HEAD'; end if;
  select t.founder_user_id into v_founder from public.hq_business_tasks t where t.id=new.task_id;
  if v_head.id is null or v_head.department_key is null or v_founder is null then return new; end if;
  insert into hq_private.department_staffing_needs(founder_user_id,task_id,department_key,department_head_id,blocked_job_id,blocked_agent_id,reason_code)
    values(v_founder,new.task_id,v_head.department_key,v_head.id,new.id,new.agent_id,'no-eligible-worker')
    on conflict(task_id,department_key) do nothing;
  return new;
end $$;
create trigger hq_department_staffing_need_after_block after update of status,error on public.hq_agent_jobs
  for each row when (new.status='blocked' and new.error='staffing-required') execute function hq_private.record_department_staffing_need();
revoke all on function hq_private.worker_claim(uuid,integer),hq_private.record_department_staffing_need() from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_claim(uuid,integer) to authenticated;
do $do$ begin
  if to_regprocedure('hq_private.worker_claim_before_department(uuid,integer)') is not null then
    execute 'revoke all on function hq_private.worker_claim_before_department(uuid,integer) from public,anon,authenticated,service_role';
  end if;
  if to_regprocedure('hq_private.worker_claim_before_department_meeting(uuid,integer,integer)') is not null then
    execute 'revoke all on function hq_private.worker_claim_before_department_meeting(uuid,integer,integer), hq_private.worker_claim(uuid,integer,integer) from public,anon,authenticated,service_role';
    execute 'grant execute on function hq_private.worker_claim(uuid,integer,integer) to authenticated';
  end if;
end $do$;

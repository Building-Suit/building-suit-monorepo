-- Staffing proposals reuse actual internal task execution and independent review.
-- Canonical publication is deliberately unavailable. No staff, receipt, lifecycle
-- or continuation is created by approval. A separately reviewed publisher setup
-- is required before those phases can run.
begin;
set local lock_timeout='3s';
set local statement_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
lock table public.hq_agent_jobs in share row exclusive mode;
lock table public.hq_business_tasks in share row exclusive mode;
lock table hq_private.agent_roster in share row exclusive mode;

do $$ declare c record; begin
  for c in select conname,pg_get_constraintdef(oid) definition from pg_constraint
    where conrelid='public.hq_agent_jobs'::regclass and contype='c'
      and pg_get_constraintdef(oid) like '%kind%task-route%' loop
    execute format('alter table public.hq_agent_jobs drop constraint %I',c.conname);
    execute format('alter table public.hq_agent_jobs add constraint %I check (%s or kind in (''staffing-plan'',''staffing-review''))',
      c.conname,substring(c.definition from 8 for char_length(c.definition)-8));
  end loop;
end $$;

create table hq_private.staffing_workflows (
  id uuid primary key default gen_random_uuid(),
  need_id uuid not null unique references hq_private.department_staffing_needs(id),
  founder_user_id uuid not null,
  scope_digest text not null check(scope_digest ~ '^[0-9a-f]{64}$'),
  planning_task_id uuid unique references public.hq_business_tasks(id),
  status text not null default 'planning-blocked' check(status in
    ('planning-blocked','planning','approval-required','publication-blocked','rejected','canceled','failed','not-required')),
  blocker text not null default 'staffing-planner-unavailable' check(blocker ~ '^[a-z-]{1,80}$'),
  updated_at timestamptz not null default clock_timestamp()
);
alter table hq_private.staffing_workflows enable row level security;
revoke all on hq_private.staffing_workflows from public,anon,authenticated,service_role;
create table hq_private.staffing_plans (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null unique references hq_private.staffing_workflows(id),
  artifact_id uuid not null unique references public.hq_task_artifacts(id),
  hr_plan_job_id uuid not null references public.hq_agent_jobs(id),
  ceo_review_job_id uuid not null references public.hq_agent_jobs(id),
  document jsonb not null check(jsonb_typeof(document)='object' and octet_length(document::text)<=65536),
  digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table hq_private.staffing_plans enable row level security;
revoke all on hq_private.staffing_plans from public,anon,authenticated,service_role;
create trigger hq_staffing_plan_immutable before update or delete on hq_private.staffing_plans
  for each row execute function hq_private.immutable_record();
create table hq_private.staffing_draft_bindings (
  artifact_id uuid primary key references public.hq_task_artifacts(id),
  document jsonb not null
);
alter table hq_private.staffing_draft_bindings enable row level security;
revoke all on hq_private.staffing_draft_bindings from public,anon,authenticated,service_role;
create trigger hq_staffing_draft_binding_immutable before update or delete on hq_private.staffing_draft_bindings
  for each row execute function hq_private.immutable_record();

create table hq_private.staffing_claim_bindings (
  job_id uuid primary key references public.hq_agent_jobs(id),
  binding jsonb not null
);
alter table hq_private.staffing_claim_bindings enable row level security;
revoke all on hq_private.staffing_claim_bindings from public,anon,authenticated,service_role;
create trigger hq_staffing_claim_binding_immutable before update or delete on hq_private.staffing_claim_bindings
  for each row execute function hq_private.immutable_record();

create table hq_private.staffing_decisions (
  plan_id uuid primary key references hq_private.staffing_plans(id),
  actor_user_id uuid not null,
  session_id uuid not null,
  request_key uuid not null,
  decision text not null check(decision in ('approved','rejected')),
  plan_digest text not null,
  resume_original boolean not null,
  created_at timestamptz not null default clock_timestamp(),
  unique(actor_user_id,request_key)
);
alter table hq_private.staffing_decisions enable row level security;
revoke all on hq_private.staffing_decisions from public,anon,authenticated,service_role;
create trigger hq_staffing_decision_immutable before update or delete on hq_private.staffing_decisions
  for each row execute function hq_private.immutable_record();

create function hq_private.staffing_scope_digest(p_task_id uuid) returns text
language sql stable security definer set search_path='' as $$
  select encode(extensions.digest(jsonb_build_array(t.id,t.founder_user_id,t.title,t.brief,t.acceptance,t.requested_assignee_id)::text,'sha256'),'hex')
  from public.hq_business_tasks t where t.id=p_task_id
$$;
revoke all on function hq_private.staffing_scope_digest(uuid) from public,anon,authenticated,service_role;

-- Catalogue is bounded to existing, in-scope skills already assigned to a
-- canonical T1 in this approved department. It cannot grant new capabilities.
create function hq_private.staffing_catalogue(p_department text) returns jsonb
language sql stable security definer set search_path='' as $$
  with recursive paths as (
    select f.file_id,f.parent_ids,f.name::text path,array[f.file_id] seen,1 depth from hq_private.brain_files f
    where f.in_scope and not f.trashed and f.source_version is not null and cardinality(f.parent_ids)=1
      and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.mime_type<>'application/vnd.google-apps.folder'
      and f.name not in ('.','..') and position('/' in f.name)=0 and position(chr(92) in f.name)=0 and f.name !~ '[\x01-\x1F]' and char_length(f.name) between 1 and 250
      and exists(select 1 from hq_private.agent_roster r where r.enabled and r.department_key=p_department
        and r.model_tier='T1_WORKER' and r.skill_file_ids ? f.file_id)
    union all
    select p.file_id,f.parent_ids,f.name||'/'||p.path,p.seen||f.file_id,p.depth+1
      from paths p join hq_private.brain_files f on p.parent_ids=array[f.file_id]
      where p.depth<16 and not f.file_id=any(p.seen) and cardinality(f.parent_ids)=1
        and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
        and f.mime_type='application/vnd.google-apps.folder' and f.name not in ('.','..')
        and position('/' in f.name)=0 and position(chr(92) in f.name)=0 and f.name !~ '[\x01-\x1F]' and char_length(f.name) between 1 and 250
  )
  select coalesce(jsonb_agg(jsonb_build_object('fileId',f.file_id,'sourceVersion',f.source_version,'name',f.name,'path',p.path) order by f.file_id),'[]'::jsonb)
  from paths p join hq_private.brain_files f using(file_id)
  where p.parent_ids=array['1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8']::text[]
    and starts_with(p.path,case p_department
      when 'development-maintenance' then 'Departments/Development/Skills/'
      when 'research-market-intelligence' then 'Departments/Research/Skills/'
      when 'customer-acquisition-partnerships' then 'Departments/Customer Acquisition/Skills/'
      when 'customer-success-onboarding' then 'Departments/Customer Success/Skills/'
      when 'social-community' then 'Departments/Social/Skills/'
      when 'email-lifecycle' then 'Departments/Email/Skills/' else null end)

$$;
revoke all on function hq_private.staffing_catalogue(text) from public,anon,authenticated,service_role;

-- A historical gap is not evidence that another hire is still needed.
create function hq_private.staffing_gap_exists(p_department text,p_head text) returns boolean
language sql stable security definer set search_path='' as $$
  select not exists(select 1 from hq_private.agent_roster r where r.enabled and r.model_tier='T1_WORKER'
    and r.model='gpt-6.1-terra' and r.manager_id=p_head and r.department_key=p_department
    and hq_private.workforce_agent_qualified(r.id))
$$;
revoke all on function hq_private.staffing_gap_exists(text,text) from public,anon,authenticated,service_role;

create function hq_private.start_staffing_plan(p_need_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare n hq_private.department_staffing_needs; w hq_private.staffing_workflows; t public.hq_business_tasks;
  v_task uuid; v_request uuid:=gen_random_uuid(); v_brief text; v_catalogue jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  select * into n from hq_private.department_staffing_needs where id=p_need_id;
  if not found then return; end if;
  -- A failed planning task never recursively creates another staffing plan.
  if exists(select 1 from hq_private.staffing_workflows where planning_task_id=n.task_id) then return; end if;
  insert into hq_private.staffing_workflows(need_id,founder_user_id,scope_digest) values(n.id,n.founder_user_id,hq_private.staffing_scope_digest(n.task_id)) on conflict(need_id) do nothing;
  select * into w from hq_private.staffing_workflows where need_id=n.id for update;
  if w.status<>'planning-blocked' then return; end if;
  if exists(select 1 from hq_private.staffing_workflows other join hq_private.department_staffing_needs gap on gap.id=other.need_id
    where other.id<>w.id and gap.department_key=n.department_key and other.status in ('planning','approval-required','publication-blocked')) then
    update hq_private.staffing_workflows set blocker='staffing-department-hire-already-pending' where id=w.id; return; end if;
  select * into t from public.hq_business_tasks where id=n.task_id;
  if t.status is distinct from 'blocked' or t.error is distinct from 'staffing-required' or w.scope_digest is distinct from hq_private.staffing_scope_digest(n.task_id) then
    update hq_private.staffing_workflows set status='canceled',blocker='staffing-source-task-unavailable',updated_at=clock_timestamp() where id=w.id; return;
  end if;
  if not hq_private.staffing_gap_exists(n.department_key,n.department_head_id) then
    update hq_private.staffing_workflows set status='not-required',blocker='staffing-gap-resolved',updated_at=clock_timestamp() where id=w.id; return; end if;
  v_catalogue:=hq_private.staffing_catalogue(n.department_key);
  if n.department_head_id not in ('AG-DEV-001','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001') then
    update hq_private.staffing_workflows set blocker='staffing-department-out-of-scope' where id=w.id; return; end if;
  if jsonb_array_length(v_catalogue)=0 or not exists(select 1 from public.hq_departments where department_key=n.department_key)
    or not exists(select 1 from hq_private.agent_roster where id=n.department_head_id and enabled and model_tier='T2_HEAD' and department_key=n.department_key)
    or not exists(select 1 from hq_private.agent_roster where id='AG-HR-001' and enabled and model_tier='T2_HEAD')
    or not exists(select 1 from hq_private.agent_roster where id='AG-CEO-001' and enabled and model_tier='T3_EXEC') then return; end if;
  if (select count(*) from public.hq_business_tasks where founder_user_id=n.founder_user_id and status in ('queued','working','review'))>=20
    or (select count(*) from public.hq_business_tasks where founder_user_id=n.founder_user_id)>=1000 then
    update hq_private.staffing_workflows set blocker='staffing-planning-capacity' where id=w.id; return;
  end if;
  v_brief:='Prepare one concrete T1 staffing proposal for the existing department '||n.department_key||' under manager '||n.department_head_id||'. Amaya and Steve independently review the same artifact. This is proposal preparation only. Do not claim a hire, publication, trial, activation or task resumption occurred. No new tools, departments, executive authority, outreach or spending. Return ONLY JSON with exact keys agentId, name, managerId, profileDraft, skills, trialCriteria, resumeOriginal. agentId must be a new AG department identifier. profileDraft is the complete proposed bounded worker profile (at most 16000 UTF-8 bytes), including frontmatter employee_id and reports_to matching agentId and managerId, and a ## 5. Assigned skills section containing canonical wiki links to exactly the selected catalogue paths. skills is one to ten distinct objects {fileId,sourceVersion}, selected only from the current catalogue below. trialCriteria (at most 4000 UTF-8 bytes) must require real supervised execution for each skill and independent same-artifact review. resumeOriginal is a boolean proposal, subject to the founder decision. Keep the whole artifact below 28000 UTF-8 bytes. Catalogue: '||v_catalogue::text;
  if char_length(v_brief)>12000 then
    update hq_private.staffing_workflows set blocker='staffing-planning-context-capacity' where id=w.id; return;
  end if;
  insert into public.hq_business_tasks(founder_user_id,conversation_id,founder_message_id,request_key,title,brief,acceptance,requested_assignee_id,assignee_id)
    values(n.founder_user_id,t.conversation_id,t.founder_message_id,v_request,'Prepare staffing proposal',v_brief,
      'One exact existing-department T1 plan; complete profile draft, current skill revisions, current model policy, supervised per-skill proof and independent review; no external action or claimed completion.','AG-HR-001','AG-HR-001')
    returning id into v_task;
  update hq_private.staffing_workflows set planning_task_id=v_task,status='planning',blocker='staffing-planning',updated_at=clock_timestamp() where id=w.id;
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id)
    values(t.conversation_id,t.founder_message_id,n.founder_user_id,'AG-HR-001',v_request,'staffing-plan',v_task);
  perform hq_private.workforce_wake();
end $$;
revoke all on function hq_private.start_staffing_plan(uuid) from public,anon,authenticated,service_role;

create function hq_private.staffing_need_created() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  insert into hq_private.staffing_workflows(need_id,founder_user_id,scope_digest) values(new.id,new.founder_user_id,hq_private.staffing_scope_digest(new.task_id)) on conflict(need_id) do nothing;
  return new;
end $$;
revoke all on function hq_private.staffing_need_created() from public,anon,authenticated,service_role;
create trigger hq_staffing_prepare after insert on hq_private.department_staffing_needs
  for each row execute function hq_private.staffing_need_created();

-- Rebind a model proposal to authoritative current metadata. Any change makes
-- the old approval unusable; no semantic-version or model-authored assertion is
-- treated as a canonical source revision.
create function hq_private.bind_staffing_plan(p_workflow_id uuid,p_proposal jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare w hq_private.staffing_workflows; n hq_private.department_staffing_needs; m hq_private.agent_roster;
  v_skills jsonb; v_skill jsonb; v_policy jsonb; v_rules_version text; v_plan jsonb;
begin
  select * into w from hq_private.staffing_workflows where id=p_workflow_id;
  select * into n from hq_private.department_staffing_needs where id=w.need_id;
  select * into m from hq_private.agent_roster where id=n.department_head_id;
  if jsonb_typeof(p_proposal) is distinct from 'object'
    or (select array_agg(k order by k) from jsonb_object_keys(p_proposal) k) is distinct from
      array['agentId','managerId','name','profileDraft','resumeOriginal','skills','trialCriteria']::text[]
    or m.id is null or m.id not in ('AG-DEV-001','AG-RES-001','AG-SALES-001','AG-CS-001','AG-SOC-001','AG-EMAIL-001')
    or not exists(select 1 from hq_private.brain_files f where f.file_id=m.profile_file_id and f.in_scope and not f.trashed and f.source_version is not null)
    or jsonb_typeof(p_proposal->'agentId') is distinct from 'string'
    or jsonb_typeof(p_proposal->'managerId') is distinct from 'string'
    or p_proposal->>'agentId' !~ '^AG-[A-Z]+-[0-9]{3}$' or p_proposal->>'agentId' like 'AG-CEO-%'
    or split_part(p_proposal->>'agentId','-',2)<>split_part(m.id,'-',2)
    or exists(select 1 from hq_private.agent_roster where id=p_proposal->>'agentId')
    or p_proposal->>'managerId' is distinct from m.id or not m.enabled or m.model_tier is distinct from 'T2_HEAD'
    or not exists(select 1 from public.hq_departments where department_key=m.department_key)
    or m.department_key is distinct from n.department_key
    or jsonb_typeof(p_proposal->'name') is distinct from 'string' or octet_length(btrim(p_proposal->>'name')) not between 1 and 160
    or jsonb_typeof(p_proposal->'profileDraft') is distinct from 'string' or octet_length(btrim(p_proposal->>'profileDraft')) not between 1 and 16000
    or jsonb_typeof(p_proposal->'trialCriteria') is distinct from 'string' or octet_length(btrim(p_proposal->>'trialCriteria')) not between 1 and 4000
    or ((p_proposal->>'name')||(p_proposal->>'profileDraft')||(p_proposal->>'trialCriteria')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]'
    or jsonb_typeof(p_proposal->'resumeOriginal') is distinct from 'boolean'
    or jsonb_typeof(p_proposal->'skills') is distinct from 'array' then raise exception 'HQ_STAFFING_PLAN_INVALID'; end if;
  if jsonb_array_length(p_proposal->'skills') not between 1 and 10
    or not exists(select 1 from hq_private.agent_roster r join hq_private.brain_files f on f.file_id=r.profile_file_id
      where r.id='AG-HR-003' and r.enabled and r.id<>m.id and r.id<>p_proposal->>'agentId'
        and f.in_scope and not f.trashed and f.source_version is not null) then raise exception 'HQ_STAFFING_REVIEWER_UNAVAILABLE'; end if;
  for v_skill in select * from jsonb_array_elements(p_proposal->'skills') loop
    if jsonb_typeof(v_skill) is distinct from 'object'
      or (select array_agg(k order by k) from jsonb_object_keys(v_skill) k) is distinct from array['fileId','sourceVersion']::text[]
      or jsonb_typeof(v_skill->'fileId') is distinct from 'string'
      or jsonb_typeof(v_skill->'sourceVersion') is distinct from 'string'
      or not hq_private.staffing_catalogue(n.department_key) @> jsonb_build_array(v_skill) then raise exception 'HQ_STAFFING_SKILL_STALE'; end if;
  end loop;
  select jsonb_agg(s order by s->>'fileId') into v_skills from jsonb_array_elements(p_proposal->'skills') s;
  if (select count(distinct s->>'fileId') from jsonb_array_elements(v_skills) s)<>jsonb_array_length(v_skills) then raise exception 'HQ_STAFFING_SKILL_INVALID'; end if;
  select jsonb_agg(distinct jsonb_build_object('model',r.model,'effort',r.effort)) into v_policy
    from hq_private.agent_roster r where r.enabled and r.model_tier='T1_WORKER';
  select min(source_version) into v_rules_version from hq_private.brain_files
    where name='Workforce Operating Rules.md' and in_scope and not trashed
      and root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  if (select count(*) from hq_private.brain_files where name='Workforce Operating Rules.md' and in_scope and not trashed
      and root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8')<>1
    or jsonb_array_length(v_policy) is distinct from 1 or v_policy->0->>'model' is distinct from 'gpt-6.1-terra'
    or coalesce(v_policy->0->>'effort','') not in ('minimal','low','medium','high','xhigh')
    or v_rules_version is null then raise exception 'HQ_STAFFING_MODEL_POLICY_UNAVAILABLE'; end if;
  if w.scope_digest is distinct from hq_private.staffing_scope_digest(n.task_id)
    or not exists(select 1 from public.hq_business_tasks t where t.id=n.task_id and t.status='blocked' and t.error='staffing-required')
    then raise exception 'HQ_STAFFING_SOURCE_TASK_UNAVAILABLE'; end if;
  if not hq_private.staffing_gap_exists(n.department_key,n.department_head_id) then raise exception 'HQ_STAFFING_GAP_RESOLVED'; end if;
  v_plan:=p_proposal||jsonb_build_object('version',1,'departmentKey',n.department_key,'skills',v_skills,'modelTier','T1_WORKER',
    'modelPolicy',(v_policy->0)||jsonb_build_object('sourceVersion',v_rules_version),
    'managerBinding',hq_private.workforce_agent_binding_digest(m.id),'reviewerId','AG-HR-003',
    'reviewerBinding',hq_private.workforce_agent_binding_digest('AG-HR-003'),
    'originalTaskId',n.task_id,'scopeDigest',w.scope_digest,
    'originalTask',(select jsonb_build_object('title',t.title,'brief',t.brief,'acceptance',t.acceptance) from public.hq_business_tasks t where t.id=n.task_id),
    'preparationBindings',jsonb_build_object('hr',hq_private.workforce_agent_binding_digest('AG-HR-001'),'ceo',hq_private.workforce_agent_binding_digest('AG-CEO-001')),
    'qualificationScope','bounded-drafting-v1','trialScope','synthetic-internal-trial-v1','externalActionsAllowed',false,'toolsMayChange',false);
  if octet_length(v_plan::text)>65536 then raise exception 'HQ_STAFFING_PLAN_CAPACITY'; end if;
  return v_plan;
end $$;
revoke all on function hq_private.bind_staffing_plan(uuid,jsonb) from public,anon,authenticated,service_role;

create function hq_private.finish_staffing_plan() returns trigger
language plpgsql security definer set search_path='' as $$
declare w hq_private.staffing_workflows; v_need record;
begin
  select * into w from hq_private.staffing_workflows where planning_task_id=new.id and status='planning' for update;
  if not found then
    if new.status='blocked' and new.error='staffing-required' then
      for v_need in select id from hq_private.department_staffing_needs where task_id=new.id loop
        perform hq_private.start_staffing_plan(v_need.id);
      end loop;
    elsif new.status in ('canceled','completed') then
      update hq_private.staffing_workflows flow set status='canceled',blocker='staffing-source-task-unavailable',updated_at=clock_timestamp()
        from hq_private.department_staffing_needs gap where gap.id=flow.need_id and gap.task_id=new.id
          and flow.status not in ('canceled','failed','rejected');
      if found then perform hq_private.live_emit('company'); end if;
    end if;
    return new;
  end if;
  if new.status in ('blocked','canceled') then
    update hq_private.staffing_workflows set status=case when new.status='canceled' then 'canceled' else 'failed' end,
      blocker=case when new.status='canceled' then 'staffing-planning-canceled' else coalesce(new.error,'staffing-planning-failed') end,
      updated_at=clock_timestamp() where id=w.id; return new;
  end if;
  return new;
end $$;
revoke all on function hq_private.finish_staffing_plan() from public,anon,authenticated,service_role;
create trigger hq_staffing_plan_finished after update of status on public.hq_business_tasks
  for each row when(new.status in ('completed','blocked','canceled')) execute function hq_private.finish_staffing_plan();

create function hq_private.staffing_plan_current(p_plan_id uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p hq_private.staffing_plans; proposal jsonb;
begin
  select * into p from hq_private.staffing_plans where id=p_plan_id;
  if not found then return false; end if;
  select jsonb_object_agg(k,v) into proposal from jsonb_each(p.document) e(k,v)
    where k in ('agentId','name','managerId','profileDraft','skills','trialCriteria','resumeOriginal');
  return hq_private.bind_staffing_plan(p.workflow_id,proposal)=p.document;
exception when data_exception or raise_exception then return false;
end $$;
revoke all on function hq_private.staffing_plan_current(uuid) from public,anon,authenticated,service_role;

create function hq_private.staffing_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_rows jsonb;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'sourceTaskId',n.task_id,'departmentKey',n.department_key,
    'planningTaskId',w.planning_task_id,'status',case when t.status in ('completed','canceled') then 'canceled' else w.status end,
    'blocker',case when t.status in ('completed','canceled') then 'staffing-source-task-unavailable'
      when p.id is not null and not hq_private.staffing_plan_current(p.id) then 'staffing-binding-stale' else w.blocker end,
    'updatedAt',w.updated_at,'planId',p.id,'digest',p.digest,'plan',p.document,'decision',d.decision,
    'resumeOriginal',d.resume_original) order by w.updated_at desc),'[]'::jsonb) into v_rows
    from (select * from hq_private.staffing_workflows where founder_user_id=v_uid
      order by (status in ('planning-blocked','planning','approval-required','publication-blocked')) desc,updated_at desc,id limit 20) w
    join hq_private.department_staffing_needs n on n.id=w.need_id
      join public.hq_business_tasks t on t.id=n.task_id
      left join hq_private.staffing_plans p on p.workflow_id=w.id left join hq_private.staffing_decisions d on d.plan_id=p.id
    where w.founder_user_id=v_uid;
  return jsonb_build_object('version',1,'canonicalWriter','unavailable','workflows',v_rows,
    'totalCount',(select count(*) from hq_private.staffing_workflows where founder_user_id=v_uid));
end $$;
revoke all on function hq_private.staffing_snapshot() from public,anon,authenticated,service_role;

create function hq_private.decide_staffing_plan(p_plan_id uuid,p_digest text,p_decision text,p_resume_original boolean,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); p hq_private.staffing_plans; w hq_private.staffing_workflows;
  d hq_private.staffing_decisions; v_proposal jsonb;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or p_plan_id is null or p_digest is null or p_resume_original is null
    or p_digest !~ '^[0-9a-f]{64}$' or p_decision is null or p_decision not in ('approved','rejected') then raise exception 'HQ_STAFFING_DECISION_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into d from hq_private.staffing_decisions where actor_user_id=v_uid and request_key=p_request_key;
  if found then
    if (d.plan_id,d.plan_digest,d.decision,d.resume_original) is distinct from (p_plan_id,p_digest,p_decision,p_resume_original)
      then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.staffing_snapshot();
  end if;
  select * into p from hq_private.staffing_plans where id=p_plan_id;
  select * into w from hq_private.staffing_workflows where id=p.workflow_id and founder_user_id=v_uid for update;
  if w.id is null or p.digest is distinct from p_digest or w.status<>'approval-required'
    or exists(select 1 from hq_private.staffing_decisions where plan_id=p.id)
    or p_resume_original and not (p.document->>'resumeOriginal')::boolean
    or p_decision='rejected' and p_resume_original then raise exception 'HQ_STAFFING_DECISION_CONFLICT' using errcode='PT409'; end if;
  select jsonb_object_agg(k,v) into v_proposal from jsonb_each(p.document) e(k,v)
    where k in ('agentId','name','managerId','profileDraft','skills','trialCriteria','resumeOriginal');
  if p_decision='approved' and not hq_private.staffing_plan_current(p.id) then
    raise exception 'HQ_STAFFING_BINDING_STALE' using errcode='PT409'; end if;
  insert into hq_private.staffing_decisions(plan_id,actor_user_id,session_id,request_key,decision,plan_digest,resume_original)
    values(p.id,v_uid,(auth.jwt()->>'session_id')::uuid,p_request_key,p_decision,p_digest,p_resume_original);
  update hq_private.staffing_workflows set status=case when p_decision='approved' then 'publication-blocked' else 'rejected' end,
    blocker=case when p_decision='approved' then 'canonical-writer-setup-required' else 'staffing-plan-rejected' end,
    updated_at=clock_timestamp() where id=w.id;
  perform hq_private.live_emit('company');
  return hq_private.staffing_snapshot();
end $$;
revoke all on function hq_private.decide_staffing_plan(uuid,text,text,boolean,uuid) from public,anon,authenticated,service_role;
create function public.hq_staffing_snapshot() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.staffing_snapshot(); $$;
create function public.hq_decide_staffing_plan(p_plan_id uuid,p_digest text,p_decision text,p_resume_original boolean,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.decide_staffing_plan(p_plan_id,p_digest,p_decision,p_resume_original,p_request_key); $$;
revoke all on function public.hq_staffing_snapshot(),public.hq_decide_staffing_plan(uuid,text,text,boolean,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.staffing_snapshot(),public.hq_staffing_snapshot(),
  hq_private.decide_staffing_plan(uuid,text,text,boolean,uuid),public.hq_decide_staffing_plan(uuid,text,text,boolean,uuid) to authenticated;

-- No direct SQL/RPC for canonical publication, issuing delegated qualifications,
-- activation or continuation is exposed by this preparation migration.

-- Historical gaps remain visible; no migration-time inference is queued.
insert into hq_private.staffing_workflows(need_id,founder_user_id,scope_digest)
  select n.id,n.founder_user_id,hq_private.staffing_scope_digest(n.task_id) from hq_private.department_staffing_needs n
  join public.hq_business_tasks t on t.id=n.task_id where t.status='blocked' and t.error='staffing-required'
  on conflict(need_id) do nothing;

-- Legacy consumers never claim the new fixed stages. Preserve the core OID and
-- every ordinary/meeting branch; refuse an unexpected source instead of guessing.
do $$ declare d text:=pg_get_functiondef('hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure); changed text;
begin
  changed:=replace(d,'x where x.status=''queued''','x where x.status=''queued'' and x.kind not in (''staffing-plan'',''staffing-review'')');
  if changed=d then raise exception 'HQ_STAFFING_CLAIM_SOURCE_MISMATCH'; end if;
  execute changed;
end $$;

create function hq_private.staffing_input_binding(p_workflow_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('scopeDigest',w.scope_digest,'currentScope',hq_private.staffing_scope_digest(n.task_id),
    'manager',hq_private.workforce_agent_binding_digest(n.department_head_id),
    'hr',hq_private.workforce_agent_binding_digest('AG-HR-001'),'ceo',hq_private.workforce_agent_binding_digest('AG-CEO-001'),
    'reviewer',hq_private.workforce_agent_binding_digest('AG-HR-003'),'catalogue',hq_private.staffing_catalogue(n.department_key),
    'models',(select jsonb_agg(distinct jsonb_build_array(r.model,r.effort)) from hq_private.agent_roster r where r.enabled and r.model_tier='T1_WORKER'),
    'rules',(select jsonb_agg(jsonb_build_array(f.file_id,f.source_version) order by f.file_id) from hq_private.brain_files f
      where f.name='Workforce Operating Rules.md' and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'))
  from hq_private.staffing_workflows w join hq_private.department_staffing_needs n on n.id=w.need_id where w.id=p_workflow_id
$$;
revoke all on function hq_private.staffing_input_binding(uuid) from public,anon,authenticated,service_role;

-- Request-scoped lease fence, not a persistent ready bit. Only the fixed
-- authenticated staffing claim can create this private, one-use transaction row.
-- A pre-migration cached legacy body cannot commit an unsupported lease.
create table hq_private.staffing_claim_fences (
  job_id uuid primary key references public.hq_agent_jobs(id),
  worker_id uuid not null references hq_private.agent_workers(worker_id),
  transaction_id bigint not null
);
alter table hq_private.staffing_claim_fences enable row level security;
revoke all on hq_private.staffing_claim_fences from public,anon,authenticated,service_role;
create function hq_private.guard_staffing_claim() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.kind not in ('staffing-plan','staffing-review') or new.status<>'working' then return new; end if;
  if tg_op='UPDATE' then
    if old.status='working' and old.worker_id is not null and old.lease_token is not null
      and (new.worker_id,new.lease_token) is not distinct from (old.worker_id,old.lease_token) then return new; end if;
  end if;
  delete from hq_private.staffing_claim_fences where job_id=new.id and worker_id=new.worker_id and transaction_id=txid_current();
  if found then return new; end if;
  perform set_config('hq.staffing_claim_rejected',new.id::text,true);
  return null;
end $$;
revoke all on function hq_private.guard_staffing_claim() from public,anon,authenticated,service_role;
create trigger hq_staffing_claim_fence before insert or update of status,worker_id,lease_token on public.hq_agent_jobs
  for each row execute function hq_private.guard_staffing_claim();

create function hq_private.worker_staffing_claim(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; a hq_private.agent_roster; w hq_private.staffing_workflows;
  n hq_private.department_staffing_needs; original public.hq_business_tasks; pending_need record; files jsonb; required text[]; context jsonb; artifact public.hq_task_artifacts;
begin
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if (hq_private.worker_admission_status(p_worker_id)->>'paused')::boolean
    or exists(select 1 from public.hq_agent_jobs where status='working') then return jsonb_build_object('job',null); end if;
  for pending_need in select need_id from hq_private.staffing_workflows where status='planning-blocked' order by updated_at,id limit 20 loop
    perform hq_private.start_staffing_plan(pending_need.need_id);
  end loop;
  select * into j from public.hq_agent_jobs x where x.kind in ('staffing-plan','staffing-review') and x.status='queued'
    and (x.depends_on is null or exists(select 1 from public.hq_agent_jobs parent where parent.id=x.depends_on and parent.status='completed'))
    order by x.created_at,x.id limit 1 for update skip locked;
  if not found then return jsonb_build_object('job',null); end if;
  select * into w from hq_private.staffing_workflows where planning_task_id=j.task_id and status='planning';
  select * into n from hq_private.department_staffing_needs where id=w.need_id;
  select * into original from public.hq_business_tasks where id=n.task_id;
  select * into a from hq_private.agent_roster where id=j.agent_id and enabled;
  if w.id is null or original.status is distinct from 'blocked' or original.error is distinct from 'staffing-required'
    or w.scope_digest is distinct from hq_private.staffing_scope_digest(n.task_id)
    or j.agent_id is distinct from (case when j.kind='staffing-plan' then 'AG-HR-001' else 'AG-CEO-001' end)
    or a.id is null or not hq_private.workforce_agent_assignable(a.id) then
    return hq_private.workforce_block_claim(j,'staffing-source-task-unavailable');
  end if;
  -- Preserve the five common policy documents and complete current role inputs.
  required:=array['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz',
    '1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N',a.profile_file_id,
    (select profile_file_id from hq_private.agent_roster where id=n.department_head_id)]
    ||array(select jsonb_array_elements_text(a.skill_file_ids))
    ||array(select c->>'fileId' from jsonb_array_elements(hq_private.staffing_catalogue(n.department_key)) c);
  select array_agg(distinct id order by id) into required from unnest(required) id;
  select jsonb_agg(jsonb_build_object('id',f.file_id) order by f.file_id) into files from hq_private.brain_files f
    where f.file_id=any(required) and f.in_scope and not f.trashed and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8';
  if cardinality(required)>18 or jsonb_array_length(files) is distinct from cardinality(required) then
    return hq_private.workforce_block_claim(j,'staffing-planning-context-capacity'); end if;
  select * into artifact from public.hq_task_artifacts where id=j.artifact_id;
  context:=jsonb_build_object('mode',j.kind,'agent',jsonb_build_object('id',a.id,'name',a.name,'model',a.model,'effort',a.effort,
    'modelTier',a.model_tier,'profileFileId',a.profile_file_id,'skillFileIds',a.skill_file_ids),
    'brain_files',files,'staffing',jsonb_build_object('workflowId',w.id,'departmentKey',n.department_key,'managerId',n.department_head_id,
      'catalogue',hq_private.staffing_catalogue(n.department_key),'sourceTask',jsonb_build_object('title',original.title,'brief',original.brief,'acceptance',original.acceptance)),
    'task',jsonb_build_object('id',j.task_id,'brief',(select brief from public.hq_business_tasks where id=j.task_id)),
    'artifact',case when artifact.id is not null then jsonb_build_object('id',artifact.id,'digest',artifact.digest,'text',artifact.text) end,
    'correction',case when j.depends_on is not null then (select result_text from public.hq_agent_jobs where id=j.depends_on) end);
  if octet_length(context::text)>245760 then return hq_private.workforce_block_claim(j,'staffing-planning-context-capacity'); end if;
  insert into hq_private.staffing_claim_fences(job_id,worker_id,transaction_id) values(j.id,p_worker_id,txid_current());
  update public.hq_agent_jobs set status='working',worker_id=p_worker_id,lease_token=gen_random_uuid(),
    lease_expires_at=clock_timestamp()+interval '300 seconds',started_at=clock_timestamp() where id=j.id returning * into j;
  insert into hq_private.staffing_claim_bindings(job_id,binding) values(j.id,hq_private.staffing_input_binding(w.id));
  return jsonb_build_object('job',jsonb_build_object('id',j.id,'conversation_id',j.conversation_id,'agent_id',j.agent_id,'lease_token',j.lease_token,
    'prompt','Prepare or independently review only the bounded staffing proposal. No hire or external execution is authorized yet.','context',context));
end $$;
revoke all on function hq_private.worker_staffing_claim(uuid) from public,anon,authenticated,service_role;

create function hq_private.worker_staffing_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; w hq_private.staffing_workflows; a public.hq_task_artifacts;
  body jsonb; document jsonb; v_result_digest text; artifact_id uuid; v_error text:=p_error; parent public.hq_agent_jobs;
begin
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_reply is null or octet_length(p_reply)>32000 or p_trial_evidence is not null or p_model_evidence is not null
    or p_evidence is distinct from '[]'::jsonb or p_error is not null and p_error !~ '^[a-z-]{1,80}$'
    then raise exception 'HQ_STAFFING_RESULT_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if j.id is null or j.kind not in ('staffing-plan','staffing-review') or j.worker_id is distinct from p_worker_id
    or j.lease_token is distinct from p_lease_token then raise exception 'HQ_LEASE_REQUIRED' using errcode='42501'; end if;
  v_result_digest:=encode(extensions.digest(jsonb_build_array(p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence)::text,'sha256'),'hex');
  if j.status='completed' or j.status='blocked' and j.result_digest is not null then
    if j.result_digest is distinct from v_result_digest then raise exception 'HQ_RESULT_ALREADY_COMMITTED' using errcode='PT409'; end if;
    return jsonb_build_object('accepted',true)||case when j.error='staffing-source-task-unavailable' then jsonb_build_object('discarded',true) else '{}'::jsonb end;
  end if;
  select * into w from hq_private.staffing_workflows where planning_task_id=j.task_id for update;
  if j.status<>'working' or j.lease_expires_at<=clock_timestamp() or w.status<>'planning'
    or not exists(select 1 from hq_private.department_staffing_needs n join public.hq_business_tasks t on t.id=n.task_id
      where n.id=w.need_id and t.status='blocked' and t.error='staffing-required') then
    if j.status='working' then
      update public.hq_agent_jobs set status='blocked',error='staffing-source-task-unavailable',result_digest=v_result_digest,completed_at=clock_timestamp() where id=j.id;
      update public.hq_business_tasks set status='blocked',error='staffing-source-task-unavailable',completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.task_id and status in ('queued','working','review');
    end if;
    return jsonb_build_object('accepted',true,'discarded',true);
  end if;
  if (select b.binding from hq_private.staffing_claim_bindings b where b.job_id=j.id)
    is distinct from hq_private.staffing_input_binding(w.id) then v_error:='staffing-binding-stale'; end if;
  if v_error is null then
    begin
      body:=p_reply::jsonb;
      if j.kind='staffing-plan' then document:=hq_private.bind_staffing_plan(w.id,body);
      else
        select * into a from public.hq_task_artifacts where id=j.artifact_id;
        if jsonb_typeof(body) is distinct from 'object' or jsonb_typeof(body->'accepted') is distinct from 'boolean'
          or body->>'artifactDigest' is distinct from a.digest or a.id is null
          or jsonb_typeof(body->'summary') is distinct from 'string' or octet_length(btrim(body->>'summary')) not between 1 and 8000
          or body->>'summary' ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'HQ_STAFFING_REVIEW_INVALID'; end if;
        document:=hq_private.bind_staffing_plan(w.id,a.text::jsonb);
        if document is distinct from (select b.document from hq_private.staffing_draft_bindings b where b.artifact_id=a.id)
          then raise exception 'HQ_STAFFING_BINDING_STALE'; end if;
      end if;
    exception when data_exception or raise_exception then v_error:='staffing-plan-invalid'; end;
  end if;
  if v_error is not null then
    update public.hq_agent_jobs set status='blocked',error=v_error,result_digest=v_result_digest,completed_at=clock_timestamp() where id=j.id;
    update public.hq_business_tasks set status='blocked',error=v_error,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.task_id;
    return jsonb_build_object('accepted',true);
  end if;
  update public.hq_agent_jobs set status='completed',result_digest=v_result_digest,result_text=p_reply,completed_at=clock_timestamp() where id=j.id;
  if j.kind='staffing-plan' then
    insert into public.hq_task_artifacts(task_id,job_id,agent_id,kind,text,digest,input_artifact_id)
      values(j.task_id,j.id,j.agent_id,j.kind,p_reply,encode(extensions.digest(p_reply,'sha256'),'hex'),j.artifact_id) returning id into artifact_id;
    insert into hq_private.staffing_draft_bindings(artifact_id,document) values(artifact_id,document);
    insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,artifact_id,attempt,depends_on)
      values(j.conversation_id,j.founder_message_id,j.founder_user_id,'AG-CEO-001',j.request_key,'staffing-review',j.task_id,artifact_id,j.attempt,j.id);
  elsif (body->>'accepted')::boolean then
    select * into parent from public.hq_agent_jobs where id=a.job_id and kind='staffing-plan' and agent_id='AG-HR-001' and status='completed';
    if parent.id is null or j.depends_on is distinct from parent.id then raise exception 'HQ_STAFFING_REVIEW_REQUIRED'; end if;
    insert into hq_private.staffing_plans(workflow_id,artifact_id,hr_plan_job_id,ceo_review_job_id,document,digest)
      values(w.id,a.id,parent.id,j.id,document,encode(extensions.digest(document::text,'sha256'),'hex'));
    update hq_private.staffing_workflows set status='approval-required',blocker='staffing-founder-approval-required',updated_at=clock_timestamp() where id=w.id;
    update public.hq_business_tasks set status='completed',deliverable=a.text,completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.task_id;
  elsif j.attempt<2 then
    insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id,artifact_id,attempt,depends_on)
      values(j.conversation_id,j.founder_message_id,j.founder_user_id,'AG-HR-001',j.request_key,'staffing-plan',j.task_id,a.id,j.attempt+1,j.id);
  else
    update public.hq_business_tasks set status='blocked',error='review-repairs-exhausted',completed_at=clock_timestamp(),updated_at=clock_timestamp() where id=j.task_id;
  end if;
  perform hq_private.workforce_wake();
  return jsonb_build_object('accepted',true);
end $$;
revoke all on function hq_private.worker_staffing_finish(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
create function public.hq_worker_staffing_claim(p_worker_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_staffing_claim(p_worker_id); $$;
revoke all on function public.hq_worker_staffing_claim(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_staffing_claim(uuid),public.hq_worker_staffing_claim(uuid) to authenticated;

-- Existing journals (including old recovery) always deliver through v4. Dispatch
-- by the durable DB kind, never a caller-supplied journal protocol or RPC name.
do $$ declare d text:=pg_get_functiondef('hq_private.worker_finish_v4(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'::regprocedure); copied text;
begin
  copied:=replace(d,'FUNCTION hq_private.worker_finish_v4(p_job_id uuid, p_lease_token uuid, p_worker_id uuid, p_reply text, p_error text, p_evidence jsonb, p_model_evidence jsonb, p_trial_evidence jsonb)',
    'FUNCTION hq_private.worker_finish_v4_before_staffing(p_job_id uuid, p_lease_token uuid, p_worker_id uuid, p_reply text, p_error text, p_evidence jsonb, p_model_evidence jsonb, p_trial_evidence jsonb)');
  if copied=d then raise exception 'HQ_STAFFING_DELIVERY_SOURCE_MISMATCH'; end if;
  execute copied;
end $$;
revoke all on function hq_private.worker_finish_v4_before_staffing(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb) from public,anon,authenticated,service_role;
create or replace function hq_private.worker_finish_v4(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb,p_model_evidence jsonb,p_trial_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from public.hq_agent_jobs where id=p_job_id and kind in ('staffing-plan','staffing-review')) then
    return hq_private.worker_staffing_finish(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence);
  end if;
  return hq_private.worker_finish_v4_before_staffing(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence,p_model_evidence,p_trial_evidence);
end $$;

-- Keep the old eleven-RPC proof byte-for-byte in a private helper; older signed
-- workers retain their exact API contract while newer workers require this
-- additional fixed-stage proof. No catalog grant is added.
do $$
declare d text:=pg_get_functiondef('hq_private.worker_release_status(uuid)'::regprocedure); copied text; proof text; start_at integer; end_at integer;
begin
  copied:=replace(d,'FUNCTION hq_private.worker_release_status(p_worker_id uuid)',
    'FUNCTION hq_private.worker_release_status_before_staffing(p_worker_id uuid)');
  if copied=d then raise exception 'HQ_STAFFING_STATUS_SOURCE_MISMATCH'; end if;
  execute copied;
  proof:=replace(d,'FUNCTION hq_private.worker_release_status(p_worker_id uuid)',
    'FUNCTION hq_private.staffing_api_proof(p_worker_id uuid)');
  start_at:=position('(values' in proof); end_at:=position(') required(name,signature,arguments)' in proof);
  if start_at=0 or end_at<=start_at then raise exception 'HQ_STAFFING_STATUS_SOURCE_MISMATCH'; end if;
  proof:=substring(proof from 1 for start_at-1)||$rpc$(values
    ('hq_worker_staffing_claim','public.hq_worker_staffing_claim(uuid)',array['p_worker_id']::text[])
  $rpc$||substring(proof from end_at);
  proof:=replace(proof,'if not pg_catalog.has_schema_privilege',
    'if pg_catalog.to_regprocedure(''hq_private.worker_staffing_finish(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)'') is null or not pg_catalog.has_schema_privilege');
  execute proof;
end $$;
revoke all on function hq_private.worker_release_status_before_staffing(uuid),hq_private.staffing_api_proof(uuid) from public,anon,authenticated,service_role;
create or replace function hq_private.worker_release_status(p_worker_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare old_status jsonb:=hq_private.worker_release_status_before_staffing(p_worker_id);
begin
  if to_regprocedure('hq_private.worker_finish_v4_before_staffing(uuid,uuid,uuid,text,text,jsonb,jsonb,jsonb)') is null
    then raise exception 'HQ_RELEASE_SCHEMA_INCOMPATIBLE' using errcode='55000'; end if;
  begin
    return old_status||jsonb_build_object('staffingApi',hq_private.staffing_api_proof(p_worker_id)->'api');
  exception when sqlstate '55000' then
    -- Old signed workers keep their independently verified ordinary contract.
    -- New workers reject the missing additional proof. Auth errors are not caught.
    return old_status||jsonb_build_object('staffingApi',null);
  end;
end $$;

-- Preserve the existing sole independent reviewer authority. Newly created
-- trials bind its current canonical identity; legacy trials/receipts keep their
-- established validation. Never permit Iris to certify herself or her head.
alter table hq_private.workforce_trials add column reviewer_binding_digest text
  check(reviewer_binding_digest is null or reviewer_binding_digest ~ '^[0-9a-f]{64}$');
create function hq_private.bind_staffing_trial_reviewer() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' then
    if new.reviewer_binding_digest is distinct from old.reviewer_binding_digest then raise exception 'HQ_TRIAL_REVIEWER_IMMUTABLE'; end if;
    return new;
  end if;
  if new.agent_id='AG-HR-003' or new.manager_id='AG-HR-003'
    or not exists(select 1 from hq_private.agent_roster r join hq_private.brain_files f on f.file_id=r.profile_file_id
      where r.id='AG-HR-003' and r.enabled and f.in_scope and not f.trashed and f.source_version is not null
        and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8') then raise exception 'HQ_TRIAL_REVIEWER_UNAVAILABLE'; end if;
  new.reviewer_binding_digest:=hq_private.workforce_agent_binding_digest('AG-HR-003');
  return new;
end $$;
revoke all on function hq_private.bind_staffing_trial_reviewer() from public,anon,authenticated,service_role;
create trigger hq_staffing_trial_reviewer before insert or update of reviewer_binding_digest on hq_private.workforce_trials
  for each row execute function hq_private.bind_staffing_trial_reviewer();

do $$ declare d text; copied text;
begin
  d:=pg_get_functiondef('hq_private.workforce_enrich_claim(jsonb)'::regprocedure);
  copied:=replace(d,'FUNCTION hq_private.workforce_enrich_claim(v jsonb)','FUNCTION hq_private.workforce_enrich_claim_before_staffing_reviewer(v jsonb)');
  if d=copied then raise exception 'HQ_STAFFING_REVIEWER_SOURCE_MISMATCH'; end if;
  execute copied;
  d:=pg_get_functiondef('hq_private.issue_workforce_qualification(uuid)'::regprocedure);
  copied:=replace(d,'FUNCTION hq_private.issue_workforce_qualification(p_trial_id uuid)',
    'FUNCTION hq_private.issue_workforce_qualification_before_staffing_reviewer(p_trial_id uuid)');
  if d=copied then raise exception 'HQ_STAFFING_REVIEWER_SOURCE_MISMATCH'; end if;
  execute copied;
end $$;
revoke all on function hq_private.workforce_enrich_claim_before_staffing_reviewer(jsonb),
  hq_private.issue_workforce_qualification_before_staffing_reviewer(uuid) from public,anon,authenticated,service_role;
create or replace function hq_private.workforce_enrich_claim(v jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; t hq_private.workforce_trials; j public.hq_agent_jobs;
begin
  -- A cached legacy selector whose lease UPDATE was suppressed by the new
  -- fence returns a null job identity. Its existing enrichment boundary turns
  -- that into a valid empty claim instead of exposing an unsupported job.
  if nullif(current_setting('hq.staffing_claim_rejected',true),'') is not null
    and jsonb_typeof(v->'job')='object' and v->'job'->>'id' is null
    and v->'job'->'context'->>'mode' in ('staffing-plan','staffing-review') then return jsonb_build_object('job',null); end if;
  result:=hq_private.workforce_enrich_claim_before_staffing_reviewer(v);
  if jsonb_typeof(result->'job') is distinct from 'object' then return result; end if;
  select * into t from hq_private.workforce_trials where task_id=(result->'job'->'context'->'task'->>'id')::uuid;
  if t.id is not null and (t.agent_id='AG-HR-003' or t.manager_id='AG-HR-003'
    or t.reviewer_binding_digest is not null and t.reviewer_binding_digest is distinct from hq_private.workforce_agent_binding_digest('AG-HR-003')
    or not exists(select 1 from hq_private.agent_roster where id='AG-HR-003' and enabled)) then
    select * into j from public.hq_agent_jobs where id=(result->'job'->>'id')::uuid;
    return hq_private.workforce_block_claim(j,'trial-reviewer-binding-stale');
  end if;
  return result;
end $$;
create or replace function hq_private.issue_workforce_qualification(p_trial_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t hq_private.workforce_trials;
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into t from hq_private.workforce_trials where id=p_trial_id;
  if t.id is not null and (t.agent_id='AG-HR-003' or t.manager_id='AG-HR-003'
    or t.reviewer_binding_digest is not null and t.reviewer_binding_digest is distinct from hq_private.workforce_agent_binding_digest('AG-HR-003')
    or not exists(select 1 from hq_private.agent_roster where id='AG-HR-003' and enabled)) then raise exception 'HQ_TRIAL_REVIEWER_UNAVAILABLE'; end if;
  return hq_private.issue_workforce_qualification_before_staffing_reviewer(p_trial_id);
end $$;

-- A founder may cancel their still-blocked staffing source. Other blocked tasks
-- retain the existing cancellation semantics; no attempt/status is reset.
do $$ declare d text:=pg_get_functiondef('hq_private.cancel_business_task(uuid)'::regprocedure); changed text;
begin
  changed:=replace(d,'and status in (''queued'',''working'',''review'')',
    'and (status in (''queued'',''working'',''review'') or status=''blocked'' and error=''staffing-required'' and exists(select 1 from hq_private.department_staffing_needs n where n.task_id=p_task_id))');
  if changed=d then raise exception 'HQ_STAFFING_CANCEL_SOURCE_MISMATCH'; end if;
  execute changed;
end $$;

-- Historical independently reviewed receipts remain valid. A self/head review
-- was never valid independent evidence and cannot qualify an ordinary worker.
do $$ declare d text:=pg_get_functiondef('hq_private.workforce_skill_evidence_valid(text,text)'::regprocedure); changed text;
begin
  changed:=replace(d,'and q.reviewer_id=''AG-HR-003'' and review.agent_id=''AG-HR-003''',
    'and q.reviewer_id=''AG-HR-003'' and review.agent_id=''AG-HR-003'' and q.agent_id<>q.reviewer_id and q.manager_id<>q.reviewer_id');
  if changed=d then raise exception 'HQ_STAFFING_QUALIFICATION_SOURCE_MISMATCH'; end if;
  execute changed;
end $$;
commit;

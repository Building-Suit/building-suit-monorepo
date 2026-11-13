-- Founder-authorized bounded drafting workforce. No external writes, hires or
-- production operations are delegated. Applied message/lease history is retained.
alter table hq_private.agent_roster
  add column profile_file_id text,
  add column skill_file_ids jsonb not null default '[]'::jsonb check(jsonb_typeof(skill_file_ids)='array' and jsonb_array_length(skill_file_ids)<=10),
  add column lifecycle text not null default 'configured',
  add column model text,
  add column effort text,
  add column manager_id text references hq_private.agent_roster(id),
  add column last_seen_at timestamptz,
  add column source_digest text;

create table public.hq_business_tasks (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null,
  conversation_id uuid not null references public.hq_agent_conversations(id),
  founder_message_id uuid not null references public.hq_agent_messages(id),
  request_key uuid not null,
  title text not null check(char_length(title) between 1 and 180),
  brief text not null check(char_length(brief) between 1 and 12000),
  acceptance text not null check(char_length(acceptance) between 1 and 6000),
  requested_assignee_id text references hq_private.agent_roster(id),
  assignee_id text references hq_private.agent_roster(id),
  status text not null default 'queued' check(status in ('queued','working','review','completed','blocked','canceled')),
  repair_count integer not null default 0 check(repair_count between 0 and 2),
  deliverable text check(octet_length(deliverable)<=32000),
  review_summary text check(octet_length(review_summary)<=8000),
  error text check(error ~ '^[a-z-]{1,80}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  unique(founder_user_id,request_key)
);
-- Drop only historical role restrictions and two conversation-only uniqueness
-- constraints. Lifecycle/lease integrity constraints remain in place.
do $$ declare c record; begin
  for c in select conname from pg_catalog.pg_constraint where conrelid='public.hq_agent_jobs'::regclass
    and (contype='u' or contype='c' and (pg_catalog.pg_get_constraintdef(oid) like '%AG-HR-001%' or pg_catalog.pg_get_constraintdef(oid) like '%AG-CEO-001%'))
  loop execute format('alter table public.hq_agent_jobs drop constraint %I',c.conname); end loop;
end $$;
alter table public.hq_agent_jobs
  add column kind text not null default 'conversation-hr' check(kind in
    ('conversation-hr','conversation-ceo','task-route','task-work','head-review','ceo-review','task-report','lesson-extract','lesson-review')),
  add column task_id uuid references public.hq_business_tasks(id),
  add column artifact_id uuid,
  add column lesson_id uuid,
  add column attempt integer not null default 0 check(attempt between 0 and 2);
update public.hq_agent_jobs set kind='conversation-ceo' where agent_id='AG-CEO-001';
create unique index hq_agent_conversation_request_unique on public.hq_agent_jobs(founder_user_id,request_key,agent_id)
  where kind in ('conversation-hr','conversation-ceo');
create unique index hq_agent_conversation_message_unique on public.hq_agent_jobs(founder_message_id,agent_id)
  where kind in ('conversation-hr','conversation-ceo');
create unique index hq_agent_task_stage_unique on public.hq_agent_jobs(task_id,kind,attempt) where task_id is not null;
create index hq_business_tasks_founder_idx on public.hq_business_tasks(founder_user_id,created_at desc,id desc);

create table public.hq_task_artifacts (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.hq_business_tasks(id),
  job_id uuid not null unique references public.hq_agent_jobs(id),
  agent_id text not null references hq_private.agent_roster(id),
  kind text not null,
  text text not null check(octet_length(text) between 1 and 32000),
  digest text not null check(digest ~ '^[0-9a-f]{64}$'),
  input_artifact_id uuid references public.hq_task_artifacts(id),
  created_at timestamptz not null default clock_timestamp()
);
create table public.hq_agent_lessons (
  id uuid primary key default gen_random_uuid(),
  founder_user_id uuid not null,
  source_type text not null check(source_type in ('conversation','task')),
  source_id uuid not null,
  source_digest text not null check(source_digest ~ '^[0-9a-f]{64}$'),
  agent_id text not null references hq_private.agent_roster(id),
  summary text not null check(char_length(summary) between 1 and 240),
  body text not null check(octet_length(body) between 1 and 8000),
  digest text not null unique check(digest ~ '^[0-9a-f]{64}$'),
  content_digest text not null unique check(content_digest ~ '^[0-9a-f]{64}$'),
  status text not null default 'proposed' check(status in ('proposed','accepted','rejected','published')),
  created_at timestamptz not null default clock_timestamp(),
  reviewed_at timestamptz,
  reviewed_by_job_id uuid references public.hq_agent_jobs(id),
  published_at timestamptz,
  publication_reference text,
  publication_digest text check(publication_digest ~ '^[0-9a-f]{64}$'),
  unique(source_type,source_id)
);
alter table public.hq_agent_jobs add foreign key(artifact_id) references public.hq_task_artifacts(id),
  add foreign key(lesson_id) references public.hq_agent_lessons(id);
create index hq_task_artifacts_task_idx on public.hq_task_artifacts(task_id,created_at desc);
create index hq_agent_lessons_retrieval_idx on public.hq_agent_lessons(agent_id,created_at desc) where status in ('accepted','published');
create index hq_agent_lessons_founder_idx on public.hq_agent_lessons(founder_user_id,created_at desc);
create trigger hq_task_artifact_immutable before update or delete on public.hq_task_artifacts
  for each row execute function hq_private.immutable_record();
alter table public.hq_business_tasks enable row level security;
alter table public.hq_task_artifacts enable row level security;
alter table public.hq_agent_lessons enable row level security;
revoke all on public.hq_business_tasks,public.hq_task_artifacts,public.hq_agent_lessons from public,anon,authenticated,service_role;

create function hq_private.workforce_wake() returns void language plpgsql security definer set search_path='' as $$
begin
  perform hq_private.live_emit('agents');
  perform realtime.send('{}'::jsonb,'jobs','hq-agent-jobs',true);
end $$;
-- All follow-on assignments derive from an existing approved request. Each gets
-- a new immutable job identity; a started uncertain job is never retried.
create function hq_private.workforce_enqueue(p_parent public.hq_agent_jobs,p_kind text,p_agent text,
  p_artifact uuid default null,p_lesson uuid default null,p_attempt integer default 0) returns uuid
language plpgsql security definer set search_path='' as $$ declare v_id uuid; begin
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,
    depends_on,kind,task_id,artifact_id,lesson_id,attempt)
    values(p_parent.conversation_id,p_parent.founder_message_id,p_parent.founder_user_id,p_agent,p_parent.request_key,
      p_parent.id,p_kind,p_parent.task_id,p_artifact,p_lesson,p_attempt) returning id into v_id;
  return v_id;
end $$;

create function hq_private.worker_sync_roster(p_worker_id uuid,p_agents jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a jsonb; v_count integer; v_digest text; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if jsonb_typeof(p_agents) is distinct from 'array' or jsonb_array_length(p_agents)<>10 or octet_length(p_agents::text)>50000
    then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select count(distinct x->>'id') into v_count from jsonb_array_elements(p_agents) x;
  if v_count<>10 then raise exception 'HQ_INVALID_ROSTER' using errcode='22023'; end if;
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
  perform hq_private.live_emit('agents');
  return jsonb_build_object('accepted',true,'count',10);
end $$;
create function public.hq_worker_sync_roster(p_worker_id uuid,p_agents jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_sync_roster(p_worker_id,p_agents); $$;

create function hq_private.workforce_agent_assignable(p_agent_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from hq_private.agent_roster a where a.id=p_agent_id and a.enabled and a.profile_file_id is not null
   and a.model is not null and a.effort is not null and a.lifecycle !~* '(retired|suspended|terminated|archived|candidate|inactive|paused|testing-only)');
$$;
revoke all on function hq_private.workforce_agent_assignable(text) from public,anon,authenticated,service_role;

create function hq_private.create_business_task(p_title text,p_brief text,p_acceptance text,p_assignee_id text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); t public.hq_business_tasks; v_conversation uuid; v_message uuid; begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or coalesce(char_length(btrim(p_title)),0) not between 1 and 180
    or coalesce(char_length(btrim(p_brief)),0) not between 1 and 12000 or coalesce(char_length(btrim(p_acceptance)),0) not between 1 and 6000
    or (p_title||p_brief||p_acceptance) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then
    raise exception 'HQ_INVALID_TASK' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into t from public.hq_business_tasks where founder_user_id=v_uid and request_key=p_request_key;
  if found then
    if (t.title,t.brief,t.acceptance,t.requested_assignee_id) is distinct from (p_title,p_brief,p_acceptance,p_assignee_id)
      then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.agent_snapshot();
  end if;
  if (select count(*) from public.hq_business_tasks where founder_user_id=v_uid and status in ('queued','working','review'))>=20
    or (select count(*) from public.hq_business_tasks where founder_user_id=v_uid)>=1000
    or (select coalesce(sum(octet_length(result_text)),0) from public.hq_agent_jobs where founder_user_id=v_uid)>33522432
    or (select coalesce(sum(octet_length(brief)+octet_length(acceptance)),0) from public.hq_business_tasks where founder_user_id=v_uid)>16777216 then
    raise exception 'HQ_TASK_CAPACITY' using errcode='PT429'; end if;
  if p_assignee_id is not null and not hq_private.workforce_agent_assignable(p_assignee_id) then raise exception 'HQ_AGENT_UNAVAILABLE' using errcode='22023'; end if;
  insert into public.hq_agent_conversations(founder_user_id) values(v_uid) on conflict(founder_user_id)
    do update set updated_at=clock_timestamp() returning id into v_conversation;
  insert into public.hq_agent_messages(conversation_id,role,agent_id,text) values(v_conversation,'founder','AG-CEO-001',
    p_title) returning id into v_message;
  insert into public.hq_business_tasks(founder_user_id,conversation_id,founder_message_id,request_key,title,brief,acceptance,requested_assignee_id,assignee_id)
    values(v_uid,v_conversation,v_message,p_request_key,p_title,p_brief,p_acceptance,p_assignee_id,p_assignee_id) returning * into t;
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind,task_id)
    values(v_conversation,v_message,v_uid,coalesce(p_assignee_id,'AG-CEO-001'),p_request_key,
      case when p_assignee_id is null then 'task-route' else 'task-work' end,t.id);
  perform hq_private.workforce_wake();
  return hq_private.agent_snapshot();
end $$;
create function public.hq_create_task(p_title text,p_brief text,p_acceptance text,p_assignee_id text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.create_business_task(p_title,p_brief,p_acceptance,p_assignee_id,p_request_key); $$;
create function hq_private.cancel_business_task(p_task_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_uid uuid:=hq_private.founder_uid(); begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  update public.hq_business_tasks set status='canceled',completed_at=clock_timestamp(),updated_at=clock_timestamp(),error='founder-canceled'
    where id=p_task_id and founder_user_id=v_uid and status in ('queued','working','review');
  update public.hq_agent_jobs set status='blocked',completed_at=clock_timestamp(),error='founder-canceled'
    where task_id=p_task_id and founder_user_id=v_uid and status in ('queued','working');
  perform hq_private.live_emit('agents'); return hq_private.agent_snapshot();
end $$;
create function public.hq_cancel_task(p_task_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.cancel_business_task(p_task_id); $$;

-- Preserve the bounded v1 conversation/message/job projection, enriching only
-- founder-owned records and public roster metadata. No leases or host UID leaks.
alter function hq_private.agent_snapshot() rename to agent_snapshot_v1;
create function hq_private.agent_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_result jsonb; v_agents jsonb; v_tasks jsonb; v_lessons jsonb; v_online boolean; begin
  v_result:=hq_private.agent_snapshot_v1(); v_online:=(v_result->'runtime'->>'connected')::boolean;
  select coalesce(jsonb_agg(base||jsonb_build_object('departmentKey',a.department_key,'profileFileId',a.profile_file_id,'skillFileIds',a.skill_file_ids,
    'lifecycle',a.lifecycle,'model',a.model,'effort',a.effort,'managerId',a.manager_id,'capability','bounded-drafting',
    'deskIndex',(select count(*) from hq_private.agent_roster peer where peer.department_key=a.department_key and peer.id<a.id and peer.enabled),
    'taskId',case when base->>'status'='working' then (select coalesce(j.task_id,j.id) from public.hq_agent_jobs j where j.id=(base->>'taskId')::uuid) else null end,
    'lastSeenAt',a.last_seen_at,'status',case when base->>'status'='working' then 'working' when not v_online or a.last_seen_at is null or not hq_private.workforce_agent_assignable(a.id) then 'offline'
      when base->>'status'='blocked' then 'blocked' else 'idle' end) order by a.id),'[]') into v_agents
    from jsonb_array_elements(v_result->'agents') base join hq_private.agent_roster a on a.id=base->>'id';
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'brief',t.brief,'acceptance',t.acceptance,'assigneeId',t.assignee_id,
    'status',t.status,'createdAt',t.created_at,'updatedAt',t.updated_at,'completedAt',t.completed_at,'repairCount',t.repair_count,
    'deliverable',t.deliverable,'reviewSummary',t.review_summary,'error',t.error) order by t.created_at desc,t.id),'[]') into v_tasks
    from(select * from public.hq_business_tasks where founder_user_id=v_uid order by created_at desc,id desc limit 4) t;
  select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'sourceType',l.source_type,'sourceId',l.source_id,'status',l.status,'summary',l.summary,
    'body',l.body,'agentId',l.agent_id,'createdAt',l.created_at,'reviewedAt',l.reviewed_at,'publishedAt',l.published_at,'publicationReference',l.publication_reference)
    order by l.created_at desc,l.id),'[]') into v_lessons from(select * from public.hq_agent_lessons where founder_user_id=v_uid order by created_at desc,id desc limit 8) l;
  return v_result||jsonb_build_object('version',2,'agents',v_agents,'tasks',v_tasks,'lessons',v_lessons);
end $$;
-- SQL wrapper dependency followed renamed function OID; redirect explicitly.
create or replace function public.hq_agent_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select hq_private.agent_snapshot(); $$;

create function hq_private.workforce_block_claim(p_job public.hq_agent_jobs,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  update public.hq_agent_jobs set status='blocked',error=p_error,completed_at=clock_timestamp() where id=p_job.id and status='queued';
  update public.hq_business_tasks set status='blocked',error=p_error,completed_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=p_job.task_id and status in ('queued','working','review') and p_job.kind not in ('lesson-extract','lesson-review');
  perform hq_private.live_emit('agents');
  return jsonb_build_object('job',null,'next_wake_at',case when exists(select 1 from public.hq_agent_jobs where status='queued')
    then clock_timestamp()+interval '1 second' else null end);
end $$;
revoke all on function hq_private.workforce_block_claim(public.hq_agent_jobs,text) from public,anon,authenticated,service_role;

create or replace function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.hq_agent_jobs; v_agent hq_private.agent_roster; v_task public.hq_business_tasks; v_files jsonb; v_context jsonb; v_wake timestamptz; v_prompt text; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_lease_seconds is distinct from 300 then raise exception 'HQ_INVALID_LEASE' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  update public.hq_agent_jobs set status='blocked',error='worker-interrupted',completed_at=clock_timestamp()
    where status='working' and lease_expires_at<=clock_timestamp();
  update public.hq_agent_jobs child set status='blocked',error='dependency-unavailable',completed_at=clock_timestamp()
    where child.status='queued' and exists(select 1 from public.hq_agent_jobs parent where parent.id=child.depends_on and parent.status='blocked');
  update public.hq_business_tasks taskrow set status='blocked',error='worker-interrupted',completed_at=clock_timestamp(),updated_at=clock_timestamp()
    where taskrow.status in ('queued','working','review') and exists(select 1 from public.hq_agent_jobs pending where pending.task_id=taskrow.id and pending.status='blocked' and pending.kind not in ('lesson-extract','lesson-review'));
  select min(lease_expires_at) into v_wake from public.hq_agent_jobs where status='working';
  if v_wake is not null then return jsonb_build_object('job',null,'next_wake_at',v_wake); end if;
  select * into v_job from public.hq_agent_jobs x where x.status='queued'
    and (x.task_id is null or exists(select 1 from public.hq_business_tasks taskrow where taskrow.id=x.task_id and taskrow.status not in ('blocked','canceled')))
    and (x.depends_on is null or exists(select 1 from public.hq_agent_jobs parent where parent.id=x.depends_on and parent.status='completed'))
    order by x.created_at,x.id limit 1 for update skip locked;
  if not found then return jsonb_build_object('job',null); end if;
  select * into v_agent from hq_private.agent_roster where id=v_job.agent_id and enabled;
  if not hq_private.workforce_agent_assignable(v_job.agent_id) then
    return hq_private.workforce_block_claim(v_job,'agent-profile-required');
  end if;
  -- Fresh role-scoped context: common rules + this employee's own profile and
  -- skills. Index permission is rechecked here; Drive ancestry/revision at host.
  with wanted(id) as (values('1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5'),('1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz'),
    ('1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf'),('14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB'),('1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N'),(v_agent.profile_file_id)
    union select jsonb_array_elements_text(v_agent.skill_file_ids))
  select jsonb_agg(jsonb_build_object('id',w.id) order by w.id) into v_files from wanted w
    where exists(select 1 from hq_private.brain_files f where f.file_id=w.id and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.in_scope and not f.trashed);
  if coalesce(jsonb_array_length(v_files),0)<>(select count(distinct x) from unnest(array['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz',
    '1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N',v_agent.profile_file_id]
    ||array(select jsonb_array_elements_text(v_agent.skill_file_ids))) x) then
    return hq_private.workforce_block_claim(v_job,'brain-scope-required');
  end if;
  select text into v_prompt from public.hq_agent_messages where id=v_job.founder_message_id;
  select * into v_task from public.hq_business_tasks where id=v_job.task_id;
  v_context:=jsonb_build_object('brain_files',v_files,'agent',jsonb_build_object('id',v_agent.id,'name',v_agent.name,'role',v_agent.role,'model',v_agent.model,'effort',v_agent.effort,
    'lifecycle',v_agent.lifecycle,'profileFileId',v_agent.profile_file_id,'skillFileIds',v_agent.skill_file_ids),'mode',v_job.kind,
    'task',case when v_task.id is null then null else jsonb_build_object('id',v_task.id,'title',v_task.title,'brief',v_task.brief,'acceptance',v_task.acceptance,'assigneeId',v_task.assignee_id,'attempt',v_job.attempt) end,
    'artifact',(select jsonb_build_object('id',x.id,'text',x.text,'digest',x.digest,'agentId',x.agent_id) from public.hq_task_artifacts x where x.id=v_job.artifact_id),
    'lesson',(select jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'sourceType',l.source_type,'sourceId',l.source_id,'digest',l.digest) from public.hq_agent_lessons l where l.id=v_job.lesson_id),
    'task_history',case when v_job.kind='lesson-extract' and v_job.task_id is not null then (
      select jsonb_agg(jsonb_build_object('id',x.id,'agentId',x.agent_id,'kind',x.kind,'digest',x.digest,'excerpt',left(x.text,800)) order by x.created_at,x.id)
        from(select * from public.hq_task_artifacts where task_id=v_job.task_id and kind in ('task-work','head-review','ceo-review') order by created_at desc,id desc limit 10) x) else null end,
    'predecessor',(select jsonb_build_object('jobId',x.id,'agentId',x.agent_id,'kind',x.kind,'text',case when v_job.kind='lesson-extract' then null when v_job.kind='conversation-ceo' then coalesce(x.result_text,m.text) else left(coalesce(x.result_text,m.text),8000) end)
      from public.hq_agent_jobs x left join public.hq_agent_messages m on m.reply_to=x.founder_message_id and x.kind='conversation-ceo' where x.id=v_job.depends_on),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('role',m.role,'text',m.text) order by m.created_at,m.id) from
      (select x.* from public.hq_agent_messages x where x.conversation_id=v_job.conversation_id and x.id<>v_job.founder_message_id
        and x.created_at<(select created_at from public.hq_agent_messages where id=v_job.founder_message_id) and octet_length(x.text)<=8000
        order by x.created_at desc,x.id desc limit 2) m),'[]'::jsonb),
    'roster',case when v_job.kind='task-route' then (select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',r.role,'departmentKey',r.department_key,'lifecycle',r.lifecycle)) from hq_private.agent_roster r where hq_private.workforce_agent_assignable(r.id)) else null end,
    'learned',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'sourceId',l.source_id,'digest',l.digest)) from
      (select * from public.hq_agent_lessons where founder_user_id=v_job.founder_user_id and status in ('accepted','published')
        and (agent_id=v_job.agent_id or agent_id='AG-CEO-001') order by created_at desc limit 3) l),'[]'::jsonb));
  if octet_length(v_context::text)>200000 then return hq_private.workforce_block_claim(v_job,'context-capacity'); end if;
  update public.hq_agent_jobs set status='working',worker_id=p_worker_id,lease_token=gen_random_uuid(),lease_expires_at=clock_timestamp()+interval '300 seconds',started_at=clock_timestamp()
    where id=v_job.id returning * into v_job;
  update hq_private.agent_roster set last_seen_at=clock_timestamp() where id=v_agent.id;
  if v_job.task_id is not null and v_job.kind not in ('lesson-extract','lesson-review') then
    update public.hq_business_tasks set status=case when v_job.kind in ('head-review','ceo-review','task-report') then 'review' else 'working' end,updated_at=clock_timestamp() where id=v_job.task_id;
  end if;
  perform hq_private.worker_presence(p_worker_id);
  return jsonb_build_object('job',jsonb_build_object('id',v_job.id,'conversation_id',v_job.conversation_id,'agent_id',v_job.agent_id,'prompt',v_prompt,'context',v_context,'lease_token',v_job.lease_token));
end $$;

create or replace function hq_private.worker_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.hq_agent_jobs; v_task public.hq_business_tasks; v_digest text; v_body jsonb; v_artifact uuid; v_lesson uuid; v_next text; v_source text; v_source_id uuid; v_summary text; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_reply is null or octet_length(p_reply)>32000 or (p_error is not null and (p_error !~ '^[a-z-]{1,80}$' or p_reply<>''))
    or (p_error is null and (btrim(p_reply)='' or p_reply ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]')) then raise exception 'HQ_INVALID_JOB_RESULT' using errcode='22023'; end if;
  v_digest:=encode(extensions.digest(jsonb_build_array(p_reply,p_error)::text,'sha256'),'hex');
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into v_job from public.hq_agent_jobs where id=p_job_id for update;
  if not found or v_job.worker_id is distinct from p_worker_id or v_job.lease_token is distinct from p_lease_token then raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  if v_job.result_digest is not null then
    if v_job.result_digest<>v_digest then raise exception 'HQ_RESULT_ALREADY_COMMITTED' using errcode='PT409'; end if;
    return jsonb_build_object('accepted',true);
  end if;
  select * into v_task from public.hq_business_tasks where id=v_job.task_id for update;
  if v_job.status='blocked' or v_job.lease_expires_at<=clock_timestamp() or v_task.status='canceled' then
    update public.hq_agent_jobs set status='blocked',completed_at=coalesce(completed_at,clock_timestamp()),error=coalesce(error,'worker-interrupted'),result_digest=v_digest where id=v_job.id;
    perform hq_private.live_emit('agents'); return jsonb_build_object('accepted',true,'discarded',true);
  end if;
  if v_job.status<>'working' then raise exception 'HQ_JOB_ALREADY_FINISHED' using errcode='PT409'; end if;
  -- Structured stages fail closed. The exact reviewed artifact digest binds
  -- acceptance to the immutable output, rather than a narrative claim.
  if p_error is null and v_job.kind in ('task-route','head-review','ceo-review','lesson-extract','lesson-review') then
    begin v_body:=p_reply::jsonb; exception when others then v_body:=null; end;
    if jsonb_typeof(v_body) is distinct from 'object' then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind='task-route' and not exists(select 1 from hq_private.agent_roster a
      where a.id=v_body->>'assigneeId' and hq_private.workforce_agent_assignable(a.id) and a.id<>'AG-CEO-001') then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind in ('head-review','ceo-review','lesson-review') and
      (jsonb_typeof(v_body->'accepted') is distinct from 'boolean' or coalesce(octet_length(v_body->>'summary'),0) not between 1 and 8000) then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind in ('head-review','ceo-review') and not exists(select 1 from public.hq_task_artifacts a
      where a.id=v_job.artifact_id and a.digest=v_body->>'artifactDigest' and a.task_id=v_job.task_id) then p_error:='review-digest-mismatch'; end if;
    if p_error is null and v_job.kind='lesson-extract' and (coalesce(char_length(v_body->>'summary'),0) not between 1 and 240
      or coalesce(octet_length(v_body->>'body'),0) not between 1 and 8000) then p_error:='stage-output-invalid'; end if;
  end if;
  update public.hq_agent_jobs set status=case when p_error is null then 'completed' else 'blocked' end,completed_at=clock_timestamp(),error=p_error,
    result_digest=v_digest,result_text=case when p_error is null then p_reply else null end where id=v_job.id;
  if p_error is not null then
    update public.hq_agent_jobs set status='blocked',error='dependency-unavailable',completed_at=clock_timestamp() where depends_on=v_job.id and status='queued';
    update public.hq_business_tasks set status='blocked',error=p_error,updated_at=clock_timestamp(),completed_at=clock_timestamp()
      where id=v_job.task_id and status<>'canceled' and v_job.kind not in ('lesson-extract','lesson-review');
    perform hq_private.workforce_wake(); return jsonb_build_object('accepted',true);
  end if;
  insert into public.hq_task_artifacts(task_id,job_id,agent_id,kind,text,digest,input_artifact_id)
    values(v_job.task_id,v_job.id,v_job.agent_id,v_job.kind,p_reply,encode(extensions.digest(p_reply,'sha256'),'hex'),v_job.artifact_id) returning id into v_artifact;
  if v_job.kind='conversation-hr' then null; -- Existing dependent CEO already exists.
  elsif v_job.kind='conversation-ceo' then
    insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to) values(v_job.conversation_id,'assistant',v_job.agent_id,p_reply,v_job.founder_message_id);
    perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_artifact);
  elsif v_job.kind='task-route' then
    update public.hq_business_tasks set assignee_id=v_body->>'assigneeId',updated_at=clock_timestamp() where id=v_job.task_id;
    perform hq_private.workforce_enqueue(v_job,'task-work',v_body->>'assigneeId',null,null,0);
  elsif v_job.kind='task-work' then
    v_next:=case when v_job.agent_id in ('AG-HR-002','AG-HR-003','AG-CEO-001') then 'head-review' else 'ceo-review' end;
    perform hq_private.workforce_enqueue(v_job,v_next,case when v_next='head-review' then 'AG-HR-001' else 'AG-CEO-001' end,v_artifact,null,v_job.attempt);
  elsif v_job.kind in ('head-review','ceo-review') then
    update public.hq_business_tasks set review_summary=v_body->>'summary',updated_at=clock_timestamp() where id=v_job.task_id;
    if (v_body->>'accepted')::boolean then
      if v_job.kind='head-review' then perform hq_private.workforce_enqueue(v_job,'ceo-review','AG-CEO-001',v_job.artifact_id,null,v_job.attempt);
      else
        update public.hq_business_tasks set deliverable=(select text from public.hq_task_artifacts where id=v_job.artifact_id) where id=v_job.task_id;
        perform hq_private.workforce_enqueue(v_job,'task-report','AG-CEO-001',v_job.artifact_id,null,v_job.attempt);
      end if;
    elsif v_task.repair_count<2 then
      update public.hq_business_tasks set repair_count=repair_count+1,status='queued',updated_at=clock_timestamp() where id=v_job.task_id;
      perform hq_private.workforce_enqueue(v_job,'task-work',v_task.assignee_id,v_job.artifact_id,null,v_task.repair_count+1);
    else update public.hq_business_tasks set status='blocked',error='review-repairs-exhausted',updated_at=clock_timestamp(),completed_at=clock_timestamp() where id=v_job.task_id;
    end if;
  elsif v_job.kind='task-report' then
    insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to) values(v_job.conversation_id,'assistant',v_job.agent_id,p_reply,v_job.founder_message_id);
    update public.hq_business_tasks set status='completed',updated_at=clock_timestamp(),completed_at=clock_timestamp() where id=v_job.task_id;
    perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_artifact);
  elsif v_job.kind='lesson-extract' then
    v_source:=case when v_job.task_id is null then 'conversation' else 'task' end; v_source_id:=coalesce(v_job.task_id,v_job.founder_message_id);
    insert into public.hq_agent_lessons(founder_user_id,source_type,source_id,source_digest,agent_id,summary,body,digest,content_digest)
      values(v_job.founder_user_id,v_source,v_source_id,(select digest from public.hq_task_artifacts where id=v_job.artifact_id),
        coalesce(v_task.assignee_id,'AG-CEO-001'),v_body->>'summary',v_body->>'body',
        encode(extensions.digest(v_source||v_source_id::text||(v_body->>'body'),'sha256'),'hex'),
        encode(extensions.digest(coalesce(v_task.assignee_id,'AG-CEO-001')||lower(regexp_replace(btrim(v_body->>'body'),'\s+',' ','g')),'sha256'),'hex'))
      on conflict do nothing returning id into v_lesson;
    if v_lesson is not null then perform hq_private.workforce_enqueue(v_job,'lesson-review','AG-CEO-001',v_job.artifact_id,v_lesson); end if;
  elsif v_job.kind='lesson-review' then
    update public.hq_agent_lessons set status=case when (v_body->>'accepted')::boolean then 'accepted' else 'rejected' end,
      reviewed_at=clock_timestamp(),reviewed_by_job_id=v_job.id where id=v_job.lesson_id and status='proposed';
  end if;
  update hq_private.agent_roster set last_seen_at=clock_timestamp() where id=v_job.agent_id;
  update public.hq_agent_conversations set updated_at=clock_timestamp() where id=v_job.conversation_id;
  perform hq_private.worker_presence(p_worker_id); perform hq_private.workforce_wake();
  return jsonb_build_object('accepted',true);
end $$;

-- Accepted learning publication is a narrow trusted-host operation. The writer
-- receives no source editing authority; immutable receipts reference its own
-- output folder only. Repeat delivery must match the original receipt exactly.
create function hq_private.worker_pending_lessons(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$ begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'source_type',l.source_type,
    'source_id',l.source_id,'source_digest',l.source_digest,'digest',l.digest)) from
    (select * from public.hq_agent_lessons where status='accepted' order by created_at,id limit 8) l),'[]'::jsonb);
end $$;
create function public.hq_worker_pending_lessons(p_worker_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.worker_pending_lessons(p_worker_id); $$;
create function hq_private.worker_publish_lesson(p_worker_id uuid,p_lesson_id uuid,p_reference text,p_digest text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare l public.hq_agent_lessons; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if coalesce(p_reference,'') !~ '^https://drive[.]google[.]com/file/d/[A-Za-z0-9_-]{8,200}/view(#[A-Za-z0-9_-]{1,100})?$' or coalesce(p_digest,'') !~ '^[0-9a-f]{64}$' then
    raise exception 'HQ_INVALID_LESSON_RECEIPT' using errcode='22023'; end if;
  select * into l from public.hq_agent_lessons where id=p_lesson_id for update;
  if not found or p_digest is distinct from l.digest then raise exception 'HQ_INVALID_LESSON_RECEIPT' using errcode='22023'; end if;
  if l.status='published' then
    if (l.publication_reference,l.publication_digest) is distinct from (p_reference,p_digest) then raise exception 'HQ_LESSON_ALREADY_PUBLISHED' using errcode='PT409'; end if;
  elsif l.status='accepted' and l.reviewed_by_job_id is not null then
    update public.hq_agent_lessons set status='published',published_at=clock_timestamp(),publication_reference=p_reference,publication_digest=p_digest where id=l.id;
    perform hq_private.live_emit('agents');
  else raise exception 'HQ_LESSON_REVIEW_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object('accepted',true);
end $$;
create function public.hq_worker_publish_lesson(p_worker_id uuid,p_lesson_id uuid,p_reference text,p_digest text) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_publish_lesson(p_worker_id,p_lesson_id,p_reference,p_digest); $$;

-- Grant only guarded RPCs; helper enqueue/wake and tables remain private.
revoke all on function hq_private.workforce_wake(),hq_private.workforce_enqueue(public.hq_agent_jobs,text,text,uuid,uuid,integer),
 hq_private.worker_sync_roster(uuid,jsonb),public.hq_worker_sync_roster(uuid,jsonb),hq_private.create_business_task(text,text,text,text,uuid),public.hq_create_task(text,text,text,text,uuid),
 hq_private.cancel_business_task(uuid),public.hq_cancel_task(uuid),hq_private.agent_snapshot(),hq_private.agent_snapshot_v1(),
 hq_private.worker_pending_lessons(uuid),public.hq_worker_pending_lessons(uuid),hq_private.worker_publish_lesson(uuid,uuid,text,text),public.hq_worker_publish_lesson(uuid,uuid,text,text)
 from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_sync_roster(uuid,jsonb),public.hq_worker_sync_roster(uuid,jsonb),hq_private.create_business_task(text,text,text,text,uuid),public.hq_create_task(text,text,text,text,uuid),
 hq_private.cancel_business_task(uuid),public.hq_cancel_task(uuid),hq_private.agent_snapshot(),
 hq_private.worker_pending_lessons(uuid),public.hq_worker_pending_lessons(uuid),hq_private.worker_publish_lesson(uuid,uuid,text,text),public.hq_worker_publish_lesson(uuid,uuid,text,text)
 to authenticated;

-- Keep existing conversation enqueue code compatible while identifying CEO jobs.
create function hq_private.normalize_conversation_job() returns trigger language plpgsql set search_path='' as $$ begin
  if new.kind='conversation-hr' and new.agent_id='AG-CEO-001' then new.kind:='conversation-ceo'; end if; return new;
end $$;
create trigger hq_conversation_kind before insert on public.hq_agent_jobs for each row execute function hq_private.normalize_conversation_job();
revoke all on function hq_private.normalize_conversation_job() from public,anon,authenticated,service_role;
create function hq_private.worker_roster_sources(p_worker_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  return jsonb_build_object('rootId','1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8','files',coalesce((select jsonb_agg(jsonb_build_object(
    'id',f.file_id,'name',f.name,'parents',f.parent_ids,'mimeType',f.mime_type) order by f.file_id) from hq_private.brain_files f
    where f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.in_scope and not f.trashed),'[]'::jsonb));
end $$;
create function public.hq_worker_roster_sources(p_worker_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select hq_private.worker_roster_sources(p_worker_id); $$;
revoke all on function hq_private.worker_roster_sources(uuid),public.hq_worker_roster_sources(uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_roster_sources(uuid),public.hq_worker_roster_sources(uuid) to authenticated;
create function hq_private.workforce_brain_changed() returns trigger language plpgsql security definer set search_path='' as $$ begin
  perform realtime.send(jsonb_build_object('kind','roster'),'jobs','hq-agent-jobs',true); return null;
end $$;
create trigger hq_workforce_brain_changed after insert or update or delete on hq_private.brain_files for each statement execute function hq_private.workforce_brain_changed();
revoke all on function hq_private.workforce_brain_changed() from public,anon,authenticated,service_role;

-- A fresh leased heartbeat is individual employee presence, not proof that every
-- configured employee is connected. Cancellation fences heartbeat immediately.
create or replace function hq_private.worker_heartbeat(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$ declare v_agent text; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_status is distinct from 'working' then raise exception 'HQ_INVALID_JOB_STATUS' using errcode='22023'; end if;
  update public.hq_agent_jobs set lease_expires_at=clock_timestamp()+interval '300 seconds'
    where id=p_job_id and worker_id=p_worker_id and lease_token=p_lease_token and status='working' and lease_expires_at>clock_timestamp()
      and (task_id is null or not exists(select 1 from public.hq_business_tasks t where t.id=task_id and t.status='canceled'))
    returning agent_id into v_agent;
  if not found then return jsonb_build_object('accepted',false); end if;
  update hq_private.agent_roster set last_seen_at=clock_timestamp() where id=v_agent;
  perform hq_private.worker_presence(p_worker_id); return jsonb_build_object('accepted',true);
end $$;

-- Rebind the old conversation adapter to v2 snapshot and count founder requests
-- separately from the new internal review/learning stages.
create or replace function hq_private.send_ceo_message(p_prompt text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_conversation uuid; v_message uuid; v_hr_job uuid; v_existing public.hq_agent_jobs; v_previous text;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or p_prompt is null or pg_catalog.char_length(p_prompt) not between 1 and 6000
    or pg_catalog.btrim(p_prompt)='' or p_prompt ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then
    raise exception 'HQ_INVALID_MESSAGE' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into v_existing from public.hq_agent_jobs where founder_user_id=v_uid and request_key=p_request_key and agent_id='AG-CEO-001' and kind='conversation-ceo';
  if found then
    select m.text into v_previous from public.hq_agent_messages m where m.id=v_existing.founder_message_id;
    if v_previous is distinct from p_prompt then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.agent_snapshot();
  end if;
  if (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and status='queued')>=40
    or (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and agent_id='AG-CEO-001' and kind='conversation-ceo'
      and created_at>pg_catalog.clock_timestamp()-interval '1 hour')>=60 then
    raise exception 'HQ_MESSAGE_QUEUE_LIMIT' using errcode='PT429';
  end if;
  insert into public.hq_agent_conversations(founder_user_id) values(v_uid)
    on conflict(founder_user_id) do update set updated_at=pg_catalog.clock_timestamp() returning id into v_conversation;
  if (select pg_catalog.count(*) from public.hq_agent_messages where conversation_id=v_conversation)>=10000
    or (select coalesce(pg_catalog.sum(pg_catalog.octet_length(text)),0) from public.hq_agent_messages where conversation_id=v_conversation)>33522432
    or (select coalesce(pg_catalog.sum(pg_catalog.octet_length(result_text)),0) from public.hq_agent_jobs where founder_user_id=v_uid)>33522432 then
    raise exception 'HQ_HISTORY_CAPACITY' using errcode='PT409';
  end if;
  insert into public.hq_agent_messages(conversation_id,role,agent_id,text) values(v_conversation,'founder','AG-CEO-001',p_prompt) returning id into v_message;
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key)
    values(v_conversation,v_message,v_uid,'AG-HR-001',p_request_key) returning id into v_hr_job;
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,depends_on)
    values(v_conversation,v_message,v_uid,'AG-CEO-001',p_request_key,v_hr_job);
  perform hq_private.live_emit('agents');
  -- Publication failure rolls back this enqueue; a successful send has a
  -- matching managed broadcast receipt. A reconnect also drains existing jobs.
  perform realtime.send('{}'::jsonb,'jobs','hq-agent-jobs',true);
  if not exists(select 1 from realtime.messages m where m.topic='hq-agent-jobs' and m.event='jobs' and m.private
    and m.inserted_at>=(pg_catalog.transaction_timestamp() at time zone 'UTC')) then
    raise exception 'HQ_QUEUE_PUSH_UNAVAILABLE' using errcode='PT503';
  end if;
  return hq_private.agent_snapshot();
end;
$$;

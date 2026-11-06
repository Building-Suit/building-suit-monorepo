-- Prepared meeting persistence. Applying this file does not qualify a provider,
-- activate an employee, enable an executor, or deploy an unattended service.
-- Reuses the current HQ founder/session boundary; staffing plans remain separate.

-- Reuses the canonical roster and hq_business_tasks/agent_jobs worker pipeline.
-- Meeting receipts add provenance only: no second queue, worker or review API.

-- Independent operator evidence is not inferred from registry presence,
-- staffing approval, attendance or a configured worker. Nothing is seeded.
create table hq_private.meeting_agent_qualifications (
  agent_id text primary key references hq_private.agent_roster(id),
  binding_digest text not null check (binding_digest ~ '^[0-9a-f]{64}$'),
  qualification_scope text not null check (qualification_scope='read-approved-sources-worker-job-600'),
  evidence_reference text not null check (pg_catalog.length(pg_catalog.btrim(evidence_reference)) between 1 and 2000),
  operator_role name not null default current_user,
  qualified_at timestamptz not null default pg_catalog.clock_timestamp()
);
alter table hq_private.meeting_agent_qualifications enable row level security;
revoke all on hq_private.meeting_agent_qualifications from public,anon,authenticated,service_role;

create table public.hq_meetings (
  id uuid primary key,
  founder_id uuid not null,
  title text not null check (pg_catalog.length(title) between 1 and 200),
  language text not null check (language in ('ar','en')),
  status text not null default 'active' check (status in ('active','ended')),
  connection text not null default 'connected' check (connection in ('connected','disconnected','ended')),
  disconnect_policy text not null default 'hold' check (disconnect_policy = 'hold'),
  participants text[] not null,
  floor text,
  generation bigint not null default 0,
  revision bigint not null default 1,
  projection_digest text,
  paused boolean not null default false,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  ended_at timestamptz,
  unique(id,founder_id)
);
create index hq_meetings_owner_created on public.hq_meetings(founder_id,created_at desc);

create table public.hq_meeting_events (
  id bigint generated always as identity primary key,
  meeting_id uuid not null references public.hq_meetings(id),
  kind text not null,
  actor_id text not null,
  payload jsonb not null check (pg_catalog.octet_length(payload::text) <= 32768),
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
create index hq_meeting_events_order on public.hq_meeting_events(meeting_id,id);
create trigger hq_meeting_events_immutable before update or delete on public.hq_meeting_events
  for each row execute function hq_private.immutable_record();

create table public.hq_meeting_plan_versions (
  meeting_id uuid not null references public.hq_meetings(id),
  plan_id uuid not null,
  version integer not null check (version > 0),
  document jsonb not null,
  digest text not null check (digest ~ '^[0-9a-f]{64}$'),
  status text not null check (status in ('draft','awaiting-approval','approved','dispatched','revised','deferred','discarded','blocked')),
  start_policy text check (start_policy in ('now','meeting-end','manual')),
  approved_by uuid,
  approved_session uuid,
  approved_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(meeting_id,plan_id,version),
  check ((approved_by is null) = (approved_at is null))
);

create function hq_private.guard_meeting_plan_version() returns trigger
language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' or new.meeting_id is distinct from old.meeting_id or new.plan_id is distinct from old.plan_id
    or new.version is distinct from old.version or new.document is distinct from old.document
    or new.digest is distinct from old.digest or new.created_at is distinct from old.created_at then
    raise exception 'HQ_MEETING_IMMUTABLE_PLAN_VERSION' using errcode='55000';
  end if;
  return new;
end;
$$;
create trigger hq_meeting_plan_version_guard before update or delete on public.hq_meeting_plan_versions
  for each row execute function hq_private.guard_meeting_plan_version();

create table public.hq_meeting_task_links (
  business_task_id uuid primary key references public.hq_business_tasks(id),
  meeting_id uuid not null references public.hq_meetings(id),
  task_kind text not null check (task_kind in ('execution','research','contribution')),
  plan_id uuid,
  plan_version integer,
  task_key text not null,
  instruction jsonb not null,
  request_key uuid not null unique,
  reported_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key(meeting_id,plan_id,plan_version) references public.hq_meeting_plan_versions(meeting_id,plan_id,version),
  unique(meeting_id,plan_id,plan_version,task_key),
  check ((task_kind='execution' and plan_id is not null and plan_version is not null)
    or (task_kind in ('research','contribution') and plan_id is null and plan_version is null))
);
create index hq_meeting_task_links_meeting on public.hq_meeting_task_links(meeting_id,created_at);
create function hq_private.guard_meeting_task_link() returns trigger
language plpgsql set search_path='' as $$ begin
  if tg_op='DELETE' or (pg_catalog.to_jsonb(new)-'reported_at') is distinct from (pg_catalog.to_jsonb(old)-'reported_at')
    or old.reported_at is not null or new.reported_at is null then
    raise exception 'HQ_MEETING_IMMUTABLE_TASK_LINK' using errcode='55000';
  end if;
  return new;
end $$;
create trigger hq_meeting_task_link_guard before update or delete on public.hq_meeting_task_links
  for each row execute function hq_private.guard_meeting_task_link();

-- The current task-route stage may choose an assignee. Meeting authorization
-- pins its owner: a mismatched route aborts before the existing transaction can
-- enqueue task-work. The link and original enqueue commit atomically.
create function hq_private.guard_meeting_task_owner() returns trigger
language plpgsql set search_path='' as $$ begin
  if exists(select 1 from public.hq_meeting_task_links l where l.business_task_id=new.id
    and l.instruction->>'ownerId' is distinct from new.assignee_id) then
    raise exception 'HQ_MEETING_OWNER_SCOPE_CHANGED' using errcode='42501';
  end if;
  return new;
end $$;
create trigger hq_meeting_task_owner_guard before update of assignee_id on public.hq_business_tasks
  for each row execute function hq_private.guard_meeting_task_owner();

create table public.hq_meeting_contributions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  meeting_id uuid not null references public.hq_meetings(id),
  generation bigint not null,
  agent_id text not null references hq_private.agent_roster(id),
  binding_digest text not null check(binding_digest ~ '^[0-9a-f]{64}$'),
  source_event_id bigint not null references public.hq_meeting_events(id),
  source_kind text not null check(source_kind in ('ceo-chat','head-chat','finding')),
  request_key uuid not null unique,
  job_id uuid unique references public.hq_agent_jobs(id),
  business_task_id uuid references public.hq_business_tasks(id),
  founder_message_id uuid references public.hq_agent_messages(id),
  response_message_id uuid references public.hq_agent_messages(id),
  response_artifact_id uuid references public.hq_task_artifacts(id),
  response_digest text check(response_digest ~ '^[0-9a-f]{64}$'),
  response_text text check(pg_catalog.char_length(response_text) between 1 and 4000),
  status text not null check(status in ('thinking','speaking','completed','interrupted','failed','blocked')),
  error text,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  completed_at timestamptz,
  check(status<>'speaking' or (response_text is not null and response_digest is not null
    and (response_message_id is not null or response_artifact_id is not null)))
);
create unique index hq_meeting_one_floor on public.hq_meeting_contributions(meeting_id) where status in ('thinking','speaking');
alter table public.hq_meeting_contributions enable row level security;
revoke all on public.hq_meeting_contributions from public,anon,authenticated,service_role;

create table hq_private.meeting_requests (
  founder_id uuid not null,
  request_key uuid not null,
  meeting_id uuid not null references public.hq_meetings(id),
  command jsonb not null,
  primary key(founder_id,request_key)
);

alter table public.hq_meetings enable row level security;
alter table public.hq_meeting_events enable row level security;
alter table public.hq_meeting_plan_versions enable row level security;
alter table public.hq_meeting_task_links enable row level security;
alter table hq_private.meeting_requests enable row level security;
revoke all on public.hq_meetings,public.hq_meeting_events,public.hq_meeting_plan_versions,public.hq_meeting_task_links,
  hq_private.meeting_requests from public,anon,authenticated,service_role;

create function hq_private.meeting_digest(p_document jsonb) returns text
language sql immutable strict set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_document::text,'UTF8')),'hex');
$$;

create function hq_private.meeting_agent_binding_digest(p_agent text) returns text
language sql stable set search_path='' as $$
  select hq_private.meeting_digest(pg_catalog.jsonb_build_object('id',r.id,'profileFileId',r.profile_file_id,
    'skillFileIds',r.skill_file_ids,'model',r.model,'effort',r.effort,'managerId',r.manager_id,
    'lifecycle',r.lifecycle,'enabled',r.enabled,'sourceDigest',r.source_digest))
  from hq_private.agent_roster r where r.id=p_agent;
$$;
-- Conversation configuration is distinct from work qualification. This is
-- eligibility to attempt a context-only reply, never observed provider readiness
-- or permission to research/execute a task.
create function hq_private.meeting_agent_conversation_available(p_agent text) returns boolean
language sql stable set search_path='' as $$
  select hq_private.workforce_agent_assignable(p_agent) and exists(select 1 from hq_private.agent_roster r where r.id=p_agent
    and r.profile_file_id ~ '^[A-Za-z0-9_-]{8,200}$' and r.model ~ '^gpt-[A-Za-z0-9.-]{1,70}$'
    and r.effort in ('minimal','low','medium','high','xhigh'));
$$;

create function hq_private.meeting_agent_qualified(p_agent text) returns boolean
language sql stable set search_path='' as $$
  select hq_private.meeting_agent_conversation_available(p_agent) and exists(
    select 1 from hq_private.meeting_agent_qualifications q where q.agent_id=p_agent
      and q.qualification_scope='read-approved-sources-worker-job-600'
      and q.binding_digest=hq_private.meeting_agent_binding_digest(p_agent));
$$;

create function hq_private.meeting_normalize_plan(p_document jsonb) returns jsonb
language plpgsql set search_path = '' as $$
declare v_task jsonb; v_owner text; v_supervisor text; v_key text; v_seen text[] := '{}'; v_values jsonb; v_value jsonb;
  v_ready text[] := '{}'; v_new text[];
begin
  perform hq_private.require_shape(p_document,array['title','tasks'],array['title','tasks','summary']);
  perform hq_private.required_text(p_document->'title',200);
  if p_document ? 'summary' then perform hq_private.required_text(p_document->'summary',4000); end if;
  if pg_catalog.jsonb_typeof(p_document->'tasks') is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_document->'tasks') not between 1 and 16
    or pg_catalog.octet_length(p_document::text) > 32768 then raise exception 'HQ_MEETING_INVALID_PLAN' using errcode = '22023'; end if;
  for v_task in select value from pg_catalog.jsonb_array_elements(p_document->'tasks') loop
    perform hq_private.require_shape(v_task,
      array['id','objective','ownerId','supervisorId','deliverable','inputs','dependencies','allowedActions','budget','acceptanceCriteria','requiredReview','blockers','priority','environment','timeLimitSeconds'],
      array['id','objective','ownerId','supervisorId','deliverable','inputs','dependencies','allowedActions','budget','acceptanceCriteria','requiredReview','blockers','priority','environment','timeLimitSeconds','timeoutScope']);
    v_key := hq_private.required_text(v_task->'id',120);
    if v_key = any(v_seen) then raise exception 'HQ_MEETING_DUPLICATE_TASK' using errcode = '22023'; end if;
    v_seen := pg_catalog.array_append(v_seen,v_key);
    perform hq_private.required_text(v_task->'objective',2000);
    perform hq_private.required_text(v_task->'deliverable',2000);
    v_owner := hq_private.required_text(v_task->'ownerId',40);
    v_supervisor := hq_private.required_text(v_task->'supervisorId',40);
    if not exists(select 1 from hq_private.agent_roster b join hq_private.agent_roster supervisor on supervisor.id=b.manager_id and supervisor.enabled where b.id=v_owner and b.enabled and b.manager_id=v_supervisor)
      or v_owner=v_supervisor then raise exception 'HQ_MEETING_UNKNOWN_OWNER' using errcode = '22023'; end if;
    if v_task->'budget' is distinct from '0'::jsonb or v_task->>'requiredReview' is distinct from 'independent'
      or v_task->>'environment' is null or v_task->>'environment' not in ('qualified-cloud','synthetic','hq-existing-worker')
      or pg_catalog.jsonb_typeof(v_task->'priority') is distinct from 'number' or (v_task->>'priority')::numeric not between 1 and 5
      or (v_task->>'priority')::numeric <> pg_catalog.trunc((v_task->>'priority')::numeric)
      or pg_catalog.jsonb_typeof(v_task->'timeLimitSeconds') is distinct from 'number'
      or (v_task->>'timeLimitSeconds')::numeric not between 1 and 600
      or (v_task->>'timeLimitSeconds')::numeric <> pg_catalog.trunc((v_task->>'timeLimitSeconds')::numeric)
      then raise exception 'HQ_MEETING_TASK_LIMIT' using errcode = '22023'; end if;
    if pg_catalog.jsonb_typeof(v_task->'inputs') is distinct from 'array' or pg_catalog.jsonb_typeof(v_task->'dependencies') is distinct from 'array'
      or pg_catalog.jsonb_typeof(v_task->'blockers') is distinct from 'array' or pg_catalog.jsonb_typeof(v_task->'acceptanceCriteria') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_task->'acceptanceCriteria') < 1
      or pg_catalog.jsonb_typeof(v_task->'allowedActions') is distinct from 'array'
      or pg_catalog.jsonb_array_length(v_task->'allowedActions') <> 1
      or v_task->'allowedActions'->>0 is null
      or v_task->'allowedActions'->>0 not in ('read-approved-sources','synthetic-fixture')
      then raise exception 'HQ_MEETING_TASK_SCOPE' using errcode = '22023'; end if;
    foreach v_values in array array[v_task->'inputs',v_task->'dependencies',v_task->'blockers',v_task->'acceptanceCriteria'] loop
      if pg_catalog.jsonb_array_length(v_values)>32 then raise exception 'HQ_MEETING_TASK_SCOPE' using errcode='22023'; end if;
      for v_value in select value from pg_catalog.jsonb_array_elements(v_values) loop
        perform hq_private.required_text(v_value,2000);
      end loop;
    end loop;
  end loop;
  if exists(select 1 from pg_catalog.jsonb_array_elements(p_document->'tasks') t,
    lateral pg_catalog.jsonb_array_elements_text(t->'dependencies') d
    where d=t->>'id' or not (d=any(v_seen))) then raise exception 'HQ_MEETING_INVALID_DEPENDENCY' using errcode='22023'; end if;
  -- Bounded topological admission prevents mutually blocked approved tasks.
  loop
    select pg_catalog.array_agg(t->>'id') into v_new from pg_catalog.jsonb_array_elements(p_document->'tasks') t
      where not (t->>'id'=any(v_ready)) and not exists(
        select 1 from pg_catalog.jsonb_array_elements_text(t->'dependencies') d where not (d=any(v_ready)));
    if v_new is null then raise exception 'HQ_MEETING_DEPENDENCY_CYCLE' using errcode='22023'; end if;
    v_ready := v_ready || v_new;
    exit when pg_catalog.cardinality(v_ready)=pg_catalog.cardinality(v_seen);
  end loop;
  return p_document;
end;
$$;

-- The existing host limits each job to 600 seconds. It does not promise a
-- whole-task deadline, dependency scheduler or synthetic environment.
-- Those unsupported contracts remain durable blocked outcomes. A source-only
-- trigger above pins assignment to the exact founder-reviewed owner.
create function hq_private.meeting_dispatch_supported(p_document jsonb) returns boolean
language sql stable set search_path='' as $$
  select not exists(select 1 from pg_catalog.jsonb_array_elements(p_document->'tasks') t
    where t->>'environment' is distinct from 'hq-existing-worker'
      or t->>'timeoutScope' is distinct from 'worker-job'
      or t->'timeLimitSeconds' is distinct from '600'::jsonb
      or t->'allowedActions' is distinct from '["read-approved-sources"]'::jsonb
      or pg_catalog.jsonb_array_length(t->'dependencies')<>0
      or pg_catalog.jsonb_array_length(t->'blockers')<>0
      or t->>'supervisorId' is distinct from case when t->>'ownerId' in ('AG-HR-002','AG-HR-003') then 'AG-HR-001' else 'AG-CEO-001' end
      or not hq_private.meeting_agent_qualified(t->>'ownerId')
      or not hq_private.meeting_agent_qualified(t->>'supervisorId')
      or not hq_private.meeting_agent_qualified('AG-CEO-001')
      or pg_catalog.char_length(t::text)>10000
      or pg_catalog.char_length((t->'acceptanceCriteria')::text)>6000);
$$;

-- Historic malformed receipts remain unverified; their prose cannot turn into
-- an accepted review merely because an artifact has a review stage label.
create function hq_private.meeting_review_body(p_text text) returns jsonb
language plpgsql immutable set search_path='' as $$
declare v jsonb;
begin
  begin v:=p_text::jsonb; exception when invalid_text_representation then return null; end;
  if pg_catalog.jsonb_typeof(v) is distinct from 'object' then return null; end if;
  return v;
end $$;

create function hq_private.meeting_payload(p_id uuid) returns jsonb
language sql set search_path = '' as $$
  with contribution_ids as (
    select id from(select recent.id,pg_catalog.sum(pg_catalog.octet_length(pg_catalog.to_jsonb(recent)::text)) over(order by recent.created_at desc,recent.id desc) as bytes
      from(select * from public.hq_meeting_contributions where meeting_id=p_id order by created_at desc,id desc limit 32) recent) bounded where bytes<=196608
  ), event_ids as (
    select id from(select recent.id,pg_catalog.sum(pg_catalog.octet_length(pg_catalog.to_jsonb(recent)::text)) over(order by recent.id desc) as bytes
      from(select * from public.hq_meeting_events where meeting_id=p_id order by id desc limit 200) recent) bounded where bytes<=131072
    union select source_event_id from public.hq_meeting_contributions where id in(select id from contribution_ids)
  ), plan_ids as (
    select plan_id,version from(select p.plan_id,p.version,pg_catalog.sum(pg_catalog.octet_length(pg_catalog.to_jsonb(p)::text)) over(order by p.created_at desc,p.version desc,p.plan_id) as bytes
      from public.hq_meeting_plan_versions p where meeting_id=p_id) bounded where bytes<=262144
  ), task_ids as (
    select id from(select candidate.id,pg_catalog.sum(candidate.bytes) over(order by candidate.priority,candidate.created_at desc,candidate.id) as bytes from(
      select t.id,l.created_at,pg_catalog.octet_length((pg_catalog.to_jsonb(t)||pg_catalog.jsonb_build_object('instruction',l.instruction))::text)+8192 as bytes,
        case when exists(select 1 from public.hq_meeting_contributions c where c.business_task_id=t.id and c.status in ('thinking','speaking')) then 0
          when t.status in ('queued','working','review') then 1 when t.status='completed' and l.reported_at is null then 2 else 3 end as priority
      from public.hq_meeting_task_links l join public.hq_business_tasks t on t.id=l.business_task_id where l.meeting_id=p_id) candidate) bounded where bytes<=393216
  ) select pg_catalog.jsonb_build_object(
    'meeting',pg_catalog.to_jsonb(m),
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.id) from
      (select * from public.hq_meeting_events where meeting_id=p_id and id in(select id from event_ids)) e),'[]'::jsonb),
    'plans',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.created_at,p.version)
      from public.hq_meeting_plan_versions p where p.meeting_id=p_id and (p.plan_id,p.version) in(select plan_id,version from plan_ids)),'[]'::jsonb),
    'tasks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'id',t.id,'meeting_id',l.meeting_id,'kind',l.task_kind,'plan_id',l.plan_id,'plan_version',l.plan_version,
      'task_key',l.task_key,'owner_id',l.instruction->>'ownerId','supervisor_id',l.instruction->>'supervisorId',
      'instruction',l.instruction,'business_status',t.status,'assignee_id',t.assignee_id,
      'status',case t.status when 'working' then 'running' when 'review' then 'running' when 'blocked' then 'failed' when 'canceled' then 'cancelled' else t.status end,
      'result',case when t.deliverable is not null then pg_catalog.jsonb_build_object('deliverable',t.deliverable) else null end,
      'error',t.error,'hand_raised',l.task_kind<>'contribution' and t.status='completed' and l.reported_at is null,
      'delivered_artifact_id',delivered.id,'delivered_digest',delivered.digest,
      'review_receipts',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',a.id,'agent_id',a.agent_id,
        'kind',a.kind,'digest',a.digest,'input_artifact_id',a.input_artifact_id,'input_digest',reviewed.digest,'created_at',a.created_at,
        'accepted',case when pg_catalog.jsonb_typeof(hq_private.meeting_review_body(a.text)->'accepted')='boolean'
          and hq_private.meeting_review_body(a.text)->>'artifactDigest'=reviewed.digest then hq_private.meeting_review_body(a.text)->'accepted' else null end) order by a.created_at,a.id)
        from public.hq_task_artifacts a join public.hq_agent_jobs reviewjob on reviewjob.id=a.job_id and reviewjob.status='completed'
          and reviewjob.task_id=t.id and reviewjob.kind=a.kind and reviewjob.agent_id=a.agent_id
        left join public.hq_task_artifacts reviewed on reviewed.id=a.input_artifact_id and reviewed.task_id=t.id
        where a.task_id=t.id and a.kind in ('head-review','ceo-review')),'[]'::jsonb),
      'review_summary',t.review_summary,'reported_at',l.reported_at,'created_at',l.created_at,'updated_at',t.updated_at)
      order by l.created_at,t.id) from public.hq_meeting_task_links l join public.hq_business_tasks t on t.id=l.business_task_id
      and t.founder_user_id=m.founder_id
      left join lateral(select a.id,a.digest from public.hq_task_artifacts a join public.hq_agent_jobs workjob on workjob.id=a.job_id
        and workjob.task_id=t.id and workjob.kind='task-work' and workjob.status='completed' and workjob.agent_id=a.agent_id
        where a.task_id=t.id and a.kind='task-work' and a.agent_id=l.instruction->>'ownerId' and a.text=t.deliverable
          and a.digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(a.text,'UTF8')),'hex')
        order by a.created_at desc,a.id desc limit 1) delivered on true
      where l.meeting_id=p_id and t.id in(select id from task_ids)),'[]'::jsonb),
    'contributions',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(c) order by c.created_at,c.id)
      from public.hq_meeting_contributions c where c.meeting_id=p_id and c.id in(select id from contribution_ids)),'[]'::jsonb),
    'turn',(select pg_catalog.jsonb_build_object('id',c.id,'agentId',c.agent_id,'generation',c.generation,'status',c.status,'language',m.language,'text',c.response_text)
      from public.hq_meeting_contributions c where c.meeting_id=p_id and c.generation=m.generation and c.status in ('thinking','speaking')),
    'executionBackend','hq-business-tasks')
  from public.hq_meetings m where m.id=p_id;
$$;

create function hq_private.meeting_create(p_id uuid,p_title text,p_language text,p_participants text[],p_request_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.founder_uid(); v_command jsonb; v_previous hq_private.meeting_requests;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_id is null or p_request_key is null or p_title is null or pg_catalog.length(pg_catalog.btrim(p_title)) not between 1 and 200
    or p_language is null or p_language not in ('ar','en') or p_participants is null
    or pg_catalog.cardinality(p_participants) not between 1 and 16
    or not ('AG-CEO-001'=any(p_participants))
    or (select pg_catalog.count(distinct a) from pg_catalog.unnest(p_participants) a) <> pg_catalog.cardinality(p_participants)
    or exists(select 1 from pg_catalog.unnest(p_participants) a where not exists(select 1 from hq_private.agent_roster b where b.id=a and b.enabled))
    then raise exception 'HQ_MEETING_INVALID_CREATE' using errcode='22023'; end if;
  if exists(select 1 from pg_catalog.unnest(p_participants) a where not hq_private.meeting_agent_conversation_available(a))
    then raise exception 'HQ_MEETING_CONVERSATION_UNAVAILABLE' using errcode='55000'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,9821));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if exists(select 1 from pg_catalog.unnest(p_participants) a where not hq_private.meeting_agent_conversation_available(a))
    then raise exception 'HQ_MEETING_CONVERSATION_UNAVAILABLE' using errcode='55000'; end if;
  v_command := pg_catalog.jsonb_build_object('type','create','id',p_id,'title',p_title,'language',p_language,'participants',p_participants);
  select * into v_previous from hq_private.meeting_requests where founder_id=v_uid and request_key=p_request_key;
  if found then
    if v_previous.meeting_id<>p_id or v_previous.command<>v_command then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.meeting_payload(p_id);
  end if;
  if (select pg_catalog.count(*) from public.hq_meetings where founder_id=v_uid and status='active') >= 4
    then raise exception 'HQ_MEETING_CAPACITY' using errcode='54000'; end if;
  insert into public.hq_meetings(id,founder_id,title,language,participants) values(p_id,v_uid,pg_catalog.btrim(p_title),p_language,p_participants);
  insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,'meeting-created',v_uid::text,v_command);
  insert into hq_private.meeting_requests(founder_id,request_key,meeting_id,command) values(v_uid,p_request_key,p_id,v_command);
  perform hq_private.live_emit('agents');
  return hq_private.meeting_payload(p_id);
end;
$$;

-- Same transaction and founder actor as the reviewed command. The canonical
-- task helper retains capacity, assignability, push and idempotency checks.
create function hq_private.meeting_enqueue(p_id uuid,p_plan uuid,p_version integer,p_task jsonb,p_request uuid,p_kind text default null) returns uuid
language plpgsql set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_task_id uuid; v_brief text;
begin
  if v_uid is null or not exists(select 1 from public.hq_meetings where id=p_id and founder_id=v_uid)
    then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  v_brief:=pg_catalog.jsonb_build_object('origin','hq-meeting','meetingId',p_id,'planId',p_plan,'planVersion',p_version,
    'scopeDigest',hq_private.meeting_digest(p_task),'planDigest',(select digest from public.hq_meeting_plan_versions where meeting_id=p_id and plan_id=p_plan and version=p_version),'contract',p_task)::text;
  perform hq_private.create_business_task(pg_catalog.left(p_task->>'objective',180),v_brief,
    (p_task->'acceptanceCriteria')::text,p_task->>'ownerId',p_request);
  select id into strict v_task_id from public.hq_business_tasks where founder_user_id=v_uid and request_key=p_request;
  insert into public.hq_meeting_task_links(business_task_id,meeting_id,task_kind,plan_id,plan_version,task_key,instruction,request_key)
    values(v_task_id,p_id,case when p_plan is null then coalesce(p_kind,'research') else 'execution' end,p_plan,p_version,p_task->>'id',p_task,p_request)
    on conflict(business_task_id) do nothing;
  return v_task_id;
end $$;

create function hq_private.meeting_dispatch(p_id uuid,p_plan uuid,p_version integer) returns void
language plpgsql set search_path='' as $$
declare v_plan public.hq_meeting_plan_versions; v_task jsonb; v_request uuid;
begin
  select * into v_plan from public.hq_meeting_plan_versions where meeting_id=p_id and plan_id=p_plan and version=p_version for update;
  if not found or v_plan.status not in ('approved','dispatched') or v_plan.approved_by is distinct from hq_private.founder_uid() then return; end if;
  if v_plan.status='dispatched' then return; end if;
  if not hq_private.meeting_dispatch_supported(v_plan.document) or exists(
    select 1 from pg_catalog.jsonb_array_elements(v_plan.document->'tasks') t
    where not hq_private.meeting_agent_qualified(t->>'ownerId')
      or not exists(select 1 from hq_private.agent_roster r where r.id=t->>'ownerId' and r.manager_id=t->>'supervisorId' and r.enabled)) then
    update public.hq_meeting_plan_versions set status='blocked' where meeting_id=p_id and plan_id=p_plan and version=p_version;
    insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,'plan-dispatch-blocked',v_plan.approved_by::text,
      pg_catalog.jsonb_build_object('planId',p_plan,'version',p_version,'digest',v_plan.digest,'error','HQ_MEETING_SCOPE_UNSUPPORTED'));
    return;
  end if;
  for v_task in select value from pg_catalog.jsonb_array_elements(v_plan.document->'tasks') loop
    v_request:=pg_catalog.substr(hq_private.meeting_digest(pg_catalog.jsonb_build_array('hq-meeting-task-v1',p_id,p_plan,p_version,v_task->>'id')),1,32)::uuid;
    perform hq_private.meeting_enqueue(p_id,p_plan,p_version,v_task,v_request);
  end loop;
  update public.hq_meeting_plan_versions set status='dispatched' where meeting_id=p_id and plan_id=p_plan and version=p_version;
end $$;

-- A contribution is an attributed view of existing worker evidence, not a
-- second worker queue. Founder input cannot supply a model response.
create function hq_private.meeting_invalidate_contributions(p_id uuid) returns void
language plpgsql set search_path='' as $$
declare c public.hq_meeting_contributions; v_uid uuid:=hq_private.founder_uid();
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  for c in select * from public.hq_meeting_contributions where meeting_id=p_id and status in ('thinking','speaking') for update loop
    if c.source_kind in ('ceo-chat','head-chat') then
      update public.hq_agent_jobs set status='blocked',error='meeting-interrupted',completed_at=pg_catalog.clock_timestamp()
        where id=c.job_id and founder_user_id=v_uid and status in ('queued','working');
    end if;
    update public.hq_meeting_contributions set status='interrupted',completed_at=pg_catalog.clock_timestamp() where id=c.id;
  end loop;
end $$;

-- Bound source data for this meeting only. Keep the exact current utterance and
-- decision references; older excerpts are expendable. Ambiguous chat links are
-- represented by source event IDs, never a guessed set of URLs to inspect.
create function hq_private.meeting_text_addressees(p_id uuid,p_text text) returns text[]
language sql stable set search_path='' as $$
  select coalesce(pg_catalog.array_agg(r.id order by r.id),'{}'::text[]) from hq_private.agent_roster r join public.hq_meetings m on m.id=p_id
    where r.id=any(m.participants) and r.enabled and (
      pg_catalog.strpos(' '||pg_catalog.lower(pg_catalog.regexp_replace(p_text,'[[:punct:][:space:]]+',' ','g'))||' ',' '||pg_catalog.lower(r.name)||' ')>0
      or pg_catalog.strpos(' '||pg_catalog.lower(pg_catalog.regexp_replace(p_text,'[[:punct:][:space:]]+',' ','g'))||' ',' '||pg_catalog.lower(pg_catalog.split_part(r.name,' ',1))||' ')>0);
$$;

create function hq_private.meeting_contribution_context(p_id uuid,p_event bigint,p_agent text,p_text text) returns jsonb
language plpgsql set search_path='' as $$
declare m public.hq_meetings; p public.hq_meeting_plan_versions; d public.hq_meeting_events; v jsonb; v_candidate jsonb;
  r record; v_urls text[]:='{}'; v_link_events bigint[]:='{}'; v_match text[]; v_url text; v_host text;
  v_explicit integer:=0; v_addressees text[]; v_addressed text; v_reference jsonb:='{"status":"not-requested"}'::jsonb; v_excerpt text;
begin
  select * into strict m from public.hq_meetings where id=p_id and founder_id=hq_private.founder_uid();
  if not exists(select 1 from public.hq_meeting_events where id=p_event and meeting_id=p_id and kind='text'
    and actor_id=m.founder_id::text and payload->>'text'=p_text) then raise exception 'HQ_MEETING_SOURCE_REQUIRED' using errcode='42501'; end if;
  select payload->>'addressedTo' into v_addressed from public.hq_meeting_events where id=p_event;
  v_addressees:=hq_private.meeting_text_addressees(p_id,p_text);
  select * into p from public.hq_meeting_plan_versions where meeting_id=p_id order by created_at desc,version desc,plan_id limit 1;
  if found then select * into d from public.hq_meeting_events where meeting_id=p_id and kind='decidePlan'
    and payload->>'planId'=p.plan_id::text and payload->>'version'=p.version::text and payload->>'digest'=p.digest order by id desc limit 1; end if;
  select count(*) into v_explicit from pg_catalog.regexp_matches(p_text,'https?://[^[:space:]<>]+','g');
  if v_explicit>0 then v_reference:=pg_catalog.jsonb_build_object('status','explicit','sourceEventIds',pg_catalog.jsonb_build_array(p_event));
  elsif p_text ~* '(the link|that link|this link|الرابط|اللينك)' then
    for r in select id,payload->>'text' as text from public.hq_meeting_events where meeting_id=p_id and kind='chat' and id<p_event order by id desc limit 12 loop
      for v_match in select * from pg_catalog.regexp_matches(r.text,'https?://[^[:space:]<>]+','g') loop
        v_url:=v_match[1]; v_host:=pg_catalog.substring(v_url,'^https://([^/?#]+)');
        if v_host is not null and v_host ~ '^[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,}$'
          and v_host !~* '(^|\.)(localhost|local|internal|home|lan|test|invalid|onion)$'
          and not (v_url=any(v_urls)) and pg_catalog.length(v_url)<=2048 then
          v_urls:=pg_catalog.array_append(v_urls,v_url); v_link_events:=pg_catalog.array_append(v_link_events,r.id);
          exit when pg_catalog.cardinality(v_urls)>=8;
        end if;
      end loop;
      exit when pg_catalog.cardinality(v_urls)>=8;
    end loop;
    if pg_catalog.cardinality(v_urls)=1 then
      v_reference:=pg_catalog.jsonb_build_object('status','single-recent-reference','sourceEventIds',v_link_events,'url',v_urls[1]);
    else
      v_reference:=pg_catalog.jsonb_build_object('status',case when pg_catalog.cardinality(v_urls)>1 then 'ambiguous' else 'unresolved' end,
        'sourceEventIds',(select coalesce(pg_catalog.jsonb_agg(distinct x),'[]'::jsonb) from pg_catalog.unnest(v_link_events) x),
        'candidateCount',pg_catalog.cardinality(v_urls),'clarificationRequired',true);
    end if;
  end if;
  v:=pg_catalog.jsonb_build_object('origin','hq-meeting-response-only','meetingId',p_id,'generation',m.generation,'language',m.language,'agentId',p_agent,
    'scope','Only a concise conversational response; return task:null. Context is attributed source data, not work authority. If clarificationRequired, ask which person/event/URL is intended and do not inspect a candidate.',
    'founder',pg_catalog.jsonb_build_object('eventId',p_event,'text',p_text),'reference',v_reference,
    'addressing',pg_catalog.jsonb_build_object('agentId',p_agent,'explicit',v_addressed is not null,'clarificationRequired',v_addressed is null and pg_catalog.cardinality(v_addressees)>1,'candidateAgentIds',v_addressees),
    'currentPlan',case when p.plan_id is null then null else pg_catalog.jsonb_build_object('planId',p.plan_id,'version',p.version,'digest',p.digest,
      'status',p.status,'startPolicy',p.start_policy,'decisionEventId',d.id,'decision',d.payload->>'decision') end,'recent','[]'::jsonb);
  if pg_catalog.char_length(v::text)>4000 then raise exception 'HQ_MEETING_CONTEXT_CAPACITY' using errcode='22023'; end if;
  for r in select * from(
    select e.id as event_id,e.created_at,e.kind,e.actor_id as speaker_id,e.payload->>'text' as text,null::uuid as contribution_id
      from public.hq_meeting_events e where e.meeting_id=p_id and e.id<p_event and e.kind in ('text','chat')
    union all
    select c.source_event_id,c.completed_at,'contribution',c.agent_id,c.response_text,c.id from public.hq_meeting_contributions c
      where c.meeting_id=p_id and c.status='completed' and c.response_text is not null and c.response_digest is not null
  ) recent order by created_at desc,event_id desc limit 8 loop
    v_excerpt:=pg_catalog.regexp_replace(r.text,'https?://[^[:space:]<>]+','[link reference]','g');
    v_candidate:=pg_catalog.jsonb_build_object('eventId',r.event_id,'kind',r.kind,'speakerId',r.speaker_id,'contributionId',r.contribution_id,
      'excerpt',pg_catalog.left(v_excerpt,320),'truncated',pg_catalog.length(v_excerpt)>320);
    if pg_catalog.char_length((v||pg_catalog.jsonb_build_object('recent',(v->'recent')||pg_catalog.jsonb_build_array(v_candidate)))::text)<=4000 then
      v:=v||pg_catalog.jsonb_build_object('recent',(v->'recent')||pg_catalog.jsonb_build_array(v_candidate));
    end if;
  end loop;
  return v;
end $$;

create function hq_private.meeting_request_contribution(p_id uuid,p_event bigint,p_agent text,p_text text,p_request uuid) returns void
language plpgsql set search_path='' as $$
declare m public.hq_meetings; v_uid uuid:=hq_private.founder_uid(); v_key uuid; v_job public.hq_agent_jobs;
  v_context jsonb; v_prompt text; v_conversation uuid; v_message uuid; v_binding text;
begin
  select * into strict m from public.hq_meetings where id=p_id and founder_id=v_uid;
  if m.paused or m.connection<>'connected' or m.status<>'active' then return; end if;
  if not (p_agent=any(m.participants)) or not hq_private.meeting_agent_conversation_available(p_agent)
    then raise exception 'HQ_MEETING_CONVERSATION_UNAVAILABLE' using errcode='55000'; end if;
  if (select count(*) from public.hq_meeting_contributions where meeting_id=p_id)>=128
    then raise exception 'HQ_MEETING_CONTRIBUTION_CAPACITY' using errcode='54000'; end if;
  v_key:=pg_catalog.substr(hq_private.meeting_digest(pg_catalog.jsonb_build_array('hq-meeting-response-v1',p_id,p_request,p_agent,m.generation)),1,32)::uuid;
  v_context:=hq_private.meeting_contribution_context(p_id,p_event,p_agent,p_text);
  v_prompt:=v_context::text;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if not hq_private.meeting_agent_conversation_available(p_agent) then raise exception 'HQ_MEETING_CONVERSATION_UNAVAILABLE' using errcode='55000'; end if;
  v_binding:=hq_private.meeting_agent_binding_digest(p_agent);
  if p_agent='AG-CEO-001' then
    perform hq_private.send_ceo_message(v_prompt,v_key);
  else
    -- The same founder conversation/job queue and caps, under its existing
    -- lock. The actual head remains the job/message actor; no CEO impersonation
    -- or business task is created for ordinary conversation.
    if (select count(*) from public.hq_agent_jobs where founder_user_id=v_uid and status='queued')>=40
      or (select count(*) from public.hq_agent_jobs where founder_user_id=v_uid and agent_id=p_agent and kind='conversation-intake'
        and created_at>pg_catalog.clock_timestamp()-interval '1 hour')>=60 then raise exception 'HQ_MESSAGE_QUEUE_LIMIT' using errcode='PT429'; end if;
    insert into public.hq_agent_conversations(founder_user_id) values(v_uid) on conflict(founder_user_id)
      do update set updated_at=pg_catalog.clock_timestamp() returning id into v_conversation;
    if (select count(*) from public.hq_agent_messages where conversation_id=v_conversation)>=10000
      or (select coalesce(sum(pg_catalog.octet_length(text)),0) from public.hq_agent_messages where conversation_id=v_conversation)>33522432
      or (select coalesce(sum(pg_catalog.octet_length(result_text)),0) from public.hq_agent_jobs where founder_user_id=v_uid)>33522432
      then raise exception 'HQ_HISTORY_CAPACITY' using errcode='PT409'; end if;
    insert into public.hq_agent_messages(conversation_id,role,agent_id,text) values(v_conversation,'founder',p_agent,v_prompt) returning id into v_message;
    insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind)
      values(v_conversation,v_message,v_uid,p_agent,v_key,'conversation-intake');
    perform hq_private.workforce_wake();
  end if;
  select * into strict v_job from public.hq_agent_jobs where founder_user_id=v_uid and request_key=v_key and agent_id=p_agent and kind='conversation-intake';
  insert into public.hq_meeting_contributions(meeting_id,generation,agent_id,binding_digest,source_event_id,source_kind,request_key,job_id,founder_message_id,status)
    values(p_id,m.generation,p_agent,v_binding,p_event,case when p_agent='AG-CEO-001' then 'ceo-chat' else 'head-chat' end,v_key,v_job.id,v_job.founder_message_id,'thinking');
  update public.hq_meetings set floor=p_agent where id=p_id;
end $$;

create function hq_private.meeting_sync(p_id uuid) returns void
language plpgsql set search_path='' as $$
declare m public.hq_meetings; c public.hq_meeting_contributions; j public.hq_agent_jobs; t public.hq_business_tasks;
  v_message public.hq_agent_messages; a public.hq_task_artifacts; v_hash text; v_changed boolean:=false;
begin
  select * into strict m from public.hq_meetings where id=p_id;
  for c in select * from public.hq_meeting_contributions where meeting_id=p_id and status in ('thinking','speaking') order by created_at,id for update loop
    if c.generation<>m.generation or m.status<>'active' or m.connection<>'connected' or m.paused then
      update public.hq_meeting_contributions set status='interrupted',completed_at=pg_catalog.clock_timestamp() where id=c.id;
      v_changed:=true;
      continue;
    end if;
    if c.status='speaking' then continue; end if;
    if c.source_kind in ('ceo-chat','head-chat') then
      select * into j from public.hq_agent_jobs where id=c.job_id and founder_user_id=m.founder_id;
      if j.status='blocked' then
        update public.hq_meeting_contributions set status=case when j.error='meeting-protocol-required' then 'blocked' else 'failed' end,error=coalesce(j.error,'worker-unavailable'),completed_at=pg_catalog.clock_timestamp() where id=c.id;
        update public.hq_meetings set floor=null where id=p_id; v_changed:=true;
      elsif j.status='completed' then
        select * into v_message from public.hq_agent_messages x where x.job_id=c.job_id and x.reply_to=c.founder_message_id
          and x.conversation_id=j.conversation_id and x.role='assistant' and x.agent_id=c.agent_id and x.kind='message';
        if found and pg_catalog.char_length(v_message.text) between 1 and 4000 then
          update public.hq_meeting_contributions set status='speaking',response_message_id=v_message.id,response_text=v_message.text,
            response_digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_message.text,'UTF8')),'hex') where id=c.id;
          v_changed:=true;
        else
          update public.hq_meeting_contributions set status='failed',error='correlated-output-unavailable',completed_at=pg_catalog.clock_timestamp() where id=c.id;
          update public.hq_meetings set floor=null where id=p_id; v_changed:=true;
        end if;
      end if;
    else
      select * into t from public.hq_business_tasks where id=c.business_task_id and founder_user_id=m.founder_id;
      if t.status in ('blocked','canceled') then
        update public.hq_meeting_contributions set status='failed',error=coalesce(t.error,'task-unavailable'),completed_at=pg_catalog.clock_timestamp() where id=c.id;
        update public.hq_meetings set floor=null where id=p_id; v_changed:=true;
      elsif t.status='completed' then
        select x.* into a from public.hq_task_artifacts x join public.hq_agent_jobs job on job.id=x.job_id and job.task_id=t.id and job.status='completed'
          where x.task_id=t.id and x.agent_id=c.agent_id and x.kind='task-work' and x.text=t.deliverable
          and x.digest=pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(x.text,'UTF8')),'hex') order by x.created_at desc,x.id desc limit 1;
        if found and pg_catalog.char_length(a.text) between 1 and 4000 then
          update public.hq_meeting_contributions set status='speaking',response_artifact_id=a.id,response_text=a.text,response_digest=a.digest where id=c.id;
          v_changed:=true;
        else
          update public.hq_meeting_contributions set status='failed',error='correlated-output-unavailable',completed_at=pg_catalog.clock_timestamp() where id=c.id;
          update public.hq_meetings set floor=null where id=p_id; v_changed:=true;
        end if;
      end if;
    end if;
    if v_changed then insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload)
      select p_id,'contribution-state',c.agent_id,pg_catalog.jsonb_build_object('contributionId',id,'generation',generation,'status',status,
        'responseMessageId',response_message_id,'responseArtifactId',response_artifact_id,'responseDigest',response_digest,'error',error)
      from public.hq_meeting_contributions where id=c.id; end if;
  end loop;
  select hq_private.meeting_digest(coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_array(taskrow.id,taskrow.status,taskrow.updated_at,taskrow.deliverable,taskrow.review_summary,taskrow.error) order by taskrow.id),'[]'::jsonb))
    into v_hash from public.hq_meeting_task_links l join public.hq_business_tasks taskrow on taskrow.id=l.business_task_id where l.meeting_id=p_id;
  if v_changed or m.projection_digest is distinct from v_hash then
    update public.hq_meetings set revision=revision+1,projection_digest=v_hash where id=p_id;
    perform hq_private.live_emit('agents');
  end if;
end $$;

create function hq_private.meeting_roster() returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  return pg_catalog.jsonb_build_object('participants',coalesce((select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',r.id,'name',pg_catalog.left(r.name,160),'role',pg_catalog.left(r.role,200),'supervisorId',r.manager_id,
    'conversationAvailable',hq_private.meeting_agent_conversation_available(r.id),'workQualified',hq_private.meeting_agent_qualified(r.id),
    'qualified',hq_private.meeting_agent_qualified(r.id),'allowedTools',case when hq_private.meeting_agent_qualified(r.id) then '["read-approved-sources"]'::jsonb else '[]'::jsonb end,
    'registryReference','hq-agent-roster:'||hq_private.meeting_agent_binding_digest(r.id)) order by r.id)
    from (select * from hq_private.agent_roster where enabled order by id limit 32) r),'[]'::jsonb),'observedAt',pg_catalog.clock_timestamp());
end $$;

create function hq_private.meeting_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_id uuid:=p_id;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if v_id is null then
    select id into v_id from public.hq_meetings where founder_id=v_uid order by created_at desc,id desc limit 1;
    if v_id is null then return null; end if;
  end if;
  perform 1 from public.hq_meetings where id=v_id and founder_id=v_uid for no key update;
  if not found then raise exception 'HQ_MEETING_NOT_FOUND' using errcode='P0002'; end if;
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  perform hq_private.meeting_sync(v_id);
  return hq_private.meeting_payload(v_id);
end $$;

create function hq_private.meeting_command(p_id uuid,p_command jsonb,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.founder_uid(); v_meeting public.hq_meetings; v_kind text; v_previous hq_private.meeting_requests;
  v_plan public.hq_meeting_plan_versions; v_plan_id uuid; v_version integer; v_document jsonb; v_decision text;
  v_item record; v_task_id uuid; v_text text; v_event bigint; v_event_created boolean:=false; v_contribution public.hq_meeting_contributions; v_normal text; v_agent text; v_addressees text[];
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object'
    or pg_catalog.octet_length(p_command::text)>32768 then raise exception 'HQ_MEETING_INVALID_COMMAND' using errcode='22023'; end if;
  -- Serialize commands without conflicting with foreign-key KEY SHARE locks.
  -- Existing task helpers own their queue advisory lock and worker fencing.
  select * into v_meeting from public.hq_meetings where id=p_id and founder_id=v_uid for no key update;
  if not found then raise exception 'HQ_MEETING_NOT_FOUND' using errcode='P0002'; end if;
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  -- Serialize all request keys by founder as well as this meeting's row lock.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,9821));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into v_previous from hq_private.meeting_requests where founder_id=v_uid and request_key=p_request_key;
  if found then
    if v_previous.meeting_id<>p_id or v_previous.command<>p_command then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.meeting_payload(p_id);
  end if;
  v_kind := p_command->>'type';
  if v_kind is null or v_kind not in ('text','chat','language','interrupt','pause','continue','proposePlan','submitPlan','decidePlan','end','disconnect','reconnect','cancelTask','report','research','sync','invite','speechEnded','playback-ended')
    then raise exception 'HQ_MEETING_UNKNOWN_COMMAND' using errcode='22023'; end if;
  if v_meeting.status='ended' and v_kind not in ('cancelTask','report') then raise exception 'HQ_MEETING_ENDED' using errcode='PT409'; end if;
  if v_kind in ('text','chat') then
    perform hq_private.require_shape(p_command,array['type','text'],array['type','text','addressedTo','uncertain']);
    v_text := hq_private.required_text(p_command->'text',4000);
    if p_command ? 'uncertain' and pg_catalog.jsonb_typeof(p_command->'uncertain') is distinct from 'boolean' then raise exception 'HQ_MEETING_INVALID_COMMAND' using errcode='22023'; end if;
    if p_command ? 'addressedTo' and not (p_command->>'addressedTo'=any(v_meeting.participants))
      then raise exception 'HQ_MEETING_UNKNOWN_PARTICIPANT' using errcode='22023'; end if;
    if v_kind='text' then
      perform hq_private.meeting_invalidate_contributions(p_id);
      update public.hq_meetings set floor='founder',generation=generation+1 where id=p_id;
      insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,v_kind,v_uid::text,p_command) returning id into v_event;
      v_event_created:=true;
      if p_command->'uncertain' is distinct from 'true'::jsonb then
        v_normal:=pg_catalog.btrim(pg_catalog.lower(pg_catalog.regexp_replace(v_text,'[[:punct:][:space:]]+',' ','g')));
        if v_normal in ('stop','pause','everyone pause','everyone stop','توقف','توقفوا','قف','الجميع توقف','الكل يقف','اسكت','اسكتوا') then
          update public.hq_meetings set paused=true where id=p_id;
        else
          if v_normal in ('continue','resume','استمر','اكمل','أكمل','كمل') then update public.hq_meetings set paused=false where id=p_id; end if;
          v_addressees:=hq_private.meeting_text_addressees(p_id,v_text);
          v_agent:=coalesce(p_command->>'addressedTo',case when pg_catalog.cardinality(v_addressees)=1 then v_addressees[1] else 'AG-CEO-001' end);
          perform hq_private.meeting_request_contribution(p_id,v_event,v_agent,v_text,p_request_key);
        end if;
      end if;
    end if;
    -- Text is evidence, never interpreted here as plan approval or cancellation.
  elsif v_kind='language' then
    perform hq_private.require_shape(p_command,array['type','language'],array['type','language']);
    if p_command->>'language' not in ('ar','en') then raise exception 'HQ_MEETING_LANGUAGE' using errcode='22023'; end if;
    perform hq_private.meeting_invalidate_contributions(p_id);
    update public.hq_meetings set language=p_command->>'language',generation=generation+1,floor='founder' where id=p_id;
  elsif v_kind in ('interrupt','pause','continue','end','disconnect','reconnect') then
    perform hq_private.require_shape(p_command,array['type'],array['type']);
    if v_kind in ('interrupt','pause','end','disconnect') then perform hq_private.meeting_invalidate_contributions(p_id); end if;
    if v_kind='interrupt' then update public.hq_meetings set floor='founder',generation=generation+1 where id=p_id;
    elsif v_kind='pause' then update public.hq_meetings set paused=true,floor='founder',generation=generation+1 where id=p_id;
    elsif v_kind='continue' then update public.hq_meetings m set paused=false,
      floor=(select c.agent_id from public.hq_meeting_contributions c where c.meeting_id=m.id and c.generation=m.generation and c.status in ('thinking','speaking')) where m.id=p_id;
    elsif v_kind='disconnect' then update public.hq_meetings set connection='disconnected',generation=generation+1,floor=null where id=p_id;
    elsif v_kind='reconnect' then update public.hq_meetings set connection='connected' where id=p_id;
    else
      update public.hq_meetings set status='ended',connection='ended',ended_at=pg_catalog.clock_timestamp(),generation=generation+1,floor=null where id=p_id;
      for v_item in select plan_id,version from public.hq_meeting_plan_versions where meeting_id=p_id and status='approved' and start_policy='meeting-end' loop
        perform hq_private.meeting_dispatch(p_id,v_item.plan_id,v_item.version);
      end loop;
    end if;
  elsif v_kind='sync' then
    perform hq_private.require_shape(p_command,array['type'],array['type']);
    perform hq_private.meeting_sync(p_id);
  elsif v_kind in ('speechEnded','playback-ended') then
    if v_kind='speechEnded' then
      perform hq_private.require_shape(p_command,array['type','contributionId','generation'],array['type','contributionId','generation']);
      v_task_id:=hq_private.required_uuid(p_command->'contributionId');
    else
      perform hq_private.require_shape(p_command,array['type','turnId','generation'],array['type','turnId','generation']);
      v_task_id:=hq_private.required_uuid(p_command->'turnId');
    end if;
    select * into v_contribution from public.hq_meeting_contributions where id=v_task_id and meeting_id=p_id and status='speaking'
      and generation=v_meeting.generation and generation::text=p_command->>'generation' for update;
    if not found then raise exception 'HQ_MEETING_STALE_CONTRIBUTION' using errcode='PT409'; end if;
    update public.hq_meeting_contributions set status='completed',completed_at=pg_catalog.clock_timestamp() where id=v_contribution.id;
    if v_contribution.source_kind='finding' then
      update public.hq_meeting_task_links set reported_at=pg_catalog.clock_timestamp() where business_task_id=v_contribution.business_task_id and reported_at is null;
    end if;
    update public.hq_meetings set floor=null where id=p_id;
  elsif v_kind='invite' then
    perform hq_private.require_shape(p_command,array['type','agentId'],array['type','agentId']);
    v_text:=hq_private.required_text(p_command->'agentId',40);
    if not hq_private.meeting_agent_qualified(v_text) then raise exception 'HQ_MEETING_AGENT_UNQUALIFIED' using errcode='55000'; end if;
    if not (v_text=any(v_meeting.participants)) then raise exception 'HQ_MEETING_UNKNOWN_PARTICIPANT' using errcode='22023'; end if;
    select l.business_task_id into v_task_id from public.hq_meeting_task_links l join public.hq_business_tasks t on t.id=l.business_task_id
      where l.meeting_id=p_id and l.task_kind in ('execution','research') and l.instruction->>'ownerId'=v_text and l.reported_at is null
        and t.founder_user_id=v_uid and t.status='completed' order by t.completed_at,t.id limit 1;
    if not found then raise exception 'HQ_MEETING_FINDING_UNAVAILABLE' using errcode='PT409'; end if;
    perform hq_private.meeting_invalidate_contributions(p_id);
    update public.hq_meetings set generation=generation+1,floor=v_text,paused=false where id=p_id;
    insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,'invite',v_uid::text,p_command) returning id into v_event;
    v_event_created:=true;
    insert into public.hq_meeting_contributions(meeting_id,generation,agent_id,binding_digest,source_event_id,source_kind,request_key,business_task_id,founder_message_id,status)
      select p_id,m.generation,v_text,hq_private.meeting_agent_binding_digest(v_text),v_event,'finding',p_request_key,t.id,t.founder_message_id,'thinking'
      from public.hq_meetings m join public.hq_business_tasks t on t.id=v_task_id where m.id=p_id;
    perform hq_private.meeting_sync(p_id);
  elsif v_kind='proposePlan' then
    perform hq_private.require_shape(p_command,array['type','planId','document'],array['type','planId','document']);
    v_plan_id := hq_private.required_uuid(p_command->'planId');
    v_document := hq_private.meeting_normalize_plan(p_command->'document');
    select * into v_plan from public.hq_meeting_plan_versions where meeting_id=p_id and plan_id=v_plan_id order by version desc limit 1 for update;
    if found then
      if v_plan.status='dispatched' then raise exception 'HQ_MEETING_PLAN_DISPATCHED' using errcode='PT409'; end if;
      update public.hq_meeting_plan_versions set status='revised' where meeting_id=p_id and plan_id=v_plan_id and version=v_plan.version;
      v_version := v_plan.version+1;
    else v_version := 1; end if;
    if v_version>32 or (select pg_catalog.count(*) from public.hq_meeting_plan_versions where meeting_id=p_id)>=64
      then raise exception 'HQ_MEETING_PLAN_CAPACITY' using errcode='54000'; end if;
    insert into public.hq_meeting_plan_versions(meeting_id,plan_id,version,document,digest,status)
      values(p_id,v_plan_id,v_version,v_document,hq_private.meeting_digest(v_document),'draft');
  elsif v_kind in ('submitPlan','decidePlan') then
    if v_kind='submitPlan' then
      perform hq_private.require_shape(p_command,array['type','planId','version','digest'],array['type','planId','version','digest']);
    else
      perform hq_private.require_shape(p_command,array['type','planId','version','digest','decision','start','source','confirmed'],array['type','planId','version','digest','decision','start','source','confirmed']);
    end if;
    v_plan_id := hq_private.required_uuid(p_command->'planId');
    select * into v_plan from public.hq_meeting_plan_versions where meeting_id=p_id and plan_id=v_plan_id order by version desc limit 1 for update;
    if not found or v_plan.version::text is distinct from p_command->>'version' or v_plan.digest is distinct from p_command->>'digest'
      then raise exception 'HQ_MEETING_PLAN_VERSION_CHANGED' using errcode='PT409'; end if;
    if v_kind='submitPlan' then
      if v_plan.status<>'draft' then raise exception 'HQ_MEETING_PLAN_STATE' using errcode='PT409'; end if;
      update public.hq_meeting_plan_versions set status='awaiting-approval' where meeting_id=p_id and plan_id=v_plan_id and version=v_plan.version;
    else
      if p_command->>'source' is distinct from 'control' or p_command->'confirmed' is distinct from 'true'::jsonb
        or p_command->>'start' is null or p_command->>'start' not in ('now','meeting-end','manual')
        or p_command->>'decision' is null or p_command->>'decision' not in ('approved','deferred','discarded')
        then raise exception 'HQ_MEETING_EXPLICIT_DECISION_REQUIRED' using errcode='22023'; end if;
      if v_plan.status not in ('draft','awaiting-approval','approved','deferred','blocked')
        or p_command->>'decision'='approved' and v_plan.status<>'awaiting-approval'
        then raise exception 'HQ_MEETING_PLAN_STATE' using errcode='PT409'; end if;
      v_decision := p_command->>'decision';
      update public.hq_meeting_plan_versions set status=v_decision,
        start_policy=case when v_decision='approved' then p_command->>'start' else null end,
        approved_by=case when v_decision='approved' then v_uid else null end,
        approved_session=case when v_decision='approved' then (auth.jwt()->>'session_id')::uuid else null end,
        approved_at=case when v_decision='approved' then pg_catalog.clock_timestamp() else null end
        where meeting_id=p_id and plan_id=v_plan_id and version=v_plan.version;
      if v_decision='approved' then
        if not hq_private.meeting_dispatch_supported(v_plan.document) then
          update public.hq_meeting_plan_versions set status='blocked' where meeting_id=p_id and plan_id=v_plan_id and version=v_plan.version;
          insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,'plan-dispatch-blocked',v_uid::text,
            pg_catalog.jsonb_build_object('planId',v_plan_id,'version',v_plan.version,'digest',v_plan.digest,'error','HQ_MEETING_SCOPE_UNSUPPORTED'));
        elsif p_command->>'start'='now' then perform hq_private.meeting_dispatch(p_id,v_plan_id,v_plan.version); end if;
      end if;
    end if;
  elsif v_kind='research' then
    perform hq_private.require_shape(p_command,array['type','task'],array['type','task']);
    v_document:=hq_private.meeting_normalize_plan(pg_catalog.jsonb_build_object('title','Founder research assignment','tasks',pg_catalog.jsonb_build_array(p_command->'task')));
    if not hq_private.meeting_dispatch_supported(v_document) then
      insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,'research-dispatch-blocked',v_uid::text,
        pg_catalog.jsonb_build_object('task',p_command->'task','error','HQ_MEETING_SCOPE_UNSUPPORTED'));
    else
      v_task_id:=hq_private.meeting_enqueue(p_id,null,null,p_command->'task',
        pg_catalog.substr(hq_private.meeting_digest(pg_catalog.jsonb_build_array('hq-meeting-research-v1',p_id,p_request_key)),1,32)::uuid);
    end if;
  elsif v_kind='cancelTask' then
    perform hq_private.require_shape(p_command,array['type','taskId'],array['type','taskId']);
    v_task_id:=hq_private.required_uuid(p_command->'taskId');
    if not exists(select 1 from public.hq_meeting_task_links l join public.hq_business_tasks t on t.id=l.business_task_id
      where l.meeting_id=p_id and t.id=v_task_id and t.founder_user_id=v_uid and t.status in ('queued','working','review'))
      then raise exception 'HQ_MEETING_TASK_NOT_CANCELLABLE' using errcode='PT409'; end if;
    perform hq_private.cancel_business_task(v_task_id);
  else
    perform hq_private.require_shape(p_command,array['type','taskId'],array['type','taskId']);
    v_task_id:=hq_private.required_uuid(p_command->'taskId');
    -- Acknowledgement only; this cannot complete work or approve a finding.
    update public.hq_meeting_task_links l set reported_at=pg_catalog.clock_timestamp()
      from public.hq_business_tasks t where t.id=l.business_task_id and l.meeting_id=p_id and t.id=v_task_id
      and t.founder_user_id=v_uid and t.status='completed' and l.reported_at is null;
    if not found then raise exception 'HQ_MEETING_FINDING_UNAVAILABLE' using errcode='PT409'; end if;
  end if;
  if (select pg_catalog.count(*) from public.hq_meeting_events where meeting_id=p_id)>=4000
    then raise exception 'HQ_MEETING_EVENT_CAPACITY' using errcode='54000'; end if;
  if not v_event_created then insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,v_kind,v_uid::text,p_command); end if;
  update public.hq_meetings set revision=revision+1 where id=p_id;
  insert into hq_private.meeting_requests(founder_id,request_key,meeting_id,command) values(v_uid,p_request_key,p_id,p_command);
  perform hq_private.live_emit('agents');
  return hq_private.meeting_payload(p_id);
end;
$$;

-- Meeting chat is a response request, never an authorization for the intake
-- model to manufacture business work. Preserve genuine failure receipts and
-- the native evidence/lease delegate instead of editing a reply into success.
alter function hq_private.worker_finish(uuid,uuid,uuid,text,text) rename to worker_finish_before_meetings;
create function hq_private.worker_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; v_body jsonb;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if not found or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token
    then raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  if p_error is null and j.kind='conversation-intake' and pg_catalog.octet_length(p_reply)<=32000
    and exists(select 1 from public.hq_meeting_contributions c where c.job_id=j.id and c.source_kind in ('ceo-chat','head-chat')) then
    begin v_body:=p_reply::jsonb; exception when invalid_text_representation then v_body:=null; end;
    if v_body ? 'task' and v_body->'task' is distinct from 'null'::jsonb then
      return hq_private.worker_finish_before_meetings(p_job_id,p_lease_token,p_worker_id,'','meeting-response-only');
    end if;
  end if;
  return hq_private.worker_finish_before_meetings(p_job_id,p_lease_token,p_worker_id,p_reply,p_error);
end $$;
create or replace function public.hq_worker_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish(p_job_id,p_lease_token,p_worker_id,p_reply,p_error); $$;
revoke all on function hq_private.worker_finish_before_meetings(uuid,uuid,uuid,text,text),hq_private.worker_finish(uuid,uuid,uuid,text,text),public.hq_worker_finish(uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_finish(uuid,uuid,uuid,text,text),public.hq_worker_finish(uuid,uuid,uuid,text,text) to authenticated;

-- Reparse the unchanged native evidence delegate against the guarded finish.
create or replace function hq_private.worker_finish_v2(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare j public.hq_agent_jobs; artifact public.hq_task_artifacts; existing hq_private.native_tool_receipts; v_result jsonb; v_digest text; begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform hq_private.validate_tool_evidence(p_evidence);
  perform pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into j from public.hq_agent_jobs where id=p_job_id for update;
  if not found or j.worker_id is distinct from p_worker_id or j.lease_token is distinct from p_lease_token then raise exception 'HQ_LEASE_LOST' using errcode='42501'; end if;
  if jsonb_array_length(p_evidence)>0 and (j.kind<>'task-work' or j.agent_id not in ('AG-RES-001','AG-HR-002') or p_error is not null) then
    raise exception 'HQ_TOOL_NOT_ALLOWED' using errcode='42501'; end if;
  v_digest:=encode(extensions.digest(p_evidence::text,'sha256'),'hex');
  select * into existing from hq_private.native_tool_receipts where job_id=j.id;
  if found and existing.evidence_digest<>v_digest then raise exception 'HQ_TOOL_EVIDENCE_ALREADY_COMMITTED' using errcode='PT409'; end if;
  if j.result_digest is not null and existing.job_id is null and jsonb_array_length(p_evidence)>0 then
    raise exception 'HQ_TOOL_EVIDENCE_NOT_RECORDED' using errcode='PT409'; end if;
  v_result:=hq_private.worker_finish(p_job_id,p_lease_token,p_worker_id,p_reply,p_error);
  if p_error is null and coalesce((v_result->>'discarded')::boolean,false)=false and (j.result_digest is null or existing.job_id is not null) and j.kind='task-work' and j.agent_id in ('AG-RES-001','AG-HR-002') then
    select * into artifact from public.hq_task_artifacts where job_id=j.id;
    if not found or artifact.digest<>encode(extensions.digest(p_reply,'sha256'),'hex') then raise exception 'HQ_TOOL_ARTIFACT_MISMATCH' using errcode='22023'; end if;
    insert into hq_private.native_tool_receipts(job_id,artifact_id,worker_id,artifact_digest,evidence,evidence_digest)
      values(j.id,artifact.id,p_worker_id,artifact.digest,p_evidence,v_digest) on conflict(job_id) do nothing;
  end if;
  return v_result;
end $$;
create or replace function public.hq_worker_finish_v2(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish_v2(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence); $$;
revoke all on function hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb),public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb),public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb) to authenticated;


-- Keep the established technical worker and queue. Gate only meeting-linked
-- queued stages under its existing queue lock, then delegate to the unchanged
-- current claim implementation. Stale qualification becomes a terminal blocked
-- record, allowing unrelated work to drain without an error/reconnect loop.
alter function hq_private.worker_claim(uuid,integer) rename to worker_claim_before_meetings;
create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer; v_result jsonb; v_contribution public.hq_meeting_contributions;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null
    then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_meeting_protocol is null or p_meeting_protocol not in (0,1) then raise exception 'HQ_MEETING_PROTOCOL_UNSUPPORTED' using errcode='22023'; end if;
  if p_lease_seconds is distinct from 300 then raise exception 'HQ_INVALID_LEASE' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  update public.hq_agent_jobs j set status='blocked',error='meeting-binding-stale',completed_at=pg_catalog.clock_timestamp()
    from public.hq_meeting_contributions c join public.hq_meetings m on m.id=c.meeting_id
    where c.job_id=j.id and c.source_kind in ('ceo-chat','head-chat') and j.status='queued'
      and (j.agent_id is distinct from c.agent_id or j.request_key is distinct from c.request_key or j.founder_message_id is distinct from c.founder_message_id or j.founder_user_id is distinct from m.founder_id
        or not hq_private.meeting_agent_conversation_available(c.agent_id) or c.binding_digest is distinct from hq_private.meeting_agent_binding_digest(c.agent_id) or c.generation<>m.generation or c.status<>'thinking' or m.status<>'active' or m.connection<>'connected' or m.paused);
  -- Old hosts cannot accept an actual non-CEO intake actor. Record the
  -- unsupported response without starving unrelated work or invoking a tool.
  if p_meeting_protocol=0 then
    update public.hq_agent_jobs j set status='blocked',error='meeting-protocol-required',completed_at=pg_catalog.clock_timestamp()
      from public.hq_meeting_contributions c where c.job_id=j.id and c.source_kind='head-chat' and j.status='queued';
  end if;
  with blocked as (
    update public.hq_agent_jobs j set status='blocked',error='meeting-qualification-stale',completed_at=pg_catalog.clock_timestamp()
    from public.hq_meeting_task_links l where j.task_id=l.business_task_id and j.status='queued' and (
      not hq_private.meeting_agent_qualified(j.agent_id)
      or not hq_private.meeting_agent_qualified(l.instruction->>'ownerId')
      or not hq_private.meeting_agent_qualified(l.instruction->>'supervisorId')
      or not hq_private.meeting_agent_qualified('AG-CEO-001')
      or not exists(select 1 from hq_private.agent_roster r where r.id=l.instruction->>'ownerId' and r.manager_id=l.instruction->>'supervisorId')
      or j.agent_id is distinct from case j.kind
        when 'task-route' then 'AG-CEO-001'
        when 'task-ack' then l.instruction->>'ownerId'
        when 'task-start' then l.instruction->>'ownerId'
        when 'task-work' then l.instruction->>'ownerId'
        when 'head-review' then l.instruction->>'supervisorId'
        when 'ceo-review' then 'AG-CEO-001'
        when 'task-report' then l.instruction->>'ownerId'
        when 'lesson-extract' then 'AG-HR-001'
        when 'lesson-review' then 'AG-CEO-001' else null end)
    returning j.task_id,j.kind
  ) update public.hq_business_tasks t set status='blocked',error='meeting-qualification-stale',
      completed_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    where t.status in ('queued','working','review') and exists(select 1 from blocked b where b.task_id=t.id and b.kind not in ('lesson-extract','lesson-review'));
  get diagnostics v_count=row_count;
  if v_count>0 then perform hq_private.live_emit('agents'); end if;
  v_result:=hq_private.worker_claim_before_meetings(p_worker_id,p_lease_seconds);
  if exists(select 1 from public.hq_agent_jobs j where j.id=(v_result->'job'->>'id')::uuid and (
    exists(select 1 from public.hq_meeting_contributions c where c.job_id=j.id and c.source_kind in ('ceo-chat','head-chat'))
    or exists(select 1 from public.hq_meeting_task_links l where l.business_task_id=j.task_id and l.task_kind='contribution'))) then
    -- The scoped prompt/brief already contains exact meeting data. Global chat
    -- history must not inject another meeting's text or arbitrary link choices.
    v_result:=pg_catalog.jsonb_set(v_result,'{job,context,messages}','[]'::jsonb);
    if p_meeting_protocol=1 then
      select * into v_contribution from public.hq_meeting_contributions c where c.job_id=(v_result->'job'->>'id')::uuid and c.source_kind in ('ceo-chat','head-chat');
      if found then v_result:=pg_catalog.jsonb_set(v_result,'{job,context,meetingResponse}',pg_catalog.jsonb_build_object(
        'protocol',1,'scope','conversation-only','meetingId',v_contribution.meeting_id,'contributionId',v_contribution.id,
        'generation',v_contribution.generation,'agentId',v_contribution.agent_id,'bindingDigest',v_contribution.binding_digest)); end if;
    end if;
  end if;
  return v_result;
end $$;
-- Explicit overloads preserve old hosts and negotiate the narrow new actor
-- contract on every claim. A persistent readiness flag cannot fence an old host.
create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_claim(p_worker_id,p_lease_seconds,0); $$;
create or replace function public.hq_worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_claim(p_worker_id,p_lease_seconds,0); $$;
create function public.hq_worker_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_claim(p_worker_id,p_lease_seconds,p_meeting_protocol); $$;
revoke all on function hq_private.worker_claim_before_meetings(uuid,integer),hq_private.worker_claim(uuid,integer),hq_private.worker_claim(uuid,integer,integer),
  public.hq_worker_claim(uuid,integer),public.hq_worker_claim(uuid,integer,integer) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_claim(uuid,integer),hq_private.worker_claim(uuid,integer,integer),public.hq_worker_claim(uuid,integer),public.hq_worker_claim(uuid,integer,integer) to authenticated;

create function public.hq_meeting_create(p_id uuid,p_title text,p_language text,p_participants text[],p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_create(p_id,p_title,p_language,p_participants,p_request_key); $$;
create function public.hq_meeting_snapshot(p_meeting_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_snapshot(p_meeting_id); $$;
create function public.hq_meeting_command(p_meeting_id uuid,p_command jsonb,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_command(p_meeting_id,p_command,p_request_key); $$;
revoke all on function hq_private.guard_meeting_plan_version(),hq_private.guard_meeting_task_link(),hq_private.guard_meeting_task_owner(),hq_private.meeting_digest(jsonb),
  hq_private.meeting_agent_binding_digest(text),hq_private.meeting_agent_conversation_available(text),hq_private.meeting_agent_qualified(text),hq_private.meeting_review_body(text),hq_private.meeting_normalize_plan(jsonb),
  hq_private.meeting_dispatch_supported(jsonb),hq_private.meeting_payload(uuid),hq_private.meeting_snapshot(uuid),
  hq_private.meeting_create(uuid,text,text,text[],uuid),hq_private.meeting_enqueue(uuid,uuid,integer,jsonb,uuid,text),
  hq_private.meeting_dispatch(uuid,uuid,integer),hq_private.meeting_roster(),hq_private.meeting_sync(uuid),
  hq_private.meeting_text_addressees(uuid,text),hq_private.meeting_contribution_context(uuid,bigint,text,text),hq_private.meeting_request_contribution(uuid,bigint,text,text,uuid),hq_private.meeting_invalidate_contributions(uuid),hq_private.meeting_command(uuid,jsonb,uuid),
  public.hq_meeting_create(uuid,text,text,text[],uuid),public.hq_meeting_snapshot(uuid),public.hq_meeting_command(uuid,jsonb,uuid)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.meeting_create(uuid,text,text,text[],uuid),hq_private.meeting_snapshot(uuid),hq_private.meeting_command(uuid,jsonb,uuid),
  public.hq_meeting_create(uuid,text,text,text[],uuid),public.hq_meeting_snapshot(uuid),public.hq_meeting_command(uuid,jsonb,uuid) to authenticated;

create function public.hq_meeting_roster() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_roster(); $$;
revoke all on function public.hq_meeting_roster() from public,anon,authenticated,service_role;
grant execute on function hq_private.meeting_roster(),public.hq_meeting_roster() to authenticated;

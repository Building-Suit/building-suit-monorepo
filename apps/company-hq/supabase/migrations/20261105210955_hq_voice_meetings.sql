-- Prepared meeting persistence. Applying this file does not qualify a provider,
-- activate an employee, enable an executor, or deploy an unattended service.
-- Reuses the current HQ founder/session boundary; staffing plans remain separate.

create table hq_private.meeting_runtime (
  singleton boolean primary key default true check (singleton),
  executor_enabled boolean not null default false,
  qualification_reference text,
  check (not executor_enabled or (qualification_reference is not null and pg_catalog.length(pg_catalog.btrim(qualification_reference)) between 1 and 2000))
);
insert into hq_private.meeting_runtime(singleton) values(true);

-- Explicit operator projection of the canonical registry, with separately
-- evidenced execution qualification. No employee or qualification is seeded.
create table hq_private.meeting_agent_bindings (
  agent_id text primary key check (agent_id ~ '^AG-[A-Z]+-[0-9]{3}$'),
  display_name text not null check (pg_catalog.length(display_name) between 1 and 120),
  supervisor_id text,
  registry_reference text not null check (pg_catalog.length(registry_reference) between 1 and 2000),
  execution_qualified boolean not null default false,
  qualification_reference text,
  check (not execution_qualified or (qualification_reference is not null and pg_catalog.length(pg_catalog.btrim(qualification_reference)) between 1 and 2000))
);

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
  status text not null check (status in ('draft','awaiting-approval','approved','dispatched','revised','deferred','discarded')),
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

create table public.hq_meeting_tasks (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  meeting_id uuid not null references public.hq_meetings(id),
  plan_id uuid not null,
  plan_version integer not null,
  task_key text not null,
  owner_id text not null,
  supervisor_id text not null,
  instruction jsonb not null,
  status text not null default 'queued' check (status in ('queued','running','completed','failed','cancelled')),
  attempt integer not null default 0 check (attempt between 0 and 3),
  generation bigint not null default 0,
  lease_token uuid,
  lease_expires_at timestamptz,
  heartbeat_at timestamptz,
  deadline timestamptz not null,
  result jsonb,
  hand_raised boolean not null default false,
  reviewed_by text,
  review_receipt jsonb,
  review_status text check (review_status in ('accepted','rejected')),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp(),
  foreign key(meeting_id,plan_id,plan_version) references public.hq_meeting_plan_versions(meeting_id,plan_id,version),
  unique(meeting_id,plan_id,plan_version,task_key),
  check (reviewed_by is null or reviewed_by <> owner_id),
  check ((reviewed_by is null) = (review_receipt is null))
);
create index hq_meeting_tasks_ready on public.hq_meeting_tasks(created_at) where status = 'queued';
create index hq_meeting_tasks_expired on public.hq_meeting_tasks(lease_expires_at) where status = 'running';

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
alter table public.hq_meeting_tasks enable row level security;
alter table hq_private.meeting_runtime enable row level security;
alter table hq_private.meeting_agent_bindings enable row level security;
alter table hq_private.meeting_requests enable row level security;
revoke all on public.hq_meetings,public.hq_meeting_events,public.hq_meeting_plan_versions,public.hq_meeting_tasks,
  hq_private.meeting_runtime,hq_private.meeting_agent_bindings,hq_private.meeting_requests from public,anon,authenticated,service_role;

create function hq_private.meeting_digest(p_document jsonb) returns text
language sql immutable strict set search_path = '' as $$
  select pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_document::text,'UTF8')),'hex');
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
      array['id','objective','ownerId','supervisorId','deliverable','inputs','dependencies','allowedActions','budget','acceptanceCriteria','requiredReview','blockers','priority','environment','timeLimitSeconds']);
    v_key := hq_private.required_text(v_task->'id',120);
    if v_key = any(v_seen) then raise exception 'HQ_MEETING_DUPLICATE_TASK' using errcode = '22023'; end if;
    v_seen := pg_catalog.array_append(v_seen,v_key);
    perform hq_private.required_text(v_task->'objective',2000);
    perform hq_private.required_text(v_task->'deliverable',2000);
    v_owner := hq_private.required_text(v_task->'ownerId',40);
    v_supervisor := hq_private.required_text(v_task->'supervisorId',40);
    if not exists(select 1 from hq_private.meeting_agent_bindings b where b.agent_id=v_owner and b.supervisor_id=v_supervisor)
      or v_owner=v_supervisor then raise exception 'HQ_MEETING_UNKNOWN_OWNER' using errcode = '22023'; end if;
    if v_task->'budget' is distinct from '0'::jsonb or v_task->>'requiredReview' is distinct from 'independent'
      or v_task->>'environment' is null or v_task->>'environment' not in ('qualified-cloud','synthetic')
      or pg_catalog.jsonb_typeof(v_task->'priority') <> 'number' or (v_task->>'priority')::numeric not between 1 and 5
      or pg_catalog.jsonb_typeof(v_task->'timeLimitSeconds') <> 'number'
      or (v_task->>'timeLimitSeconds')::numeric not between 1 and 300
      or (v_task->>'timeLimitSeconds')::numeric <> pg_catalog.trunc((v_task->>'timeLimitSeconds')::numeric)
      then raise exception 'HQ_MEETING_TASK_LIMIT' using errcode = '22023'; end if;
    if pg_catalog.jsonb_typeof(v_task->'inputs') <> 'array' or pg_catalog.jsonb_typeof(v_task->'dependencies') <> 'array'
      or pg_catalog.jsonb_typeof(v_task->'blockers') <> 'array' or pg_catalog.jsonb_typeof(v_task->'acceptanceCriteria') <> 'array'
      or pg_catalog.jsonb_array_length(v_task->'acceptanceCriteria') < 1
      or pg_catalog.jsonb_typeof(v_task->'allowedActions') <> 'array'
      or pg_catalog.jsonb_array_length(v_task->'allowedActions') <> 1
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

create function hq_private.meeting_require_evidence(p_evidence jsonb) returns void
language plpgsql set search_path='' as $$
declare v_item jsonb;
begin
  if pg_catalog.jsonb_typeof(p_evidence) is distinct from 'array'
    or pg_catalog.jsonb_array_length(p_evidence) not between 1 and 32 then
    raise exception 'HQ_MEETING_EVIDENCE_REQUIRED' using errcode='22023';
  end if;
  for v_item in select value from pg_catalog.jsonb_array_elements(p_evidence) loop
    perform hq_private.required_text(v_item,2000);
  end loop;
end;
$$;

create function hq_private.meeting_payload(p_id uuid) returns jsonb
language sql set search_path = '' as $$
  select pg_catalog.jsonb_build_object(
    'meeting',pg_catalog.to_jsonb(m),
    'events',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(e) order by e.id) from
      (select * from public.hq_meeting_events where meeting_id=p_id order by id desc limit 200) e),'[]'::jsonb),
    'plans',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(p) order by p.created_at,p.version)
      from public.hq_meeting_plan_versions p where p.meeting_id=p_id),'[]'::jsonb),
    'tasks',coalesce((select pg_catalog.jsonb_agg(pg_catalog.to_jsonb(t)-'lease_token' order by t.created_at)
      from public.hq_meeting_tasks t where t.meeting_id=p_id),'[]'::jsonb),
    'executorEnabled',(select executor_enabled from hq_private.meeting_runtime where singleton))
  from public.hq_meetings m where m.id=p_id;
$$;

create function hq_private.meeting_snapshot(p_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.founder_uid();
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if not exists(select 1 from public.hq_meetings m where m.id=p_id and m.founder_id=v_uid)
    then raise exception 'HQ_MEETING_NOT_FOUND' using errcode='P0002'; end if;
  return hq_private.meeting_payload(p_id);
end;
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
    or exists(select 1 from pg_catalog.unnest(p_participants) a where not exists(select 1 from hq_private.meeting_agent_bindings b where b.agent_id=a))
    then raise exception 'HQ_MEETING_INVALID_CREATE' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_uid::text,9821));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
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
  return hq_private.meeting_payload(p_id);
end;
$$;

-- Dispatch is transactional with the authenticated decision/end event. A
-- qualified unattended host remains an independent activation prerequisite.
create function hq_private.meeting_dispatch(p_id uuid,p_plan uuid,p_version integer) returns void
language plpgsql set search_path = '' as $$
declare v_plan public.hq_meeting_plan_versions; v_task jsonb;
begin
  select * into v_plan from public.hq_meeting_plan_versions where meeting_id=p_id and plan_id=p_plan and version=p_version for update;
  if not found or v_plan.status not in ('approved','dispatched') or v_plan.approved_by is null then return; end if;
  for v_task in select value from pg_catalog.jsonb_array_elements(v_plan.document->'tasks') loop
    insert into public.hq_meeting_tasks(meeting_id,plan_id,plan_version,task_key,owner_id,supervisor_id,instruction,deadline)
      values(p_id,p_plan,p_version,v_task->>'id',v_task->>'ownerId',v_task->>'supervisorId',v_task,
        pg_catalog.clock_timestamp()+((v_task->>'timeLimitSeconds')::integer * interval '1 second'))
      on conflict(meeting_id,plan_id,plan_version,task_key) do nothing;
  end loop;
  update public.hq_meeting_plan_versions set status='dispatched' where meeting_id=p_id and plan_id=p_plan and version=p_version;
end;
$$;

create function hq_private.meeting_command(p_id uuid,p_command jsonb,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := hq_private.founder_uid(); v_meeting public.hq_meetings; v_kind text; v_previous hq_private.meeting_requests;
  v_plan public.hq_meeting_plan_versions; v_plan_id uuid; v_version integer; v_document jsonb; v_decision text;
  v_item record; v_task_id uuid; v_text text;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or pg_catalog.jsonb_typeof(p_command) is distinct from 'object'
    or pg_catalog.octet_length(p_command::text)>32768 then raise exception 'HQ_MEETING_INVALID_COMMAND' using errcode='22023'; end if;
  -- No key is changed: NO KEY UPDATE serializes founder commands while allowing
  -- a worker's event foreign-key KEY SHARE lock, avoiding meeting→task/task→
  -- meeting deadlocks during cancellation and completion.
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
  if v_kind is null or v_kind not in ('text','chat','language','interrupt','pause','continue','proposePlan','submitPlan','decidePlan','end','disconnect','reconnect','cancelTask','report')
    then raise exception 'HQ_MEETING_UNKNOWN_COMMAND' using errcode='22023'; end if;
  if v_meeting.status='ended' and v_kind not in ('cancelTask','report') then raise exception 'HQ_MEETING_ENDED' using errcode='PT409'; end if;
  if v_kind in ('text','chat') then
    perform hq_private.require_shape(p_command,array['type','text'],array['type','text','addressedTo','uncertain']);
    v_text := hq_private.required_text(p_command->'text',4000);
    if p_command ? 'addressedTo' and not (p_command->>'addressedTo'=any(v_meeting.participants))
      then raise exception 'HQ_MEETING_UNKNOWN_PARTICIPANT' using errcode='22023'; end if;
    if v_kind='text' then update public.hq_meetings set floor='founder',generation=generation+1 where id=p_id; end if;
    -- Text is evidence, never interpreted here as plan approval or cancellation.
  elsif v_kind='language' then
    perform hq_private.require_shape(p_command,array['type','language'],array['type','language']);
    if p_command->>'language' not in ('ar','en') then raise exception 'HQ_MEETING_LANGUAGE' using errcode='22023'; end if;
    update public.hq_meetings set language=p_command->>'language',generation=generation+1,floor='founder' where id=p_id;
  elsif v_kind in ('interrupt','pause','continue','end','disconnect','reconnect') then
    perform hq_private.require_shape(p_command,array['type'],array['type']);
    if v_kind='interrupt' then update public.hq_meetings set floor='founder',generation=generation+1 where id=p_id;
    elsif v_kind='pause' then update public.hq_meetings set paused=true,floor='founder',generation=generation+1 where id=p_id;
    elsif v_kind='continue' then update public.hq_meetings set paused=false,floor=null where id=p_id;
    elsif v_kind='disconnect' then update public.hq_meetings set connection='disconnected',generation=generation+1,floor=null where id=p_id;
    elsif v_kind='reconnect' then update public.hq_meetings set connection='connected' where id=p_id;
    else
      update public.hq_meetings set status='ended',connection='ended',ended_at=pg_catalog.clock_timestamp(),generation=generation+1,floor=null where id=p_id;
      for v_item in select plan_id,version from public.hq_meeting_plan_versions where meeting_id=p_id and status='approved' and start_policy='meeting-end' loop
        perform hq_private.meeting_dispatch(p_id,v_item.plan_id,v_item.version);
      end loop;
    end if;
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
      if v_plan.status not in ('draft','awaiting-approval','approved','deferred')
        or p_command->>'decision'='approved' and v_plan.status<>'awaiting-approval'
        then raise exception 'HQ_MEETING_PLAN_STATE' using errcode='PT409'; end if;
      v_decision := p_command->>'decision';
      update public.hq_meeting_plan_versions set status=v_decision,
        start_policy=case when v_decision='approved' then p_command->>'start' else null end,
        approved_by=case when v_decision='approved' then v_uid else null end,
        approved_session=case when v_decision='approved' then (auth.jwt()->>'session_id')::uuid else null end,
        approved_at=case when v_decision='approved' then pg_catalog.clock_timestamp() else null end
        where meeting_id=p_id and plan_id=v_plan_id and version=v_plan.version;
      if v_decision='approved' and p_command->>'start'='now' then perform hq_private.meeting_dispatch(p_id,v_plan_id,v_plan.version); end if;
    end if;
  elsif v_kind='cancelTask' then
    perform hq_private.require_shape(p_command,array['type','taskId'],array['type','taskId']);
    v_task_id := hq_private.required_uuid(p_command->'taskId');
    update public.hq_meeting_tasks set status='cancelled',generation=generation+1,lease_token=null,lease_expires_at=null,
      hand_raised=false,updated_at=pg_catalog.clock_timestamp() where id=v_task_id and meeting_id=p_id and status in ('queued','running');
    if not found then raise exception 'HQ_MEETING_TASK_NOT_CANCELLABLE' using errcode='PT409'; end if;
  else
    perform hq_private.require_shape(p_command,array['type','taskId'],array['type','taskId']);
    v_task_id := hq_private.required_uuid(p_command->'taskId');
    update public.hq_meeting_tasks set hand_raised=false where id=v_task_id and meeting_id=p_id and status='completed' and hand_raised;
    if not found then raise exception 'HQ_MEETING_FINDING_UNAVAILABLE' using errcode='PT409'; end if;
  end if;
  if (select pg_catalog.count(*) from public.hq_meeting_events where meeting_id=p_id)>=4000
    then raise exception 'HQ_MEETING_EVENT_CAPACITY' using errcode='54000'; end if;
  insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(p_id,v_kind,v_uid::text,p_command);
  insert into hq_private.meeting_requests(founder_id,request_key,meeting_id,command) values(v_uid,p_request_key,p_id,p_command);
  return hq_private.meeting_payload(p_id);
end;
$$;

create function hq_private.meeting_worker(p_action text,p_task_id uuid,p_lease uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_task public.hq_meeting_tasks; v_agent text; v_now timestamptz := pg_catalog.clock_timestamp();
begin
  if coalesce(nullif(pg_catalog.current_setting('request.jwt.claim.role',true),''),auth.jwt()->>'role') is distinct from 'service_role'
    then raise exception 'HQ_MEETING_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_action is null or p_action not in ('claim','heartbeat','complete','fail','review')
    or pg_catalog.jsonb_typeof(p_payload) is distinct from 'object' or pg_catalog.octet_length(p_payload::text)>32768
    then raise exception 'HQ_MEETING_WORKER_INPUT' using errcode='22023'; end if;
  v_agent := hq_private.required_text(p_payload->'agentId',40);
  if not exists(select 1 from hq_private.meeting_runtime where singleton and executor_enabled)
    or not exists(select 1 from hq_private.meeting_agent_bindings where agent_id=v_agent and execution_qualified)
    then raise exception 'HQ_MEETING_EXECUTOR_UNQUALIFIED' using errcode='55000'; end if;
  -- One bounded worker slot for the initial qualification envelope. Row locking
  -- serializes lease reclamation/claim so a restart cannot exceed this cap.
  perform pg_catalog.pg_advisory_xact_lock(21128,19);
  v_now := pg_catalog.clock_timestamp();
  if not exists(select 1 from hq_private.meeting_runtime where singleton and executor_enabled)
    or not exists(select 1 from hq_private.meeting_agent_bindings where agent_id=v_agent and execution_qualified)
    then raise exception 'HQ_MEETING_EXECUTOR_UNQUALIFIED' using errcode='55000'; end if;
  update public.hq_meeting_tasks set status=case when attempt>=3 or deadline<=v_now then 'failed' else 'queued' end,
    generation=generation+1,lease_token=null,lease_expires_at=null,
    result=case when attempt>=3 or deadline<=v_now then '{"error":"worker lease expired"}'::jsonb else result end,
    updated_at=v_now where status='running' and lease_expires_at<=v_now;
  update public.hq_meeting_tasks set status='failed',result='{"error":"task deadline exceeded"}'::jsonb,updated_at=v_now
    where status='queued' and deadline<=v_now;
  if p_action='claim' then
    perform hq_private.require_shape(p_payload,array['agentId'],array['agentId']);
    if exists(select 1 from public.hq_meeting_tasks where status='running') then return null; end if;
    select t.* into v_task from public.hq_meeting_tasks t
      join public.hq_meetings m on m.id=t.meeting_id
      join public.hq_founders f on f.user_id=m.founder_id and f.revoked_at is null
      join hq_private.founder_invitations i on i.id=f.invitation_id and i.revoked_at is null
      where t.status='queued' and t.owner_id=v_agent and t.deadline>v_now and t.attempt<3
        and not exists(select 1 from pg_catalog.jsonb_array_elements_text(t.instruction->'blockers'))
        and not exists(select 1 from pg_catalog.jsonb_array_elements_text(t.instruction->'dependencies') d where not exists(
          select 1 from public.hq_meeting_tasks dep where dep.meeting_id=t.meeting_id and dep.plan_id=t.plan_id and dep.plan_version=t.plan_version
          and dep.task_key=d and dep.status='completed' and dep.review_status='accepted'))
      order by t.created_at for update of t skip locked limit 1;
    if not found then return null; end if;
    update public.hq_meeting_tasks set status='running',attempt=attempt+1,generation=generation+1,lease_token=pg_catalog.gen_random_uuid(),
      lease_expires_at=least(v_now+interval '30 seconds',deadline),heartbeat_at=v_now,updated_at=v_now where id=v_task.id returning * into v_task;
    insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload) values(v_task.meeting_id,'task-running',v_agent,
      pg_catalog.jsonb_build_object('taskId',v_task.id,'generation',v_task.generation));
    return pg_catalog.to_jsonb(v_task);
  end if;
  select * into v_task from public.hq_meeting_tasks where id=p_task_id for update;
  if not found then raise exception 'HQ_MEETING_TASK_NOT_FOUND' using errcode='P0002'; end if;
  v_now := pg_catalog.clock_timestamp();
  if p_action='review' then
    perform hq_private.require_shape(p_payload,array['agentId','decision','evidence'],array['agentId','decision','evidence']);
    if v_task.status<>'completed' or v_task.owner_id=v_agent or v_task.supervisor_id<>v_agent or v_task.reviewed_by is not null
      or p_payload->>'decision' is null or p_payload->>'decision' not in ('accepted','rejected') or pg_catalog.jsonb_typeof(p_payload->'evidence')<>'array'
      or pg_catalog.jsonb_array_length(p_payload->'evidence')<1 then raise exception 'HQ_MEETING_INDEPENDENT_REVIEW_REQUIRED' using errcode='22023'; end if;
    perform hq_private.meeting_require_evidence(p_payload->'evidence');
    update public.hq_meeting_tasks set reviewed_by=v_agent,review_status=p_payload->>'decision',review_receipt=p_payload,updated_at=v_now where id=p_task_id;
  else
    if v_task.status<>'running' or v_task.owner_id<>v_agent or p_lease is null or v_task.lease_token is distinct from p_lease
      or v_task.lease_expires_at<=v_now or v_task.deadline<=v_now
      then raise exception 'HQ_MEETING_STALE_LEASE' using errcode='PT409'; end if;
    if p_action='heartbeat' then
      perform hq_private.require_shape(p_payload,array['agentId'],array['agentId']);
      update public.hq_meeting_tasks set lease_expires_at=least(v_now+interval '30 seconds',deadline),heartbeat_at=v_now,updated_at=v_now where id=p_task_id;
    elsif p_action='complete' then
      perform hq_private.require_shape(p_payload,array['agentId','deliverable','evidence'],array['agentId','deliverable','evidence']);
      perform hq_private.required_text(p_payload->'deliverable',12000);
      if pg_catalog.jsonb_typeof(p_payload->'evidence')<>'array' or pg_catalog.jsonb_array_length(p_payload->'evidence')<1
        then raise exception 'HQ_MEETING_EVIDENCE_REQUIRED' using errcode='22023'; end if;
      perform hq_private.meeting_require_evidence(p_payload->'evidence');
      update public.hq_meeting_tasks set status='completed',result=p_payload,hand_raised=true,lease_token=null,lease_expires_at=null,updated_at=v_now where id=p_task_id;
    else
      perform hq_private.require_shape(p_payload,array['agentId','error'],array['agentId','error']);
      perform hq_private.required_text(p_payload->'error',2000);
      update public.hq_meeting_tasks set status='failed',result=p_payload,lease_token=null,lease_expires_at=null,updated_at=v_now where id=p_task_id;
    end if;
  end if;
  if p_action<>'heartbeat' then insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload)
    values(v_task.meeting_id,'task-'||p_action,v_agent,pg_catalog.jsonb_build_object('taskId',p_task_id,'result',p_payload)); end if;
  select * into v_task from public.hq_meeting_tasks where id=p_task_id;
  return pg_catalog.to_jsonb(v_task)-'lease_token';
end;
$$;

create function public.hq_meeting_create(p_id uuid,p_title text,p_language text,p_participants text[],p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_create(p_id,p_title,p_language,p_participants,p_request_key); $$;
create function public.hq_meeting_snapshot(p_meeting_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_snapshot(p_meeting_id); $$;
create function public.hq_meeting_command(p_meeting_id uuid,p_command jsonb,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_command(p_meeting_id,p_command,p_request_key); $$;
create function public.hq_meeting_worker(p_action text,p_task_id uuid,p_lease uuid,p_payload jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.meeting_worker(p_action,p_task_id,p_lease,p_payload); $$;

revoke all on function hq_private.guard_meeting_plan_version(),hq_private.meeting_digest(jsonb),hq_private.meeting_normalize_plan(jsonb),hq_private.meeting_require_evidence(jsonb),hq_private.meeting_payload(uuid),
  hq_private.meeting_snapshot(uuid),hq_private.meeting_create(uuid,text,text,text[],uuid),hq_private.meeting_dispatch(uuid,uuid,integer),
  hq_private.meeting_command(uuid,jsonb,uuid),hq_private.meeting_worker(text,uuid,uuid,jsonb),
  public.hq_meeting_create(uuid,text,text,text[],uuid),public.hq_meeting_snapshot(uuid),public.hq_meeting_command(uuid,jsonb,uuid),
  public.hq_meeting_worker(text,uuid,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function hq_private.meeting_create(uuid,text,text,text[],uuid),hq_private.meeting_snapshot(uuid),hq_private.meeting_command(uuid,jsonb,uuid),
  public.hq_meeting_create(uuid,text,text,text[],uuid),public.hq_meeting_snapshot(uuid),public.hq_meeting_command(uuid,jsonb,uuid) to authenticated;
grant execute on function hq_private.meeting_worker(text,uuid,uuid,jsonb),public.hq_meeting_worker(text,uuid,uuid,jsonb) to service_role;

-- Source-only forward retirement and fixed voice greeting. No deployment is
-- performed by authoring this file. Preserve meeting records/applied history.
begin;

-- Retired meeting records remain, but their terminal metadata must not enqueue
-- the obsolete meeting web-push categories from the applied notification chain.
drop trigger if exists hq_push_activity on public.hq_meeting_events;
drop trigger if exists hq_push_activity on public.hq_meeting_contributions;

revoke all on function
  public.hq_meeting_create(uuid,text,text,text[],uuid),
  public.hq_meeting_snapshot(uuid),
  public.hq_meeting_command(uuid,jsonb,uuid),
  public.hq_meeting_roster(),
  hq_private.meeting_create(uuid,text,text,text[],uuid),
  hq_private.meeting_snapshot(uuid),
  hq_private.meeting_command(uuid,jsonb,uuid),
  hq_private.meeting_roster()
  from public,anon,authenticated,service_role;

-- The canonical queue lock also fences an old host during rollout. Do not
-- rewrite an already running/completed job or discard its genuine evidence.
select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));

create function hq_private.block_retired_meeting_jobs() returns integer
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  update public.hq_agent_jobs j
    set status='blocked',error='meeting-feature-retired',completed_at=pg_catalog.clock_timestamp()
    where j.status='queued' and (
      exists(select 1 from public.hq_meeting_contributions c where c.job_id=j.id)
      or exists(select 1 from public.hq_meeting_task_links l where l.business_task_id=j.task_id));
  get diagnostics v_count=row_count;

  -- Only a task with no dispatched stage receives a retirement outcome here.
  -- A prior artifact or running stage remains a truthful historical record.
  update public.hq_business_tasks t
    set status='blocked',error='meeting-feature-retired',completed_at=pg_catalog.clock_timestamp(),updated_at=pg_catalog.clock_timestamp()
    where t.status='queued'
      and exists(select 1 from public.hq_meeting_task_links l where l.business_task_id=t.id)
      and exists(select 1 from public.hq_agent_jobs j where j.task_id=t.id and j.error='meeting-feature-retired')
      and not exists(select 1 from public.hq_agent_jobs j where j.task_id=t.id and j.started_at is not null);

  update public.hq_meeting_contributions c
    set status='blocked',error='meeting-feature-retired',completed_at=pg_catalog.clock_timestamp()
    where c.status='thinking' and exists(select 1 from public.hq_agent_jobs j
      where j.id=c.job_id and j.status='blocked' and j.error='meeting-feature-retired');
  return v_count;
end $$;
revoke all on function hq_private.block_retired_meeting_jobs() from public,anon,authenticated,service_role;

select hq_private.block_retired_meeting_jobs();

with ended as (
  update public.hq_meetings
    set status='ended',connection='ended',paused=true,floor=null,
      generation=generation+1,revision=revision+1,ended_at=coalesce(ended_at,pg_catalog.clock_timestamp())
    where status='active' returning id
)
insert into public.hq_meeting_events(meeting_id,kind,actor_id,payload)
  select id,'meeting-retired','system:meeting-retirement',
    pg_catalog.jsonb_build_object('reason','meeting-feature-retired','replacement','hq-chat-voice') from ended;

-- Close unplayed speech/floor state without deleting response text or artifacts.
update public.hq_meeting_contributions c
  set status='interrupted',error='meeting-feature-retired',completed_at=coalesce(completed_at,pg_catalog.clock_timestamp())
  where c.status in ('thinking','speaking') and exists(
    select 1 from public.hq_meetings m where m.id=c.meeting_id and m.status='ended');

-- Keep the current enriched claim chain and all public RPC signatures intact.
-- p_meeting_protocol remains a compatibility argument, not feature activation.
alter function hq_private.worker_claim(uuid,integer,integer) rename to worker_claim_before_meeting_retirement;
create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer,p_meeting_protocol integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then
    raise exception 'HQ_WORKER_REQUIRED' using errcode='42501';
  end if;
  if p_lease_seconds is distinct from 300 or p_meeting_protocol is null or p_meeting_protocol not in (0,1) then
    raise exception 'HQ_INVALID_LEASE' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then
    raise exception 'HQ_WORKER_REQUIRED' using errcode='42501';
  end if;
  v_count:=hq_private.block_retired_meeting_jobs();
  if v_count>0 then perform hq_private.live_emit('agents'); end if;
  return hq_private.worker_claim_before_meeting_retirement(p_worker_id,p_lease_seconds,p_meeting_protocol);
end $$;
create or replace function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language sql security invoker set search_path='' as $$
  select hq_private.worker_claim(p_worker_id,p_lease_seconds,0);
$$;
revoke all on function hq_private.worker_claim_before_meeting_retirement(uuid,integer,integer),
  hq_private.worker_claim(uuid,integer,integer),hq_private.worker_claim(uuid,integer)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_claim(uuid,integer,integer),hq_private.worker_claim(uuid,integer) to authenticated;

-- Deterministic greeting receipts are private operational records. They neither
-- invoke an employee nor claim an AI response, task, qualification or learning.
create table hq_private.voice_greeting_requests (
  founder_id uuid not null,
  request_key uuid not null,
  greeting_name text not null check(pg_catalog.char_length(greeting_name) between 1 and 40),
  founder_message_id uuid not null unique references public.hq_agent_messages(id),
  greeting_message_id uuid not null unique references public.hq_agent_messages(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  primary key(founder_id,request_key)
);
alter table hq_private.voice_greeting_requests enable row level security;
revoke all on hq_private.voice_greeting_requests from public,anon,authenticated,service_role;
create trigger hq_voice_greeting_requests_immutable before update or delete on hq_private.voice_greeting_requests
  for each row execute function hq_private.immutable_record();

create function hq_private.voice_greet(p_name text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
  v_uid uuid:=hq_private.founder_uid();
  v_conversation uuid;
  v_founder_message uuid;
  v_greeting_message uuid;
  v_existing hq_private.voice_greeting_requests;
  v_greeting text;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  -- Unicode printable names avoid locale-dependent POSIX alnum exclusions.
  -- The website uses the same bounded printable-Unicode name policy.
  -- SQL parameters remain plain text; markup, controls and invisible/bidi
  -- formatting characters cannot become a saved or spoken greeting name.
  if p_request_key is null or p_name is null or pg_catalog.char_length(p_name) not between 1 and 40
    or p_name<>pg_catalog.btrim(p_name) or pg_catalog.btrim(p_name)=''
    or p_name ~ '[[:cntrl:]]' or pg_catalog.replace(p_name,' ','') ~ '[[:space:]]'
    or p_name ~ $unsafe$[<>\\]$unsafe$
    or p_name ~ U&'[\0001-\001F\007F-\009F\00AD\034F\061C\115F-\1160\17B4-\17B5\180B-\180F\200B-\200F\2028-\202E\2060-\206F\3164\FE00-\FE0F\FEFF\FFA0]' then
    raise exception 'HQ_INVALID_VOICE_NAME' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-voice-greeting:'||v_uid::text,0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into v_existing from hq_private.voice_greeting_requests where founder_id=v_uid and request_key=p_request_key;
  if found then
    if v_existing.greeting_name is distinct from p_name then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return pg_catalog.jsonb_build_object('founderMessageId',v_existing.founder_message_id,'greetingMessageId',v_existing.greeting_message_id);
  end if;
  if (select pg_catalog.count(*) from hq_private.voice_greeting_requests where founder_id=v_uid)>=5000
    or (select pg_catalog.count(*) from hq_private.voice_greeting_requests
      where founder_id=v_uid and created_at>pg_catalog.clock_timestamp()-interval '1 hour')>=60 then
    raise exception 'HQ_VOICE_GREETING_LIMIT' using errcode='PT429';
  end if;
  v_greeting:='Hi '||p_name;
  -- This existing row serializes history capacity with ordinary Chat writes;
  -- no worker queue lock, queued job, provider call or Brain write is required.
  insert into public.hq_agent_conversations(founder_user_id) values(v_uid)
    on conflict(founder_user_id) do update set updated_at=pg_catalog.clock_timestamp() returning id into v_conversation;
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if (select pg_catalog.count(*) from public.hq_agent_messages where conversation_id=v_conversation)>9998
    or (select coalesce(pg_catalog.sum(pg_catalog.octet_length(text)),0) from public.hq_agent_messages where conversation_id=v_conversation)
      +pg_catalog.octet_length('Hey Steve')+pg_catalog.octet_length(v_greeting)>33554432 then
    raise exception 'HQ_HISTORY_CAPACITY' using errcode='PT409';
  end if;
  insert into public.hq_agent_messages(conversation_id,role,agent_id,text,kind)
    values(v_conversation,'founder','AG-CEO-001','Hey Steve','message') returning id into v_founder_message;
  insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to,kind)
    values(v_conversation,'assistant','AG-CEO-001',v_greeting,v_founder_message,'message') returning id into v_greeting_message;
  insert into hq_private.voice_greeting_requests(founder_id,request_key,greeting_name,founder_message_id,greeting_message_id)
    values(v_uid,p_request_key,p_name,v_founder_message,v_greeting_message);
  perform hq_private.live_emit('agents');
  return pg_catalog.jsonb_build_object('founderMessageId',v_founder_message,'greetingMessageId',v_greeting_message);
end $$;
create function public.hq_voice_greet(p_name text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.voice_greet(p_name,p_request_key); $$;
revoke all on function hq_private.voice_greet(text,uuid),public.hq_voice_greet(text,uuid) from public,anon,authenticated,service_role;
grant execute on function hq_private.voice_greet(text,uuid),public.hq_voice_greet(text,uuid) to authenticated;

select hq_private.live_emit('agents');
commit;

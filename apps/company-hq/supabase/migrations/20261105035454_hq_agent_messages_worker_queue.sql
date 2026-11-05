-- Private HQ conversation / read-only planning queue. No worker identity,
-- model allowance, schedule, employee execution tool or deployment is installed.
-- Existing approvals and the cloud Brain remain separate authority boundaries.

create table hq_private.agent_roster (
  id text primary key check (id ~ '^AG-[A-Z]+-[0-9]{3}$'),
  name text not null,
  role text not null,
  department_key text,
  enabled boolean not null default true
);
insert into hq_private.agent_roster(id,name,role,department_key) values
  ('AG-CEO-001','Steve','CEO',null),
  ('AG-HR-001','Amaya','HR Lead','hr-agent-development');

create table hq_private.agent_workers (
  worker_id uuid primary key,
  auth_user_id uuid not null unique,
  enabled boolean not null default false,
  last_seen_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp()
);
-- This first host runs one bounded job at a time; additional hosts require an
-- explicit capacity/concurrency change, not another same-role login.
create unique index hq_agent_one_enabled_host on hq_private.agent_workers((enabled)) where enabled;

create table public.hq_agent_conversations (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  founder_user_id uuid not null unique,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  updated_at timestamptz not null default pg_catalog.clock_timestamp()
);
create table public.hq_agent_messages (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  conversation_id uuid not null references public.hq_agent_conversations(id),
  role text not null check (role in ('founder','assistant')),
  agent_id text not null references hq_private.agent_roster(id),
  text text not null check (pg_catalog.octet_length(text) between 1 and 32000),
  reply_to uuid unique references public.hq_agent_messages(id),
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  check ((role='founder' and reply_to is null) or (role='assistant' and reply_to is not null))
);
create table public.hq_agent_jobs (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  conversation_id uuid not null references public.hq_agent_conversations(id),
  founder_message_id uuid not null references public.hq_agent_messages(id),
  founder_user_id uuid not null,
  agent_id text not null references hq_private.agent_roster(id),
  request_key uuid not null,
  depends_on uuid references public.hq_agent_jobs(id),
  status text not null default 'queued' check (status in ('queued','working','completed','blocked')),
  worker_id uuid references hq_private.agent_workers(worker_id),
  lease_token uuid,
  lease_expires_at timestamptz,
  created_at timestamptz not null default pg_catalog.clock_timestamp(),
  started_at timestamptz,
  completed_at timestamptz,
  error text check (error ~ '^[a-z-]{1,80}$'),
  result_digest text check (result_digest ~ '^[0-9a-f]{64}$'),
  result_text text check (pg_catalog.octet_length(result_text) between 1 and 32000),
  unique(founder_user_id,request_key,agent_id),
  unique(founder_message_id,agent_id),
  check ((agent_id='AG-HR-001' and depends_on is null) or (agent_id='AG-CEO-001' and depends_on is not null)),
  check (result_text is null or (agent_id='AG-HR-001' and status='completed')),
  check (status<>'completed' or agent_id<>'AG-HR-001' or result_text is not null),
  check ((worker_id is null and lease_token is null and lease_expires_at is null and started_at is null)
    or (worker_id is not null and lease_token is not null and lease_expires_at is not null and started_at is not null)),
  check ((status in ('queued','working') and completed_at is null and error is null)
    or (status='completed' and completed_at is not null and error is null and result_digest is not null)
    or (status='blocked' and completed_at is not null and error is not null))
);
create index hq_agent_messages_conversation_idx on public.hq_agent_messages(conversation_id,created_at desc,id desc);
create index hq_agent_jobs_queue_idx on public.hq_agent_jobs(created_at,id) where status='queued';
create index hq_agent_jobs_conversation_idx on public.hq_agent_jobs(conversation_id,created_at desc,id desc);
create index hq_agent_jobs_founder_recent_idx on public.hq_agent_jobs(founder_user_id,created_at desc,id desc);
create index hq_agent_jobs_agent_recent_idx on public.hq_agent_jobs(founder_user_id,agent_id,created_at desc,id desc);
create index hq_agent_jobs_worker_idx on public.hq_agent_jobs(worker_id,lease_expires_at) where status='working';
create index hq_agent_jobs_dependency_idx on public.hq_agent_jobs(depends_on) where status='queued';
create unique index hq_agent_single_active_agent on public.hq_agent_jobs(agent_id) where status='working';
create unique index hq_agent_single_active_worker on public.hq_agent_jobs(worker_id) where status='working';
alter table hq_private.agent_roster enable row level security;
alter table hq_private.agent_workers enable row level security;
alter table public.hq_agent_conversations enable row level security;
alter table public.hq_agent_messages enable row level security;
alter table public.hq_agent_jobs enable row level security;
revoke all on hq_private.agent_roster,hq_private.agent_workers,public.hq_agent_conversations,
  public.hq_agent_messages,public.hq_agent_jobs from public,anon,authenticated,service_role;
create trigger hq_agent_message_immutable before update or delete on public.hq_agent_messages
  for each row execute function hq_private.immutable_record();

-- Extend the existing durable private founder invalidation outbox.
alter table hq_private.live_invalidations drop constraint live_invalidations_kind_check;
alter table hq_private.live_invalidations add constraint live_invalidations_kind_check
  check (kind in ('brain','company','access','agents'));
create or replace function hq_private.live_emit(p_kind text) returns void
language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_key text;
begin
  if p_kind is null or p_kind not in ('brain','company','access','agents') then
    raise exception 'HQ_INVALID_LIVE_KIND' using errcode='22023';
  end if;
  v_key:='hq.live_emitted_'||p_kind;
  if pg_catalog.current_setting(v_key,true)='1' then return; end if;
  insert into hq_private.live_invalidations(kind) values(p_kind) returning id into v_id;
  begin perform hq_private.live_deliver(v_id); exception when others then null; end;
  perform pg_catalog.set_config(v_key,'1',true);
  delete from hq_private.live_invalidations where delivered_at<pg_catalog.clock_timestamp()-interval '7 days';
end;
$$;

create function hq_private.agent_worker_uid(p_worker_id uuid default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.live_auth_uid();
begin
  if v_uid is null or not exists(select 1 from hq_private.agent_workers w
    where w.auth_user_id=v_uid and w.enabled and (p_worker_id is null or w.worker_id=p_worker_id))
    or exists(select 1 from public.hq_founders f where f.user_id=v_uid)
  then return null; end if;
  return v_uid;
end;
$$;
create function public.hq_can_receive_agent_jobs() returns boolean
language sql security invoker set search_path='' as $$ select hq_private.agent_worker_uid() is not null; $$;
create policy hq_agent_jobs_receive on realtime.messages for select to authenticated
  using(extension='broadcast' and topic='hq-agent-jobs' and topic=(select realtime.topic())
    and (select public.hq_can_receive_agent_jobs()));
create policy hq_agent_jobs_scope_guard on realtime.messages as restrictive for select to public
  using(case when topic='hq-agent-jobs' or (select realtime.topic())='hq-agent-jobs'
    then extension='broadcast' and topic='hq-agent-jobs' and topic=(select realtime.topic())
      and (select public.hq_can_receive_agent_jobs()) else true end);
create policy hq_agent_jobs_no_client_send on realtime.messages as restrictive for insert to public
  with check(topic<>'hq-agent-jobs' and coalesce((select realtime.topic()),'')<>'hq-agent-jobs');

-- Administrative bootstrap only. Create the dedicated confirmed Auth account
-- through supported Auth administration first; this function grants no Auth or
-- founder role and cannot be called through the public Data API.
create function hq_private.register_agent_worker(p_worker_id uuid,p_auth_user_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if p_worker_id is null or p_worker_id='00000000-0000-0000-0000-000000000000'::uuid
    or p_auth_user_id is null or not exists(select 1 from auth.users u where u.id=p_auth_user_id
      and u.email_confirmed_at is not null and u.email is not null and pg_catalog.lower(u.email)<>'ceo@building-suit.com')
    or exists(select 1 from public.hq_founders f where f.user_id=p_auth_user_id) then
    raise exception 'HQ_INVALID_WORKER' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if exists(select 1 from hq_private.agent_workers w where w.worker_id=p_worker_id and w.auth_user_id<>p_auth_user_id) then
    raise exception 'HQ_WORKER_ALREADY_BOUND' using errcode='55000';
  end if;
  insert into hq_private.agent_workers(worker_id,auth_user_id,enabled) values(p_worker_id,p_auth_user_id,true)
    on conflict(worker_id) do update set enabled=true;
end;
$$;

create function hq_private.agent_snapshot() returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_conversation uuid; v_seen timestamptz; v_online boolean; v_agents jsonb; v_messages jsonb; v_jobs jsonb;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select c.id into v_conversation from public.hq_agent_conversations c where c.founder_user_id=v_uid;
  select pg_catalog.max(w.last_seen_at) into v_seen from hq_private.agent_workers w where w.enabled;
  v_online:=coalesce(v_seen>pg_catalog.clock_timestamp()-interval '150 seconds',false);
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',a.id,'name',a.name,'role',a.role,'departmentId',d.id,'deskIndex',0,
    'status',case when j.status='working' and j.lease_expires_at>pg_catalog.clock_timestamp() then 'working'
      when j.status='working' or j.status='blocked' then 'blocked' when v_online then 'idle' else 'offline' end,
    'taskId',case when j.status='working' then j.id else null end,'lastSeenAt',v_seen) order by a.id),'[]'::jsonb)
    into v_agents from hq_private.agent_roster a
    left join public.hq_departments d on d.department_key=a.department_key
    left join lateral(select x.id,x.status,x.lease_expires_at from public.hq_agent_jobs x
      where x.agent_id=a.id and x.founder_user_id=v_uid
      order by (x.status='working') desc,x.created_at desc,x.id desc limit 1) j on true
    where a.enabled;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',m.id,'role',m.role,'agentId',m.agent_id,'text',m.text,'createdAt',m.created_at,'replyTo',m.reply_to)
    order by m.created_at,m.id),'[]'::jsonb) into v_messages
    from(select recent.* from(select item.*,
      pg_catalog.sum(pg_catalog.octet_length(pg_catalog.to_jsonb(item)::text))
        over(order by item.created_at desc,item.id desc) as payload_bytes
      from(select * from public.hq_agent_messages where conversation_id=v_conversation order by created_at desc,id desc limit 12) item) recent
      where recent.payload_bytes<=350000) m;
  select coalesce(pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
    'id',j.id,'agentId',j.agent_id,'status',case
      when j.status='working' and j.lease_expires_at<=pg_catalog.clock_timestamp() then 'blocked'
      when j.status='queued' and exists(select 1 from public.hq_agent_jobs parent where parent.id=j.depends_on
        and (parent.status='blocked' or parent.status='working' and parent.lease_expires_at<=pg_catalog.clock_timestamp())) then 'blocked' else j.status end,
    'createdAt',j.created_at,'startedAt',j.started_at,'completedAt',j.completed_at,
    'error',case when j.status='working' and j.lease_expires_at<=pg_catalog.clock_timestamp() then 'worker-interrupted'
      when j.status='queued' and exists(select 1 from public.hq_agent_jobs parent where parent.id=j.depends_on
        and (parent.status='blocked' or parent.status='working' and parent.lease_expires_at<=pg_catalog.clock_timestamp())) then 'hr-review-unavailable' else j.error end)
    order by j.created_at,j.id),'[]'::jsonb) into v_jobs
    from(select * from public.hq_agent_jobs where conversation_id=v_conversation order by created_at desc,id desc limit 40) j;
  return pg_catalog.jsonb_build_object('agents',v_agents,'messages',v_messages,'jobs',v_jobs,'conversationId',v_conversation,
    'runtime',pg_catalog.jsonb_build_object('connected',v_online,'lastSeenAt',v_seen));
end;
$$;
create function public.hq_agent_snapshot() returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.agent_snapshot(); $$;

create function hq_private.send_ceo_message(p_prompt text,p_request_key uuid) returns jsonb
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
  select * into v_existing from public.hq_agent_jobs where founder_user_id=v_uid and request_key=p_request_key and agent_id='AG-CEO-001';
  if found then
    select m.text into v_previous from public.hq_agent_messages m where m.id=v_existing.founder_message_id;
    if v_previous is distinct from p_prompt then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.agent_snapshot();
  end if;
  if (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and status='queued')>=40
    or (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and agent_id='AG-CEO-001'
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
create function public.hq_send_ceo_message(p_prompt text,p_request_key uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.send_ceo_message(p_prompt,p_request_key); $$;

create function hq_private.worker_presence(p_worker_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  update hq_private.agent_workers set last_seen_at=pg_catalog.clock_timestamp() where worker_id=p_worker_id and enabled;
  get diagnostics v_count = row_count;
  if v_count<>1 or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  perform hq_private.live_emit('agents');
  return pg_catalog.jsonb_build_object('accepted',true);
end;
$$;
create function public.hq_worker_presence(p_worker_id uuid) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_presence(p_worker_id); $$;

create function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.hq_agent_jobs; v_context jsonb; v_prompt text; v_files jsonb; v_count integer; v_expired integer; v_wake timestamptz;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_lease_seconds is distinct from 300 then raise exception 'HQ_INVALID_LEASE' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  -- Started jobs never become queued again: uncertain inference needs an
  -- explicit founder retry with a new message/job identity.
  update public.hq_agent_jobs set status='blocked',error='worker-interrupted',completed_at=pg_catalog.clock_timestamp()
    where status='working' and lease_expires_at<=pg_catalog.clock_timestamp();
  get diagnostics v_expired = row_count;
  if v_expired>0 then perform hq_private.live_emit('agents'); end if;
  update public.hq_agent_jobs child set status='blocked',error='hr-review-unavailable',completed_at=pg_catalog.clock_timestamp()
    where child.status='queued' and exists(select 1 from public.hq_agent_jobs parent where parent.id=child.depends_on and parent.status='blocked');
  get diagnostics v_expired = row_count;
  if v_expired>0 then perform hq_private.live_emit('agents'); end if;
  select pg_catalog.min(lease_expires_at) into v_wake from public.hq_agent_jobs where status='working';
  if v_wake is not null then return pg_catalog.jsonb_build_object('job',null,'next_wake_at',v_wake); end if;
  select job.* into v_job from public.hq_agent_jobs job where job.status='queued'
    and (job.depends_on is null or exists(select 1 from public.hq_agent_jobs parent where parent.id=job.depends_on
      and parent.status='completed' and parent.result_text is not null and parent.agent_id='AG-HR-001'
      and parent.founder_message_id=job.founder_message_id and parent.founder_user_id=job.founder_user_id))
    order by job.created_at,job.id limit 1 for update skip locked;
  if not found then return pg_catalog.jsonb_build_object('job',null); end if;
  -- Canonical IDs were observed in the existing Drive source index. They grant
  -- no write permission. Every required file must remain in the current index;
  -- the host additionally rechecks ancestry/revision/content directly in Drive.
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('id',f.file_id) order by b.position),pg_catalog.count(*)
    into v_files,v_count from (values
      (1,'1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5'), -- root AGENTS
      (2,'1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz'), -- HOME
      (3,'1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf'), -- current working agreement
      (4,'14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB'), -- workforce rules
      (5,'1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N'), -- agent registry
      (6,'1gJssY0e-ZWis0E2sE0Zi58tYlensrt6i'), -- CEO charter/profile
      (7,'1TmFbhfjYfaX88mI2k4fqj7NsH3-Zz1ha'), -- executive office charter
      (8,'18IA3dmvYPqH3YfxJQSqwx32Q5632lEt8'), -- HR lead profile
      (9,'1tRzGxRcZZ5IYTD1baa-mWKznrQokI1sq'), -- HR charter
      (10,'1ZaHIzH8Uo2yyVggDF7sLdD3BB3205YdN') -- CEO / HR playbook
    ) b(position,file_id) join hq_private.brain_files f on f.file_id=b.file_id
      and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.in_scope and not f.trashed;
  if v_count<>10 then
    update public.hq_agent_jobs set status='blocked',error='brain-scope-required',completed_at=pg_catalog.clock_timestamp() where status='queued';
    perform hq_private.live_emit('agents');
    return pg_catalog.jsonb_build_object('job',null);
  end if;
  update public.hq_agent_jobs set status='working',worker_id=p_worker_id,lease_token=pg_catalog.gen_random_uuid(),
    lease_expires_at=pg_catalog.clock_timestamp()+interval '300 seconds',started_at=pg_catalog.clock_timestamp()
    where id=v_job.id returning * into v_job;
  select text into v_prompt from public.hq_agent_messages where id=v_job.founder_message_id;
  select pg_catalog.jsonb_build_object('brain_files',v_files,
    'agent',pg_catalog.jsonb_build_object('id',a.id,'name',a.name,'role',a.role),
    'mode',case when a.id='AG-HR-001' then 'hr-planning-assessment' else 'ceo-founder-reply' end,
    'hr_review',case when v_job.depends_on is not null then (
      select pg_catalog.jsonb_build_object('job_id',parent.id,'agent_id',parent.agent_id,'text',parent.result_text,'completed_at',parent.completed_at)
      from public.hq_agent_jobs parent where parent.id=v_job.depends_on and parent.status='completed'
        and parent.agent_id='AG-HR-001' and parent.founder_message_id=v_job.founder_message_id) else null end,
    'messages',coalesce((
      select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object('role',m.role,'text',m.text) order by m.created_at,m.id)
      from(select x.* from public.hq_agent_messages x where x.conversation_id=v_job.conversation_id
        and pg_catalog.octet_length(pg_catalog.to_jsonb(x)::text)<=20000
        and x.created_at<(select current_message.created_at from public.hq_agent_messages current_message where current_message.id=v_job.founder_message_id)
        order by x.created_at desc,x.id desc limit 1) m),'[]'::jsonb))
    into v_context from hq_private.agent_roster a where a.id=v_job.agent_id and a.enabled;
  if v_context is null then raise exception 'HQ_AGENT_UNAVAILABLE' using errcode='55000'; end if;
  if v_job.agent_id='AG-CEO-001' and (v_job.depends_on is null or pg_catalog.jsonb_typeof(v_context->'hr_review') is distinct from 'object') then
    raise exception 'HQ_HR_REVIEW_REQUIRED' using errcode='55000';
  end if;
  perform hq_private.worker_presence(p_worker_id);
  return pg_catalog.jsonb_build_object('job',pg_catalog.jsonb_build_object('id',v_job.id,'conversation_id',v_job.conversation_id,
    'agent_id',v_job.agent_id,'prompt',v_prompt,'context',v_context,'lease_token',v_job.lease_token));
end;
$$;
create function public.hq_worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_claim(p_worker_id,p_lease_seconds); $$;

create function hq_private.worker_heartbeat(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_status text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_status is distinct from 'working' then raise exception 'HQ_INVALID_JOB_STATUS' using errcode='22023'; end if;
  update public.hq_agent_jobs set lease_expires_at=pg_catalog.clock_timestamp()+interval '300 seconds'
    where id=p_job_id and worker_id=p_worker_id and lease_token=p_lease_token
      and status='working' and lease_expires_at>pg_catalog.clock_timestamp();
  get diagnostics v_count = row_count;
  if v_count<>1 then return pg_catalog.jsonb_build_object('accepted',false); end if;
  perform hq_private.worker_presence(p_worker_id);
  return pg_catalog.jsonb_build_object('accepted',true);
end;
$$;
create function public.hq_worker_heartbeat(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_status text) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_heartbeat(p_job_id,p_lease_token,p_worker_id,p_status); $$;

create function hq_private.worker_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.hq_agent_jobs; v_digest text;
begin
  if p_worker_id is null or hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  if p_reply is null or pg_catalog.octet_length(p_reply)>32000 or p_error is not null and (p_error !~ '^[a-z-]{1,80}$' or p_reply<>'')
    or p_error is null and (pg_catalog.btrim(p_reply)='' or p_reply ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]') then
    raise exception 'HQ_INVALID_JOB_RESULT' using errcode='22023';
  end if;
  v_digest:=pg_catalog.encode(extensions.digest(pg_catalog.jsonb_build_array(p_reply,p_error)::text,'sha256'),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.agent_worker_uid(p_worker_id) is null then raise exception 'HQ_WORKER_REQUIRED' using errcode='42501'; end if;
  select * into v_job from public.hq_agent_jobs where id=p_job_id for update;
  if not found or v_job.worker_id is distinct from p_worker_id or v_job.lease_token is distinct from p_lease_token then
    raise exception 'HQ_LEASE_LOST' using errcode='42501';
  end if;
  if v_job.result_digest is not null then
    if v_job.result_digest<>v_digest then raise exception 'HQ_RESULT_ALREADY_COMMITTED' using errcode='PT409'; end if;
    return pg_catalog.jsonb_build_object('accepted',true);
  end if;
  if v_job.status='blocked' and v_job.error='worker-interrupted'
    or v_job.status='working' and v_job.lease_expires_at<=pg_catalog.clock_timestamp() then
    -- Accept the terminal delivery receipt without presenting a late/uncertain
    -- answer as successful work. It can never reserve this job again.
    update public.hq_agent_jobs set status='blocked',error='worker-interrupted',completed_at=coalesce(completed_at,pg_catalog.clock_timestamp()),
      result_digest=v_digest where id=v_job.id;
    update public.hq_agent_jobs set status='blocked',error='hr-review-unavailable',completed_at=pg_catalog.clock_timestamp()
      where depends_on=v_job.id and status='queued';
    perform hq_private.live_emit('agents');
    return pg_catalog.jsonb_build_object('accepted',true,'discarded',true);
  end if;
  if v_job.status<>'working' then raise exception 'HQ_JOB_ALREADY_FINISHED' using errcode='PT409'; end if;
  if p_error is null and v_job.agent_id='AG-CEO-001' then
    insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to)
      values(v_job.conversation_id,'assistant',v_job.agent_id,p_reply,v_job.founder_message_id);
  end if;
  update public.hq_agent_jobs set status=case when p_error is null then 'completed' else 'blocked' end,
    completed_at=pg_catalog.clock_timestamp(),error=p_error,result_digest=v_digest,
    result_text=case when p_error is null and v_job.agent_id='AG-HR-001' then p_reply else null end where id=v_job.id;
  if p_error is not null then
    update public.hq_agent_jobs set status='blocked',error='hr-review-unavailable',completed_at=pg_catalog.clock_timestamp()
      where depends_on=v_job.id and status='queued';
  end if;
  update public.hq_agent_conversations set updated_at=pg_catalog.clock_timestamp() where id=v_job.conversation_id;
  perform hq_private.worker_presence(p_worker_id);
  return pg_catalog.jsonb_build_object('accepted',true);
end;
$$;
create function public.hq_worker_finish(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish(p_job_id,p_lease_token,p_worker_id,p_reply,p_error); $$;

-- Wrappers are invoker functions. Only explicitly granted guarded helpers run
-- with elevated access; tables remain unavailable to all API roles.
revoke all on function hq_private.agent_worker_uid(uuid),public.hq_can_receive_agent_jobs(),
  hq_private.register_agent_worker(uuid,uuid),hq_private.agent_snapshot(),public.hq_agent_snapshot(),
  hq_private.send_ceo_message(text,uuid),public.hq_send_ceo_message(text,uuid),
  hq_private.worker_presence(uuid),public.hq_worker_presence(uuid),
  hq_private.worker_claim(uuid,integer),public.hq_worker_claim(uuid,integer),
  hq_private.worker_heartbeat(uuid,uuid,uuid,text),public.hq_worker_heartbeat(uuid,uuid,uuid,text),
  hq_private.worker_finish(uuid,uuid,uuid,text,text),public.hq_worker_finish(uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
grant execute on function hq_private.agent_worker_uid(uuid),public.hq_can_receive_agent_jobs(),
  hq_private.agent_snapshot(),public.hq_agent_snapshot(),
  hq_private.send_ceo_message(text,uuid),public.hq_send_ceo_message(text,uuid),
  hq_private.worker_presence(uuid),public.hq_worker_presence(uuid),
  hq_private.worker_claim(uuid,integer),public.hq_worker_claim(uuid,integer),
  hq_private.worker_heartbeat(uuid,uuid,uuid,text),public.hq_worker_heartbeat(uuid,uuid,uuid,text),
  hq_private.worker_finish(uuid,uuid,uuid,text,text),public.hq_worker_finish(uuid,uuid,uuid,text,text)
  to authenticated;

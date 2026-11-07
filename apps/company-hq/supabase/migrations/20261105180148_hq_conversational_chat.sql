-- CEO-first chat and real conversational task transitions. Forward only.
-- No new tools, provider permissions, hires, inference retries or review bypass.
alter table public.hq_agent_messages drop constraint hq_agent_messages_reply_to_key;
alter table public.hq_agent_messages
  add column kind text not null default 'message' check(kind in ('message','handoff','acknowledgement','task-result','recovery')),
  add column task_id uuid references public.hq_business_tasks(id),
  add column job_id uuid unique references public.hq_agent_jobs(id),
  add column mention_ids text[] not null default '{}' check(cardinality(mention_ids)<=10);
do $$ declare c record; begin
  for c in select conname from pg_catalog.pg_constraint where conrelid='public.hq_agent_jobs'::regclass
    and contype='c' and pg_get_constraintdef(oid) like '%conversation-hr%'
  loop execute format('alter table public.hq_agent_jobs drop constraint %I',c.conname); end loop;
end $$;
alter table public.hq_agent_jobs add constraint hq_agent_jobs_kind_check check(kind in
  ('conversation-hr','conversation-ceo','conversation-intake','task-route','task-ack','task-start','task-work','head-review','ceo-review','task-report','lesson-extract','lesson-review'));
create unique index hq_agent_chat_intake_request on public.hq_agent_jobs(founder_user_id,request_key) where kind='conversation-intake';

-- One source-bound utterance per actual stage. Immutable messages cannot be
-- rewritten to make a failed stage look successful; replay returns no duplicate.
create function hq_private.chat_message(p_job public.hq_agent_jobs,p_text text,p_kind text,p_mentions text[] default '{}') returns void
language plpgsql security definer set search_path='' as $$ begin
  if p_text is null or octet_length(p_text) not between 1 and 32000 or btrim(p_text)=''
    or p_text ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' or cardinality(p_mentions)>10
    or exists(select 1 from unnest(p_mentions) id where not exists(select 1 from hq_private.agent_roster r where r.id=id and r.enabled))
    then raise exception 'HQ_INVALID_CHAT_EVENT' using errcode='22023'; end if;
  insert into public.hq_agent_messages(conversation_id,role,agent_id,text,reply_to,kind,task_id,job_id,mention_ids)
    values(p_job.conversation_id,'assistant',p_job.agent_id,p_text,p_job.founder_message_id,p_kind,p_job.task_id,p_job.id,p_mentions)
    on conflict(job_id) do nothing;
end $$;
revoke all on function hq_private.chat_message(public.hq_agent_jobs,text,text,text[]) from public,anon,authenticated,service_role;

alter function hq_private.agent_snapshot() rename to agent_snapshot_before_chat;
create function hq_private.agent_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); result jsonb; transcript jsonb; tasks jsonb; begin
  result:=hq_private.agent_snapshot_before_chat();
  select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'role',m.role,'agentId',m.agent_id,'text',m.text,'createdAt',m.created_at,
    'replyTo',m.reply_to,'kind',m.kind,'taskId',m.task_id,'mentions',coalesce((select jsonb_agg(jsonb_build_object('agentId',r.id,'name',r.name) order by r.id)
      from hq_private.agent_roster r where r.id=any(m.mention_ids) and r.enabled),'[]'::jsonb)) order by m.created_at,m.id),'[]'::jsonb) into transcript
    from(select bounded.* from(select recent.*,sum(octet_length(row_to_json(recent)::text)) over(order by recent.created_at desc,recent.id desc) as payload_bytes
      from(select m.* from public.hq_agent_messages m join public.hq_agent_conversations c on c.id=m.conversation_id
        where c.founder_user_id=uid order by m.created_at desc,m.id desc limit 32) recent) bounded where payload_bytes<=393216) m;
  select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'title',t.title,'brief',t.brief,'acceptance',t.acceptance,'assigneeId',t.assignee_id,
    'status',t.status,'createdAt',t.created_at,'updatedAt',t.updated_at,'completedAt',t.completed_at,'repairCount',t.repair_count,
    'deliverable',t.deliverable,'reviewSummary',t.review_summary,'error',t.error) order by t.created_at desc,t.id),'[]'::jsonb) into tasks
    from(select bounded.* from(select recent.*,sum(octet_length(row_to_json(recent)::text)) over(order by priority,created_at desc,id desc) as payload_bytes
      from(select t.*,case when exists(select 1 from jsonb_array_elements(transcript) m where m->>'taskId'=t.id::text) then 0
        when exists(select 1 from jsonb_array_elements(result->'lessons') l where l->>'sourceType'='task' and l->>'sourceId'=t.id::text) then 1 else 2 end as priority
        from public.hq_business_tasks t where founder_user_id=uid order by priority,created_at desc,id desc limit 32) recent) bounded where payload_bytes<=393216) t;
  transcript:=coalesce((select jsonb_agg(m order by m->>'createdAt',m->>'id') from jsonb_array_elements(transcript) m
    where m->>'taskId' is null or exists(select 1 from jsonb_array_elements(tasks) t where t->>'id'=m->>'taskId')),'[]'::jsonb);
  result:=jsonb_set(result,'{lessons}',coalesce((select jsonb_agg(l) from jsonb_array_elements(result->'lessons') l
    where l->>'sourceType'<>'task' or exists(select 1 from jsonb_array_elements(tasks) t where t->>'id'=l->>'sourceId')),'[]'::jsonb));
  return result||jsonb_build_object('messages',transcript,'tasks',tasks);
end $$;
create or replace function public.hq_agent_snapshot() returns jsonb language sql security invoker set search_path='' as $$ select hq_private.agent_snapshot(); $$;
revoke all on function hq_private.agent_snapshot_before_chat(),hq_private.agent_snapshot() from public,anon,authenticated,service_role;
grant execute on function hq_private.agent_snapshot() to authenticated;

create or replace function hq_private.send_ceo_message(p_prompt text,p_request_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_uid uuid:=hq_private.founder_uid(); v_conversation uuid; v_message uuid; v_existing public.hq_agent_jobs; v_previous text;
begin
  if v_uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  if p_request_key is null or p_prompt is null or pg_catalog.char_length(p_prompt) not between 1 and 6000
    or pg_catalog.btrim(p_prompt)='' or p_prompt ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then
    raise exception 'HQ_INVALID_MESSAGE' using errcode='22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hq-agent-queue',0));
  if hq_private.founder_uid() is distinct from v_uid then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into v_existing from public.hq_agent_jobs where founder_user_id=v_uid and request_key=p_request_key and agent_id='AG-CEO-001' and kind in ('conversation-ceo','conversation-intake');
  if found then
    select m.text into v_previous from public.hq_agent_messages m where m.id=v_existing.founder_message_id;
    if v_previous is distinct from p_prompt then raise exception 'HQ_REQUEST_KEY_REUSED' using errcode='PT409'; end if;
    return hq_private.agent_snapshot();
  end if;
  if (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and status='queued')>=40
    or (select pg_catalog.count(*) from public.hq_agent_jobs where founder_user_id=v_uid and agent_id='AG-CEO-001' and kind in ('conversation-ceo','conversation-intake')
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
  insert into public.hq_agent_jobs(conversation_id,founder_message_id,founder_user_id,agent_id,request_key,kind)
    values(v_conversation,v_message,v_uid,'AG-CEO-001',p_request_key,'conversation-intake');
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

create or replace function hq_private.create_business_task(p_title text,p_brief text,p_acceptance text,p_assignee_id text,p_request_key uuid) returns jsonb
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
    values(v_conversation,v_message,v_uid,'AG-CEO-001',p_request_key,'task-route',t.id);
  perform hq_private.workforce_wake();
  return hq_private.agent_snapshot();
end $$;

create or replace function hq_private.worker_claim(p_worker_id uuid,p_lease_seconds integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_job public.hq_agent_jobs; v_agent hq_private.agent_roster; v_task public.hq_business_tasks; v_assignee hq_private.agent_roster; v_required text[]; v_files jsonb; v_context jsonb; v_wake timestamptz; v_prompt text; begin
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
    and (x.task_id is null or exists(select 1 from public.hq_business_tasks taskrow where taskrow.id=x.task_id and (taskrow.status not in ('blocked','canceled') or taskrow.status='blocked' and x.kind in ('lesson-extract','lesson-review'))))
    and (x.depends_on is null or exists(select 1 from public.hq_agent_jobs parent where parent.id=x.depends_on and parent.status='completed'))
    order by x.created_at,x.id limit 1 for update skip locked;
  if not found then return jsonb_build_object('job',null); end if;
  select * into v_agent from hq_private.agent_roster where id=v_job.agent_id and enabled;
  if not hq_private.workforce_agent_assignable(v_job.agent_id) then
    return hq_private.workforce_block_claim(v_job,'agent-profile-required');
  end if;
  select * into v_task from public.hq_business_tasks where id=v_job.task_id;
  select * into v_assignee from hq_private.agent_roster where id=v_task.assignee_id;
  -- Fresh role-scoped context: common rules + this employee's own profile and
  -- skills. Index permission is rechecked here; Drive ancestry/revision at host.
  v_required:=array['1IRzs2Q41vfq0ocAT6HB3-bcMDPGTdMx5','1efnq6B7sKn4x099Dv5xsNyFJFIrnC6Xz',
    '1kYDlexJRpJblhEFTq-XSqOEMIDnYdyjf','14A5qRpobLLnX9-e2iJxw7ekB2TB_IBvB','1ayMJWoihUx0rSYCkRc5hotRBRY1AAz9N',v_agent.profile_file_id]
    ||array(select jsonb_array_elements_text(v_agent.skill_file_ids));
  if v_job.kind in ('head-review','ceo-review','task-report','lesson-extract','lesson-review') and v_assignee.id is not null then
    v_required:=v_required||array[v_assignee.profile_file_id]||array(select jsonb_array_elements_text(v_assignee.skill_file_ids));
  end if;
  select array_agg(distinct id) into v_required from unnest(v_required) id where id is not null;
  if cardinality(v_required)>18 then return hq_private.workforce_block_claim(v_job,'role-scope-capacity'); end if;
  select jsonb_agg(jsonb_build_object('id',id) order by id) into v_files from unnest(v_required) id
    where exists(select 1 from hq_private.brain_files f where f.file_id=id and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.in_scope and not f.trashed);
  if coalesce(jsonb_array_length(v_files),0)<>cardinality(v_required) then return hq_private.workforce_block_claim(v_job,'brain-scope-required'); end if;
  select text into v_prompt from public.hq_agent_messages where id=v_job.founder_message_id;
  select * into v_task from public.hq_business_tasks where id=v_job.task_id;
  v_context:=jsonb_build_object('brain_files',v_files,'agent',jsonb_build_object('id',v_agent.id,'name',v_agent.name,'role',v_agent.role,'model',v_agent.model,'effort',v_agent.effort,
    'lifecycle',v_agent.lifecycle,'profileFileId',v_agent.profile_file_id,'skillFileIds',v_agent.skill_file_ids),'mode',v_job.kind,
    'assignee',case when v_assignee.id is null then null else jsonb_build_object('id',v_assignee.id,'name',v_assignee.name,'role',v_assignee.role,'profileFileId',v_assignee.profile_file_id,'skillFileIds',v_assignee.skill_file_ids) end,
    'task',case when v_task.id is null then null else jsonb_build_object('id',v_task.id,'title',v_task.title,'brief',v_task.brief,'acceptance',v_task.acceptance,'assigneeId',v_task.assignee_id,'requestedAssigneeId',v_task.requested_assignee_id,'reviewSummary',v_task.review_summary,'attempt',v_job.attempt,'status',v_task.status,'error',v_task.error) end,
    'artifact',(select jsonb_build_object('id',x.id,'text',x.text,'digest',x.digest,'agentId',x.agent_id,'toolEvidence',coalesce((select receipts.evidence from hq_private.native_tool_receipts receipts
      where receipts.artifact_id=x.id and receipts.artifact_digest=x.digest and receipts.job_id=x.job_id),'[]'::jsonb)) from public.hq_task_artifacts x where x.id=v_job.artifact_id),
    'lesson',(select jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'sourceType',l.source_type,'sourceId',l.source_id,'digest',l.digest) from public.hq_agent_lessons l where l.id=v_job.lesson_id),
    'task_history',case when v_job.kind in ('lesson-extract','lesson-review') and v_job.task_id is not null then (
      select jsonb_agg(jsonb_build_object('id',x.id,'agentId',x.agent_id,'kind',x.kind,'digest',x.digest,'text',left(x.text,2000),'truncated',char_length(x.text)>2000,
          'toolEvidence',case when x.id=(select latest.id from public.hq_task_artifacts latest where latest.task_id=v_job.task_id and latest.kind='task-work' order by latest.created_at desc,latest.id desc limit 1)
            then coalesce((select receipt.evidence from hq_private.native_tool_receipts receipt where receipt.artifact_id=x.id and receipt.artifact_digest=x.digest),'[]'::jsonb) else '[]'::jsonb end) order by x.created_at,x.id)
        from(select * from public.hq_task_artifacts where task_id=v_job.task_id and kind in ('task-work','head-review','ceo-review') order by created_at desc,id desc limit 10) x) else null end,
    'predecessor',(select jsonb_build_object('jobId',x.id,'agentId',x.agent_id,'kind',x.kind,'text',case when v_job.kind='lesson-extract' then null when v_job.kind='conversation-ceo' then coalesce(x.result_text,m.text) else left(coalesce(x.result_text,m.text),8000) end)
      from public.hq_agent_jobs x left join lateral(select text from public.hq_agent_messages m where m.reply_to=x.founder_message_id and m.agent_id=x.agent_id order by created_at desc,id desc limit 1) m on true where x.id=v_job.depends_on),
    'messages',coalesce((select jsonb_agg(jsonb_build_object('role',m.role,'text',m.text) order by m.created_at,m.id) from
      (select x.* from public.hq_agent_messages x where x.conversation_id=v_job.conversation_id and x.id<>v_job.founder_message_id
        and x.created_at<(select created_at from public.hq_agent_messages where id=v_job.founder_message_id) and octet_length(x.text)<=8000
        order by x.created_at desc,x.id desc limit 2) m),'[]'::jsonb),
    'roster',case when v_job.kind in ('task-route','conversation-intake','task-ack') then (select jsonb_agg(jsonb_build_object('id',r.id,'name',r.name,'role',r.role,'departmentKey',r.department_key,'lifecycle',r.lifecycle,'managerId',r.manager_id)) from hq_private.agent_roster r where hq_private.workforce_agent_assignable(r.id) and (v_job.kind<>'task-ack' or r.manager_id=v_job.agent_id)) else null end,
    'learned',coalesce((select jsonb_agg(jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'sourceId',l.source_id,'digest',l.digest)) from
      (select * from public.hq_agent_lessons where founder_user_id=v_job.founder_user_id and status in ('accepted','published')
        and (agent_id=v_job.agent_id or agent_id='AG-CEO-001'
          or (v_job.kind in ('head-review','ceo-review','task-report','lesson-extract','lesson-review') and agent_id=v_task.assignee_id)) order by created_at desc limit 3) l),'[]'::jsonb));
  if octet_length(v_context::text)>245760 then return hq_private.workforce_block_claim(v_job,'context-capacity'); end if;
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
declare v_job public.hq_agent_jobs; v_task public.hq_business_tasks; v_digest text; v_body jsonb; v_artifact uuid; v_lesson uuid; v_next text; v_source text; v_source_id uuid; v_summary text; v_task_body jsonb; v_target hq_private.agent_roster; v_task_id uuid; v_text text; begin
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
  if p_error is null and v_job.kind in ('conversation-intake','task-ack','task-start','task-route','head-review','ceo-review','lesson-extract','lesson-review') then
    begin v_body:=p_reply::jsonb; exception when others then v_body:=null; end;
    if jsonb_typeof(v_body) is distinct from 'object' then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind in ('conversation-intake','task-ack','task-start') and
      (jsonb_typeof(v_body->'message') is distinct from 'string' or coalesce(octet_length(v_body->>'message'),0) not between 1 and 8000 or btrim(v_body->>'message')='' or v_body->>'message' ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]')
      then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind='conversation-intake' then
      if not (v_body ? 'task') then p_error:='stage-output-invalid';
      elsif v_body->'task'<>'null'::jsonb then
        v_task_body:=v_body->'task';
        if jsonb_typeof(v_task_body) is distinct from 'object'
          or jsonb_typeof(v_task_body->'title') is distinct from 'string' or coalesce(char_length(v_task_body->>'title'),0) not between 1 and 180 or btrim(v_task_body->>'title')=''
          or jsonb_typeof(v_task_body->'brief') is distinct from 'string' or coalesce(char_length(v_task_body->>'brief'),0) not between 1 and 12000 or btrim(v_task_body->>'brief')=''
          or jsonb_typeof(v_task_body->'acceptance') is distinct from 'string' or coalesce(char_length(v_task_body->>'acceptance'),0) not between 1 and 6000 or btrim(v_task_body->>'acceptance')=''
          or ((v_task_body->>'title')||(v_task_body->>'brief')||(v_task_body->>'acceptance')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]'
          or not hq_private.workforce_agent_assignable(v_task_body->>'assigneeId') or v_task_body->>'assigneeId'='AG-CEO-001'
          then p_error:='stage-output-invalid'; end if;
        if p_error is null and ((select count(*) from public.hq_business_tasks where founder_user_id=v_job.founder_user_id and status in ('queued','working','review'))>=20
          or (select count(*) from public.hq_business_tasks where founder_user_id=v_job.founder_user_id)>=1000
          or (select coalesce(sum(octet_length(brief)+octet_length(acceptance)),0) from public.hq_business_tasks where founder_user_id=v_job.founder_user_id)>16777216)
          then p_error:='task-capacity'; end if;
        select * into v_target from hq_private.agent_roster where id=v_task_body->>'assigneeId';
        if p_error is null and position('@'||v_target.name in v_body->>'message')=0 then p_error:='stage-output-invalid'; end if;
      end if;
    end if;
    if p_error is null and v_job.kind='task-ack' then
      if not (v_body ? 'delegateId') then p_error:='stage-output-invalid';
      elsif v_body->'delegateId'<>'null'::jsonb then
        select * into v_target from hq_private.agent_roster where id=v_body->>'delegateId' and manager_id=v_job.agent_id and hq_private.workforce_agent_assignable(id);
        if not found or position('@'||v_target.name in v_body->>'message')=0 then p_error:='stage-output-invalid'; end if;
      end if;
    end if;
    if p_error is null and v_job.kind='task-route' and not exists(select 1 from hq_private.agent_roster a
      where a.id=v_body->>'assigneeId' and hq_private.workforce_agent_assignable(a.id) and (a.id<>'AG-CEO-001' or v_task.requested_assignee_id='AG-CEO-001')) then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind='task-route' and
      (jsonb_typeof(coalesce(v_body->'message',v_body->'reason')) is distinct from 'string'
      or coalesce(octet_length(coalesce(v_body->>'message',v_body->>'reason')),0) not between 1 and 8000 or btrim(coalesce(v_body->>'message',v_body->>'reason'))=''
      or coalesce(v_body->>'message',v_body->>'reason') ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]') then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind='task-route' and v_task.requested_assignee_id is not null and v_task.requested_assignee_id is distinct from v_body->>'assigneeId' then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind in ('head-review','ceo-review','lesson-review') and
      (jsonb_typeof(v_body->'accepted') is distinct from 'boolean' or jsonb_typeof(v_body->'summary') is distinct from 'string'
      or coalesce(octet_length(v_body->>'summary'),0) not between 1 and 8000 or btrim(v_body->>'summary')='' or v_body->>'summary' ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]') then p_error:='stage-output-invalid'; end if;
    if p_error is null and v_job.kind in ('head-review','ceo-review') and not exists(select 1 from public.hq_task_artifacts a
      where a.id=v_job.artifact_id and a.digest=v_body->>'artifactDigest' and a.task_id=v_job.task_id) then p_error:='review-digest-mismatch'; end if;
    if p_error is null and v_job.kind='lesson-extract' and (jsonb_typeof(v_body->'summary') is distinct from 'string' or jsonb_typeof(v_body->'body') is distinct from 'string'
      or coalesce(char_length(v_body->>'summary'),0) not between 1 and 240 or btrim(v_body->>'summary')=''
      or coalesce(octet_length(v_body->>'body'),0) not between 1 and 8000 or btrim(v_body->>'body')=''
      or ((v_body->>'summary')||(v_body->>'body')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]') then p_error:='stage-output-invalid'; end if;
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
  if v_job.kind='conversation-intake' then
    if v_task_body is not null then
      insert into public.hq_business_tasks(founder_user_id,conversation_id,founder_message_id,request_key,title,brief,acceptance,assignee_id)
        values(v_job.founder_user_id,v_job.conversation_id,v_job.founder_message_id,v_job.request_key,v_task_body->>'title',v_task_body->>'brief',v_task_body->>'acceptance',v_task_body->>'assigneeId') returning id into v_task_id;
      update public.hq_agent_jobs set task_id=v_task_id where id=v_job.id;
      v_job.task_id:=v_task_id;
      perform hq_private.chat_message(v_job,v_body->>'message','handoff',array[v_task_body->>'assigneeId']);
      perform hq_private.workforce_enqueue(v_job,'task-ack',v_task_body->>'assigneeId');
    else
      perform hq_private.chat_message(v_job,v_body->>'message','message');
      perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_artifact);
    end if;
  elsif v_job.kind in ('task-ack','task-start') then
    if v_job.kind='task-ack' and v_body->'delegateId'<>'null'::jsonb then
      perform hq_private.chat_message(v_job,v_body->>'message','handoff',array[v_body->>'delegateId']);
      update public.hq_business_tasks set assignee_id=v_body->>'delegateId',updated_at=clock_timestamp() where id=v_job.task_id;
      perform hq_private.workforce_enqueue(v_job,'task-start',v_body->>'delegateId',v_job.artifact_id,null,v_job.attempt);
    else
      perform hq_private.chat_message(v_job,v_body->>'message','acknowledgement');
      perform hq_private.workforce_enqueue(v_job,'task-work',v_job.agent_id,v_job.artifact_id,null,v_job.attempt);
    end if;
  elsif v_job.kind='conversation-hr' then null; -- Legacy pending jobs retain their predecessor.

  elsif v_job.kind='conversation-ceo' then
    perform hq_private.chat_message(v_job,p_reply,'message');
    perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_artifact);
  elsif v_job.kind='task-route' then
    update public.hq_business_tasks set assignee_id=v_body->>'assigneeId',updated_at=clock_timestamp() where id=v_job.task_id;
    select * into v_target from hq_private.agent_roster where id=v_body->>'assigneeId';
    v_text:=coalesce(nullif(v_body->>'message',''),nullif(v_body->>'reason',''),'I have reviewed this task and assigned its delivery.');
    if position('@'||v_target.name in v_text)=0 then v_text:='@'||v_target.name||' '||v_text; end if;
    perform hq_private.chat_message(v_job,v_text,'handoff',array[v_target.id]);
    perform hq_private.workforce_enqueue(v_job,'task-ack',v_target.id,null,null,0);
  elsif v_job.kind='task-work' then
    v_next:=case when v_job.agent_id in ('AG-HR-002','AG-HR-003','AG-CEO-001') then 'head-review' else 'ceo-review' end;
    perform hq_private.workforce_enqueue(v_job,v_next,case when v_next='head-review' then 'AG-HR-001' else 'AG-CEO-001' end,v_artifact,null,v_job.attempt);
  elsif v_job.kind in ('head-review','ceo-review') then
    update public.hq_business_tasks set review_summary=v_body->>'summary',updated_at=clock_timestamp() where id=v_job.task_id;
    if (v_body->>'accepted')::boolean then
      if v_job.kind='head-review' then perform hq_private.workforce_enqueue(v_job,'ceo-review','AG-CEO-001',v_job.artifact_id,null,v_job.attempt);
      else
        update public.hq_business_tasks set deliverable=(select text from public.hq_task_artifacts where id=v_job.artifact_id) where id=v_job.task_id;
        perform hq_private.workforce_enqueue(v_job,'task-report',v_task.assignee_id,v_job.artifact_id,null,v_job.attempt);
      end if;
    elsif v_task.repair_count<2 then
      update public.hq_business_tasks set repair_count=repair_count+1,status='queued',updated_at=clock_timestamp() where id=v_job.task_id;
      select * into v_target from hq_private.agent_roster where id=v_task.assignee_id;
      perform hq_private.chat_message(v_job,'@'||v_target.name||' '||(v_body->>'summary'),'recovery',array[v_target.id]);
      perform hq_private.workforce_enqueue(v_job,'task-start',v_task.assignee_id,v_job.artifact_id,null,v_task.repair_count+1);
    else
      update public.hq_business_tasks set status='blocked',error='review-repairs-exhausted',updated_at=clock_timestamp(),completed_at=clock_timestamp() where id=v_job.task_id;
      perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_job.artifact_id);
    end if;
  elsif v_job.kind='task-report' then
    perform hq_private.chat_message(v_job,p_reply,'task-result');
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

-- Renaming a private projection does not update public SQL wrappers by text.
-- Reassert least-privilege entry points; no table access is added.
revoke all on function hq_private.worker_claim(uuid,integer),hq_private.worker_finish(uuid,uuid,uuid,text,text),
  hq_private.send_ceo_message(text,uuid),hq_private.create_business_task(text,text,text,text,uuid) from public,anon,service_role;

-- Forward-only native tool receipts. Author prose is never a tool receipt.
create table hq_private.native_tool_receipts (
  job_id uuid primary key references public.hq_agent_jobs(id),
  artifact_id uuid not null unique references public.hq_task_artifacts(id),
  worker_id uuid not null references hq_private.agent_workers(worker_id),
  artifact_digest text not null check(artifact_digest ~ '^[0-9a-f]{64}$'),
  evidence jsonb not null check(jsonb_typeof(evidence)='array' and jsonb_array_length(evidence)<=24 and octet_length(evidence::text)<=40000),
  evidence_digest text not null check(evidence_digest ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp()
);
alter table hq_private.native_tool_receipts enable row level security;
revoke all on hq_private.native_tool_receipts from public,anon,authenticated,service_role;
create trigger hq_native_receipt_immutable before update or delete on hq_private.native_tool_receipts
  for each row execute function hq_private.immutable_record();

create function hq_private.validate_tool_evidence(p_evidence jsonb) returns void
language plpgsql security definer set search_path='' as $$ declare receipt jsonb; item jsonb; begin
  if jsonb_typeof(p_evidence) is distinct from 'array' or jsonb_array_length(p_evidence)>24 or octet_length(p_evidence::text)>40000 then
    raise exception 'HQ_INVALID_TOOL_EVIDENCE' using errcode='22023'; end if;
  for receipt in select * from jsonb_array_elements(p_evidence) loop
    if jsonb_typeof(receipt) is distinct from 'object' or (select count(*) from jsonb_object_keys(receipt))<>8
      or exists(select 1 from jsonb_object_keys(receipt) k where k not in ('eventId','tool','action','queries','sources','observedAt','truncated','version'))
      or receipt->>'tool' is distinct from 'web_search' or receipt->'version' is distinct from '1'::jsonb
      or coalesce(receipt->>'eventId','') !~ '^[A-Za-z0-9_-]{1,200}$'
      or coalesce(receipt->>'action','') !~ '^[a-z_ -]{1,60}$'
      or jsonb_typeof(receipt->'queries') is distinct from 'array' or jsonb_array_length(receipt->'queries')>8
      or jsonb_typeof(receipt->'sources') is distinct from 'array' or jsonb_array_length(receipt->'sources')>8
      or jsonb_typeof(receipt->'truncated') is distinct from 'boolean'
      or coalesce(receipt->>'observedAt','') !~ '^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9:.]+Z$' then
      raise exception 'HQ_INVALID_TOOL_EVIDENCE' using errcode='22023'; end if;
    for item in select * from jsonb_array_elements(receipt->'queries') loop
      if jsonb_typeof(item) is distinct from 'string' or char_length(item#>>'{}') not between 1 and 400
        or item#>>'{}' ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then raise exception 'HQ_INVALID_TOOL_EVIDENCE' using errcode='22023'; end if;
    end loop;
    for item in select * from jsonb_array_elements(receipt->'sources') loop
      if jsonb_typeof(item) is distinct from 'object' or (select count(*) from jsonb_object_keys(item))<>3
        or exists(select 1 from jsonb_object_keys(item) k where k not in ('url','title','excerpt'))
        or coalesce(item->>'url','') !~ '^https://[^[:space:]@]+$' or char_length(item->>'url')>500
        or not (item->'title'='null'::jsonb or jsonb_typeof(item->'title')='string' and char_length(item->>'title')<=240)
        or not (item->'excerpt'='null'::jsonb or jsonb_typeof(item->'excerpt')='string' and octet_length(item->>'excerpt')<=1200)
        or (coalesce(item->>'title','')||coalesce(item->>'excerpt','')) ~ '[\x01-\x08\x0B\x0C\x0E-\x1F]' then
        raise exception 'HQ_INVALID_TOOL_EVIDENCE' using errcode='22023'; end if;
    end loop;
  end loop;
end $$;
revoke all on function hq_private.validate_tool_evidence(jsonb) from public,anon,authenticated,service_role;

-- Preserve original artifact/message behavior; exhausted reviews now learn from
-- the actually rejected output and its real immutable review trail.
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
    else
      update public.hq_business_tasks set status='blocked',error='review-repairs-exhausted',updated_at=clock_timestamp(),completed_at=clock_timestamp() where id=v_job.task_id;
      perform hq_private.workforce_enqueue(v_job,'lesson-extract','AG-HR-001',v_job.artifact_id);
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


create function hq_private.worker_finish_v2(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb) returns jsonb
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
create function public.hq_worker_finish_v2(p_job_id uuid,p_lease_token uuid,p_worker_id uuid,p_reply text,p_error text,p_evidence jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select hq_private.worker_finish_v2(p_job_id,p_lease_token,p_worker_id,p_reply,p_error,p_evidence); $$;
revoke all on function hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb),public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function hq_private.worker_finish_v2(uuid,uuid,uuid,text,text,jsonb),public.hq_worker_finish_v2(uuid,uuid,uuid,text,text,jsonb) to authenticated;

-- Only host-authenticated receipts bound to this exact immutable artifact reach
-- reviewers. No legacy prose is promoted into an observation retroactively.
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
    'task',case when v_task.id is null then null else jsonb_build_object('id',v_task.id,'title',v_task.title,'brief',v_task.brief,'acceptance',v_task.acceptance,'assigneeId',v_task.assignee_id,'attempt',v_job.attempt,'status',v_task.status,'error',v_task.error) end,
    'artifact',(select jsonb_build_object('id',x.id,'text',x.text,'digest',x.digest,'agentId',x.agent_id,'toolEvidence',coalesce((select receipts.evidence from hq_private.native_tool_receipts receipts
      where receipts.artifact_id=x.id and receipts.artifact_digest=x.digest and receipts.job_id=x.job_id),'[]'::jsonb)) from public.hq_task_artifacts x where x.id=v_job.artifact_id),
    'lesson',(select jsonb_build_object('id',l.id,'summary',l.summary,'body',l.body,'sourceType',l.source_type,'sourceId',l.source_id,'digest',l.digest) from public.hq_agent_lessons l where l.id=v_job.lesson_id),
    'task_history',case when v_job.kind in ('lesson-extract','lesson-review') and v_job.task_id is not null then (
      select jsonb_agg(jsonb_build_object('id',x.id,'agentId',x.agent_id,'kind',x.kind,'digest',x.digest,'text',left(x.text,2000),'truncated',char_length(x.text)>2000,
          'toolEvidence',case when x.id=(select latest.id from public.hq_task_artifacts latest where latest.task_id=v_job.task_id and latest.kind='task-work' order by latest.created_at desc,latest.id desc limit 1)
            then coalesce((select receipt.evidence from hq_private.native_tool_receipts receipt where receipt.artifact_id=x.id and receipt.artifact_digest=x.digest),'[]'::jsonb) else '[]'::jsonb end) order by x.created_at,x.id)
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


-- Existing exhausted real tasks get learning, not another task inference. This
-- is bounded to source-backed failures, never canceled or uncertain execution.
do $$ declare parent public.hq_agent_jobs; begin
  for parent in select distinct on(j.task_id) j.* from public.hq_agent_jobs j join public.hq_business_tasks t on t.id=j.task_id
    where t.status='blocked' and t.error='review-repairs-exhausted' and j.kind in ('head-review','ceo-review') and j.status='completed'
      and j.artifact_id is not null and not exists(select 1 from public.hq_agent_jobs lesson where lesson.task_id=t.id and lesson.kind='lesson-extract')
    order by j.task_id,j.created_at desc,j.id desc limit 40
  loop perform hq_private.workforce_enqueue(parent,'lesson-extract','AG-HR-001',parent.artifact_id); end loop;
  if found then perform hq_private.workforce_wake(); end if;
end $$;

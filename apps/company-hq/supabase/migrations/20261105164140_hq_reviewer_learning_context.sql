-- Forward-only: an actual task reviewer receives the scoped accepted learning
-- of its actual assignee, in addition to its own/CEO learning. Founder, status
-- filtering, payload bounds and the existing three-lesson limit are preserved.

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



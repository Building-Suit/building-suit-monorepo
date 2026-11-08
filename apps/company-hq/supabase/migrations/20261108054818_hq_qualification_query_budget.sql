-- Bound qualification planning without changing evidence, role or lifecycle rules.
-- Current agent/source binding is materialized once per skill predicate. The
-- remaining receipt/artifact/host/reviewer joins retain every original check.
-- No persistent cache, timeout increase, new API grant or lease change.
begin;
set local lock_timeout='10s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

create or replace function hq_private.workforce_skill_evidence_valid(p_agent_id text,p_skill_file_id text) returns boolean
language sql stable security definer set search_path='' as $$
with current_agent as materialized (
  select r.*,hq_private.workforce_agent_binding_digest(r.id) as current_binding_digest
  from hq_private.agent_roster r
  join hq_private.agent_roster m on m.id=r.manager_id
  join hq_private.brain_files e on e.file_id=r.profile_file_id and e.in_scope and not e.trashed
  where r.id=p_agent_id and r.enabled and r.model_tier='T1_WORKER'
    and m.model_tier='T2_HEAD' and r.department_key=m.department_key
)
select exists(select 1 from current_agent r
  join hq_private.workforce_qualification_receipts q on q.agent_id=r.id
  join hq_private.workforce_trials t on t.id=q.trial_id and t.status='passed'
  join public.hq_task_artifacts a on a.id=q.evidence_artifact_id and a.id=t.artifact_id and a.task_id=t.task_id
  join hq_private.workforce_trial_host_execution_receipts x on x.id=q.host_execution_id
    and x.trial_id=t.id and x.agent_id=r.id and x.artifact_id=a.id and x.artifact_digest=a.digest
    and x.worker_job_id=a.job_id and x.outcome='completed' and x.provider_served_model='unknown'
    and x.attestation_level='host-returned-resolution'
    and x.configured_model=r.model and x.launch_model=r.model
    and x.configured_effort=r.effort and x.launch_effort=r.effort
    and x.host_returned_model=r.model and x.host_returned_effort=r.effort and x.host_returned_thread_id=x.thread_id
  join public.hq_agent_jobs review on review.id=q.review_job_id and review.id=t.review_job_id
  where t.skill_file_id=p_skill_file_id
    and q.scope='bounded-drafting-v1' and q.reviewer_id='AG-HR-003' and review.agent_id='AG-HR-003'
    and review.kind='ceo-review' and review.status='completed' and review.result_text::jsonb->>'accepted'='true'
    and q.binding_digest=r.current_binding_digest
    and q.profile_file_id=r.profile_file_id and q.skill_file_ids=r.skill_file_ids
    and q.model_tier=r.model_tier and q.manager_id=r.manager_id and q.department_key=r.department_key);
$$;
revoke all on function hq_private.workforce_skill_evidence_valid(text,text) from public,anon,authenticated,service_role;

-- Qualification context is null exactly when the current subject is unqualified.
-- Reuse only within this context build, never across subjects or requests.
create or replace function hq_private.task_evidence_context(p_job public.hq_agent_jobs,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_context jsonb:=p_context; v_task public.hq_business_tasks;
  v_assignee_qualification jsonb; v_artifact_qualification jsonb; v_assignee_checked boolean:=false;
  v_history jsonb; v_delegations jsonb; v_history_truncated boolean:=false; v_delegations_truncated boolean:=false; v_artifact public.hq_task_artifacts;
begin
  if p_job.task_id is null or p_job.kind not in ('task-work','head-review','ceo-review','task-report')
    or exists(select 1 from hq_private.workforce_trials where task_id=p_job.task_id)
    then return v_context; end if;
  select * into v_task from public.hq_business_tasks
    where id=p_job.task_id and founder_user_id=p_job.founder_user_id
      and conversation_id=p_job.conversation_id and founder_message_id=p_job.founder_message_id;
  if v_task.id is null then raise exception 'HQ_TASK_EVIDENCE_SCOPE_INVALID' using errcode='22023'; end if;

  -- Qualification is current, subject-specific server evidence, never profile prose.
  if v_context->'assignee'->>'id'=v_task.assignee_id then
    v_assignee_qualification:=hq_private.workforce_qualification_context(v_task.assignee_id);
    v_assignee_checked:=true;
    v_context:=jsonb_set(v_context,'{assignee}',v_context->'assignee'||jsonb_build_object(
      'qualification',v_assignee_qualification,
      'qualified',v_assignee_qualification is not null));
  end if;
  select a.* into v_artifact from public.hq_task_artifacts a
    join public.hq_agent_jobs j on j.id=a.job_id and j.task_id=a.task_id
    where a.id=p_job.artifact_id and a.task_id=v_task.id
      and j.founder_user_id=p_job.founder_user_id and j.conversation_id=p_job.conversation_id
      and j.founder_message_id=p_job.founder_message_id and j.status='completed';
  if v_artifact.id is not null and v_context->'artifact'->>'id'=v_artifact.id::text
    and v_context->'artifact'->>'digest'=v_artifact.digest then
    if v_assignee_checked and v_artifact.agent_id=v_task.assignee_id then
      v_artifact_qualification:=v_assignee_qualification;
    else
      v_artifact_qualification:=hq_private.workforce_qualification_context(v_artifact.agent_id);
    end if;
    v_context:=jsonb_set(v_context,'{artifact}',v_context->'artifact'||jsonb_build_object(
      'jobId',v_artifact.job_id,
      'authorQualification',v_artifact_qualification,
      'authorQualified',v_artifact_qualification is not null));
  end if;

  -- Receipts retain their ORIGINAL artifact, digest and job identity. Never copy
  -- old receipt evidence onto the current artifact or manufacture a new receipt.
  select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'jobId',a.job_id,
    'agentId',a.agent_id,'kind',a.kind,'digest',a.digest,'text',left(a.text,2000),
    'truncated',char_length(a.text)>2000,
    'toolEvidence',coalesce(r.evidence,'[]'::jsonb)) order by a.created_at,a.id),'[]'::jsonb)
    into v_history
    from (
      select x.* from public.hq_task_artifacts x
      join public.hq_agent_jobs j on j.id=x.job_id and j.task_id=x.task_id
      where x.task_id=v_task.id and x.kind in ('task-work','head-review','ceo-review')
        and j.founder_user_id=p_job.founder_user_id and j.conversation_id=p_job.conversation_id
        and j.founder_message_id=p_job.founder_message_id and j.status='completed'
      order by x.created_at desc,x.id desc limit 11
    ) a left join hq_private.native_tool_receipts r
      on r.artifact_id=a.id and r.artifact_digest=a.digest and r.job_id=a.job_id;
  select coalesce(jsonb_agg(jsonb_build_object('jobId',j.id,'agentId',j.agent_id,
    'kind',j.kind,'attempt',j.attempt,'assigneeId',j.result_text::jsonb->'assigneeId',
    'delegateId',j.result_text::jsonb->'delegateId',
    'message',left(j.result_text::jsonb->>'message',8000),
    'reason',left(j.result_text::jsonb->>'reason',2000),
    'truncated',coalesce(char_length(j.result_text::jsonb->>'message')>8000,false)
      or coalesce(char_length(j.result_text::jsonb->>'reason')>2000,false))
    order by j.created_at,j.id),'[]'::jsonb)
    into v_delegations from (
      select x.* from public.hq_agent_jobs x
      where x.task_id=v_task.id and x.founder_user_id=p_job.founder_user_id
        and x.conversation_id=p_job.conversation_id and x.founder_message_id=p_job.founder_message_id
        and x.kind in ('task-route','task-ack') and x.status='completed'
      order by x.created_at desc,x.id desc limit 11
    ) j;
  -- Admit newest entries deterministically; retain original evidence verbatim.
  -- Omission is explicit, never presented as a complete task record.
  while jsonb_array_length(v_history)>10 or octet_length(v_history::text)>81920 loop
    v_history:=v_history-0; v_history_truncated:=true;
  end loop;
  while jsonb_array_length(v_delegations)>10 or octet_length(v_delegations::text)>81920 loop
    v_delegations:=v_delegations-0; v_delegations_truncated:=true;
  end loop;
  loop
    v_context:=v_context||jsonb_build_object('task_history',v_history,'taskDelegations',v_delegations,
      'taskHistoryTruncated',v_history_truncated,'taskDelegationsTruncated',v_delegations_truncated);
    exit when octet_length(v_context::text)<=245760;
    if jsonb_array_length(v_history)>0 then
      v_history:=v_history-0; v_history_truncated:=true;
    elsif jsonb_array_length(v_delegations)>0 then
      v_delegations:=v_delegations-0; v_delegations_truncated:=true;
    else
      -- Required current artifact/qualification stays intact. The existing
      -- pre-lease context-capacity gate handles an oversized required packet.
      exit;
    end if;
  end loop;
  return v_context;
end $$;
revoke all on function hq_private.task_evidence_context(public.hq_agent_jobs,jsonb)
  from public,anon,authenticated,service_role;

commit;

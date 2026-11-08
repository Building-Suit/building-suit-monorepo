-- SOURCE PROPOSAL ONLY: CLI-generated migration and disposable SQL verification pending.
-- Ordinary task evidence continuity only. No qualification, tools or authority changes.
begin;
set local lock_timeout='10s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(hashtextextended('hq-agent-queue',0));

create function hq_private.task_evidence_context(p_job public.hq_agent_jobs,p_context jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_context jsonb:=p_context; v_task public.hq_business_tasks;
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
    v_context:=jsonb_set(v_context,'{assignee}',v_context->'assignee'||jsonb_build_object(
      'qualification',hq_private.workforce_qualification_context(v_task.assignee_id),
      'qualified',hq_private.workforce_agent_qualified(v_task.assignee_id)));
  end if;
  select a.* into v_artifact from public.hq_task_artifacts a
    join public.hq_agent_jobs j on j.id=a.job_id and j.task_id=a.task_id
    where a.id=p_job.artifact_id and a.task_id=v_task.id
      and j.founder_user_id=p_job.founder_user_id and j.conversation_id=p_job.conversation_id
      and j.founder_message_id=p_job.founder_message_id and j.status='completed';
  if v_artifact.id is not null and v_context->'artifact'->>'id'=v_artifact.id::text
    and v_context->'artifact'->>'digest'=v_artifact.digest then
    v_context:=jsonb_set(v_context,'{artifact}',v_context->'artifact'||jsonb_build_object(
      'jobId',v_artifact.job_id,
      'authorQualification',hq_private.workforce_qualification_context(v_artifact.agent_id),
      'authorQualified',hq_private.workforce_agent_qualified(v_artifact.agent_id)));
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

-- Enrich BEFORE the existing capacity gate/lease write, not after claiming.
-- Replace in place to preserve OIDs and every admission/meeting/workforce wrapper.
do $$
declare
  v_fn regprocedure:='hq_private.worker_claim_before_meetings(uuid,integer)'::regprocedure;
  v_definition text; v_anchor text:='  if octet_length(v_context::text)>245760 then return hq_private.workforce_block_claim(v_job,''context-capacity''); end if;';
begin
  v_definition:=pg_get_functiondef(v_fn);
  if (length(v_definition)-length(replace(v_definition,v_anchor,'')))/length(v_anchor)<>1
    or position('hq_private.task_evidence_context' in v_definition)>0
    then raise exception 'HQ_TASK_EVIDENCE_CONTEXT_SOURCE_MISMATCH'; end if;
  execute replace(v_definition,v_anchor,
    '  v_context:=hq_private.task_evidence_context(v_job,v_context);'||chr(10)||v_anchor);
end $$;
commit;

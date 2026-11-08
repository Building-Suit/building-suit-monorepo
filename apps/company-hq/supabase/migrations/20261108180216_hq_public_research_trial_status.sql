-- Founder-only additive projection for the existing Research capability trial.
-- No trial, receipt, lifecycle or tool authority is created by this read.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $$ declare d text:=pg_get_functiondef('hq_private.workforce_trial_status()'::regprocedure); copied text;
begin
  copied:=replace(d,'FUNCTION hq_private.workforce_trial_status()',
    'FUNCTION hq_private.workforce_trial_status_before_public_research()');
  if copied=d then raise exception 'HQ_RESEARCH_STATUS_SOURCE_MISMATCH'; end if;
  execute copied;
end $$;
revoke all on function hq_private.workforce_trial_status_before_public_research() from public,anon,authenticated,service_role;

create or replace function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=hq_private.founder_uid(); result jsonb; a hq_private.agent_roster; m hq_private.agent_roster;
  t hq_private.workforce_trials; skill_id text; qualified boolean:=false; eligible boolean:=false;
  binding_current boolean:=false; review_complete boolean:=false; reviewer_ready boolean:=false; research jsonb;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  result:=hq_private.workforce_trial_status_before_public_research();
  select * into a from hq_private.agent_roster where id='AG-RES-002' and enabled;
  if a.id is null then return result; end if;
  select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
  select skill.value into skill_id from jsonb_array_elements_text(a.skill_file_ids) skill(value)
    join hq_private.brain_files f on f.file_id=skill.value and f.in_scope and not f.trashed
      and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8' and f.source_version is not null
    order by skill.value limit 1;
  qualified:=coalesce(hq_private.public_discovery_qualified(a.id),false);
  reviewer_ready:=exists(select 1 from hq_private.agent_roster iris
    join hq_private.brain_files profile on profile.file_id=iris.profile_file_id
    where iris.id='AG-HR-003' and iris.enabled and hq_private.workforce_agent_assignable(iris.id)
      and profile.in_scope and not profile.trashed and profile.source_version is not null
      and profile.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8');
  eligible:=coalesce(a.model_tier='T1_WORKER' and a.department_key='research-market-intelligence'
    and a.manager_id='AG-RES-001' and m.model_tier='T2_HEAD' and m.department_key=a.department_key
    and hq_private.workforce_agent_assignable(m.id) and reviewer_ready
    and a.lifecycle ~* '(configured|trial|pending|active)'
    and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
    and jsonb_array_length(a.skill_file_ids) between 1 and 10 and skill_id is not null
    and exists(select 1 from hq_private.brain_files p where p.file_id=a.profile_file_id
      and p.in_scope and not p.trashed and p.source_version is not null)
    and not exists(select 1 from hq_private.workforce_trials active_trial where active_trial.agent_id=a.id
      and active_trial.status='active' and active_trial.expires_at>clock_timestamp()) and not qualified,false);
  select * into t from hq_private.workforce_trials where agent_id=a.id and requested_by=uid
    and purpose='public-research-tool-trial-v1' order by created_at desc,id desc limit 1;
  binding_current:=coalesce(t.id is not null and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
    and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest('AG-HR-003'),false);
  -- Mirror the existing issuance prerequisites conservatively. In particular,
  -- a passed label alone is neither an independent review nor host evidence.
  review_complete:=coalesce(binding_current and t.status='passed' and t.completed_at<=t.expires_at
    and a.model_tier='T1_WORKER' and a.manager_id='AG-RES-001' and m.id='AG-RES-001'
    and m.model_tier='T2_HEAD' and m.department_key=a.department_key
    and hq_private.workforce_agent_assignable(m.id)
    and a.lifecycle ~* '(configured|trial|pending|active)'
    and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
    and reviewer_ready
    and hq_private.public_discovery_trial_source_valid(t.id,t.artifact_id)
    and exists(select 1 from public.hq_business_tasks task
      join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and artifact.task_id=task.id and artifact.agent_id=a.id
      join public.hq_agent_jobs review on review.id=t.review_job_id and review.task_id=task.id
        and review.kind='ceo-review' and review.agent_id='AG-HR-003' and review.status='completed'
        and review.result_text::jsonb->'accepted'='true'::jsonb
      join public.hq_agent_jobs head_review on head_review.id=review.depends_on and head_review.task_id=task.id
        and head_review.kind='head-review' and head_review.agent_id='AG-RES-001' and head_review.status='completed'
        and head_review.result_text::jsonb->'accepted'='true'::jsonb
      join hq_private.workforce_trial_host_execution_receipts execution on execution.trial_id=t.id
        and execution.agent_id=a.id and execution.artifact_id=artifact.id and execution.artifact_digest=artifact.digest
        and execution.outcome='completed' and execution.provider_served_model='unknown'
        and execution.attestation_level='host-returned-resolution'
        and execution.configured_model=a.model and execution.launch_model=a.model
        and execution.configured_effort=a.effort and execution.launch_effort=a.effort
        and execution.host_returned_model=a.model and execution.host_returned_effort=a.effort
        and execution.host_returned_thread_id=execution.thread_id
      where task.id=t.task_id and task.founder_user_id=uid and task.status='completed'
        and exists(select 1 from public.hq_agent_jobs report where report.task_id=task.id and report.kind='task-report' and report.status='completed')
        and exists(select 1 from public.hq_agent_jobs learning where learning.task_id=task.id and learning.kind='lesson-extract'
          and learning.status='blocked' and learning.error='trial-learning-disabled')),false);
  research:=jsonb_build_object('skillFileId',skill_id,'eligible',eligible,'qualified',qualified,
    'trialId',t.id,'status',t.status,'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),
    'reviewComplete',review_complete,'bindingCurrent',binding_current,'taskId',t.task_id);
  return coalesce((select jsonb_agg(case when row->>'agentId'='AG-RES-002'
    then row||jsonb_build_object('publicResearch',research) else row end order by ordinal)
    from jsonb_array_elements(result) with ordinality entries(row,ordinal)),'[]'::jsonb);
end $$;
commit;

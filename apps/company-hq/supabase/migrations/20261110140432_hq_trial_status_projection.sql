-- Reuse current qualification evidence within one founder status read.
-- No new index, timeout increase, result cache, grant, or write-path change.
begin;
do $guard$
begin
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.workforce_trial_status_before_public_retail()')) is distinct from 'a2bbffcbf0b7f944601f6923cffc29da' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:workforce_trial_status_before_public_retail'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.workforce_trial_status_before_evaluator()')) is distinct from 'b80627cd79e148cbfd727e7c0735dbcf' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:workforce_trial_status_before_evaluator'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.workforce_trial_status_before_public_research()')) is distinct from '69318771988051fdf4c4152c7e543dbc' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:workforce_trial_status_before_public_research'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.workforce_trial_status()')) is distinct from '24988c0bb30e0a27426073f48e690a7b' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:workforce_trial_status'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.repository_agent_ready(text)')) is distinct from 'b33fddb7f8bbc4a1b61973b370e8fae3' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:repository_agent_ready'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.repository_qualified(text)')) is distinct from '597d4720e6c0df826832683f425d68e0' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:repository_qualified'; end if;
  if (select md5(prosrc) from pg_proc where oid=to_regprocedure('hq_private.workforce_agent_qualified(text)')) is distinct from 'e74e35ec90670b8d35acce9b87ebdabc' then raise exception 'HQ_TRIAL_STATUS_PREDECESSOR_MISMATCH:workforce_agent_qualified'; end if;
end
$guard$;

create or replace function hq_private.workforce_trial_status_before_public_retail() returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare result jsonb; skill_status jsonb;
begin
 if hq_private.founder_uid() is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;

  -- One statement-local evidence evaluation per assigned skill. No table/session
  -- cache, no client-supplied verdict, and the authoritative predicate is unchanged.
  with agents as materialized (
    select * from hq_private.agent_roster where enabled and model_tier='T1_WORKER'
  ), skills as materialized (
    select a.id as agent_id,s.value as skill_id,
      hq_private.workforce_skill_evidence_valid(a.id,s.value) as valid
    from agents a cross join lateral jsonb_array_elements_text(a.skill_file_ids) s(value)
  )
  select coalesce(jsonb_object_agg(a.id,jsonb_build_object(
    'qualified',jsonb_array_length(a.skill_file_ids) between 1 and 10
      and a.lifecycle !~* '(configured|candidate|trial|pending|suspended|inactive|retired|terminated|archived|paused|testing-only)'
      and not exists(select 1 from skills s where s.agent_id=a.id and not s.valid),
    'nextSkillId',(select s.skill_id from skills s where s.agent_id=a.id and not s.valid order by s.skill_id limit 1),
    'ordinarySkill',(select jsonb_build_object('id',s.skill_id,'name',left(f.name,160))
      from skills s join hq_private.brain_files f on f.file_id=s.skill_id
        and f.in_scope and not f.trashed and f.source_version is not null
        and f.root_id='1JgnIBa6As96sdOQn1z3rcQpwDyAvcZm8'
      where s.agent_id=a.id and not s.valid order by s.skill_id limit 1)
  )),'{}'::jsonb) into skill_status from agents a;
  result:=coalesce((select jsonb_agg(jsonb_build_object('agentId',a.id,'skillFileId',(skill_status->a.id->>'nextSkillId'),
    'eligible',a.model_tier='T1_WORKER' and a.lifecycle ~* '(configured|trial|pending)' and (skill_status->a.id->>'nextSkillId') is not null
      and not coalesce(t.status='active' and t.expires_at>clock_timestamp(),false),
    'qualified',coalesce((skill_status->a.id->>'qualified')::boolean,false),'trialId',t.id,'status',t.status,
    'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),
    'reviewComplete',coalesce(t.status='passed' and exists(select 1 from public.hq_agent_jobs j
      where j.task_id=t.task_id and j.kind='task-report' and j.status='completed'),false)) order by a.id)
    from hq_private.agent_roster a left join lateral
      (select id,status,task_id,expires_at from hq_private.workforce_trials where agent_id=a.id
        and requested_by=hq_private.founder_uid() order by created_at desc,id desc limit 1) t on true
    where a.enabled and a.model_tier='T1_WORKER'),'[]'::jsonb);

 <<public_research>>
declare uid uuid:=hq_private.founder_uid(); a hq_private.agent_roster; m hq_private.agent_roster;
  t hq_private.workforce_trials; skill_id text; qualified boolean:=false; eligible boolean:=false;
  binding_current boolean:=false; review_complete boolean:=false; reviewer_ready boolean:=false; research jsonb;
begin
  if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
  select * into a from hq_private.agent_roster where id='AG-RES-002' and enabled;
  if a.id is null then exit public_research; end if;
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
  result:=coalesce((select jsonb_agg(case when row->>'agentId'='AG-RES-002'
    then row||jsonb_build_object('publicResearch',research) else row end order by ordinal)
    from jsonb_array_elements(result) with ordinality entries(row,ordinal)),'[]'::jsonb);
end;

 <<ordinary_trials>>
declare uid uuid:=hq_private.founder_uid(); row jsonb; a hq_private.agent_roster; m hq_private.agent_roster;
 t hq_private.workforce_trials; skill_id text; skill_name text; reviewer text; ready boolean; eligible boolean; qualified boolean; current_binding boolean; ordinary jsonb;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501'; end if;
 for row in select value from jsonb_array_elements(result) loop
  select * into a from hq_private.agent_roster where id=row->>'agentId' and enabled and model_tier='T1_WORKER';
  if a.id is null then continue; end if;
  select * into m from hq_private.agent_roster where id=a.manager_id and enabled;
  reviewer:=case when a.id='AG-HR-003' then 'AG-CEO-001' else 'AG-HR-003' end;
  ready:=coalesce(hq_private.trial_evaluator_ready(reviewer),false);
  qualified:=coalesce((row->>'qualified')::boolean,false);
  skill_id:=skill_status->a.id->'ordinarySkill'->>'id';
  skill_name:=skill_status->a.id->'ordinarySkill'->>'name';
  select * into t from hq_private.workforce_trials where agent_id=a.id and requested_by=uid
   and purpose in ('synthetic-internal-trial-v1','evaluator-skill-trial-v1') order by created_at desc,id desc limit 1;
  current_binding:=coalesce(t.id is not null and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
   and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest(reviewer),false);
  eligible:=coalesce(ready and not qualified and skill_id is not null and jsonb_array_length(a.skill_file_ids) between 1 and 10
   and a.lifecycle ~* case when a.id='AG-HR-003' then '(configured|trial|pending|active)' else '(configured|trial|pending)' end
   and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
   and m.model_tier='T2_HEAD' and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id)
   and a.id<>reviewer and a.manager_id<>reviewer
   and (a.id<>'AG-HR-003' or a.manager_id='AG-HR-001' and a.department_key='hr-agent-development')
   and exists(select 1 from hq_private.brain_files f where f.file_id=a.profile_file_id and f.in_scope and not f.trashed and f.source_version is not null)
   and not exists(select 1 from hq_private.workforce_trials active_trial where active_trial.agent_id=a.id
    and active_trial.status='active' and active_trial.expires_at>clock_timestamp()),false);
  ordinary:=jsonb_build_object('skillFileId',skill_id,'skillName',skill_name,'eligible',eligible,'qualified',qualified,
   'reviewerId',reviewer,'reviewerReady',ready,'trialId',t.id,'status',t.status,'bindingCurrent',current_binding,
   'reviewComplete',coalesce(hq_private.trial_review_ready(t.id),false),
   'receiptIssued',exists(select 1 from hq_private.workforce_qualification_receipts q where q.trial_id=t.id),'taskId',t.task_id);
  result:=jsonb_set(result,array[(select (ordinal-1)::text from jsonb_array_elements(result) with ordinality e(value,ordinal) where value->>'agentId'=a.id)],row||jsonb_build_object('ordinary',ordinary));
 end loop;
end;
 return result;
end $function$;

create or replace function hq_private.workforce_trial_status() returns jsonb
language plpgsql stable security definer set search_path='' as $function$
declare uid uuid:=hq_private.founder_uid(); result jsonb; row jsonb; agent text; b hq_private.repository_bundles;
 t hq_private.workforce_trials; rt hq_private.repository_tasks; ready boolean; current_binding boolean; qualified boolean; budget integer; projection jsonb;
begin
 if uid is null then raise exception 'HQ_FOUNDER_REQUIRED' using errcode='42501';end if;
 result:=hq_private.workforce_trial_status_before_repository();budget:=hq_private.repository_budget_remaining();
 for row in select value from jsonb_array_elements(result) loop
 agent:=row->>'agentId';if hq_private.repository_preset(agent) is null then continue;end if;
 ready:=coalesce((hq_private.repository_preset(agent) is not null and hq_private.repository_skill(agent) is not null
 and coalesce((row->>'qualified')::boolean,false) and exists(select 1 from hq_private.agent_roster a
 join hq_private.agent_roster m on m.id=a.manager_id and m.id='AG-DEV-001' and m.enabled and m.model_tier='T2_HEAD'
 where a.id=agent and a.enabled and a.model_tier='T1_WORKER' and a.department_key='development-maintenance'
 and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id))
 and hq_private.trial_evaluator_ready('AG-HR-003')),false);qualified:=coalesce((ready and exists(select 1 from hq_private.repository_qualifications q
 join hq_private.workforce_trials qualification_trial on qualification_trial.id=q.trial_id and qualification_trial.agent_id=q.agent_id and qualification_trial.artifact_id=q.evidence_artifact_id and qualification_trial.requested_by=q.authorized_by
 where q.agent_id=agent and q.reviewer_binding=qualification_trial.reviewer_binding_digest and q.preset=hq_private.repository_preset(agent)
 and q.binding_digest=hq_private.workforce_agent_binding_digest(agent)
 and q.manifest_digest=hq_private.repository_manifest_digest() and hq_private.repository_review_ready(q.trial_id))),false);
 select * into b from hq_private.repository_bundles where founder_id=uid and agent_id=agent order by created_at desc,id desc limit 1;
 select * into t from hq_private.workforce_trials where requested_by=uid and agent_id=agent and purpose='public-repository-read-trial-v1' order by created_at desc,id desc limit 1;
 current_binding:=coalesce(b.id is not null and b.binding_digest=hq_private.workforce_agent_binding_digest(agent)
 and b.manager_binding=hq_private.workforce_agent_binding_digest('AG-DEV-001') and b.reviewer_binding=hq_private.workforce_agent_binding_digest('AG-HR-003'),false);
 projection:=jsonb_build_object('preset',hq_private.repository_preset(agent),'skillFileId',hq_private.repository_skill(agent),
 'freezeEligible',ready,'eligible',ready and not qualified and current_binding and b.expires_at>clock_timestamp() and budget>=12
 and not exists(select 1 from hq_private.workforce_trials active_trial where active_trial.agent_id=agent and active_trial.status='active' and active_trial.expires_at>clock_timestamp()),
 'qualified',qualified,'reviewerReady',hq_private.trial_evaluator_ready('AG-HR-003'),'bundleId',b.id,'sha',b.selection->>'sha',
 'mode',b.selection->>'mode','pullRequestNumber',b.selection->'pullRequestNumber','predecessorArtifactId',b.predecessor_artifact_id,
 'expiresAt',b.expires_at,'trialId',t.id,'taskId',t.task_id,'status',t.status,'bindingCurrent',current_binding,
 'receiptIssued',exists(select 1 from hq_private.repository_qualifications q where q.trial_id=t.id),
 'reviewComplete',coalesce(hq_private.repository_review_ready(t.id),false),'budgetRemaining',budget);
 result:=jsonb_set(result,array[(select (ordinal-1)::text from jsonb_array_elements(result) with ordinality e(value,ordinal) where value->>'agentId'=agent)],row||jsonb_build_object('repository',projection));
 end loop;return result;
end $function$;

commit;

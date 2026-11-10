-- Reuse the evidence SELECT plan, never its result. Each call still reads its
-- statement snapshot. Preserve the MATERIALIZED binding and every predicate.
-- This bounded optimization does not establish the cause of a hosted timeout.
begin;

-- Fail closed rather than creating a new function with default PUBLIC execution.
-- The expected predecessor is the reviewed SQL predicate, not a live-state guess.
do $guard$
begin
 if not exists (
  select 1 from pg_proc p join pg_language l on l.oid=p.prolang
  where p.oid=to_regprocedure('hq_private.workforce_skill_evidence_valid(text,text)')
   and l.lanname='sql' and md5(p.prosrc)='330fc6bb9768fd162e7537dbac2e8a1b'
 ) then
  raise exception 'HQ_SKILL_EVIDENCE_PLAN_PREDECESSOR_MISMATCH';
 end if;
end
$guard$;

CREATE OR REPLACE FUNCTION hq_private.workforce_skill_evidence_valid(p_agent_id text, p_skill_file_id text)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return (with current_agent as materialized (
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
    and q.scope='bounded-drafting-v1' and q.agent_id<>q.reviewer_id and q.manager_id<>q.reviewer_id and (
   (q.reviewer_id='AG-HR-003' and review.agent_id='AG-HR-003' and t.purpose<>'evaluator-skill-trial-v1')
   or (q.reviewer_id='AG-CEO-001' and review.agent_id='AG-CEO-001' and r.id='AG-HR-003' and r.manager_id='AG-HR-001'
    and t.purpose='evaluator-skill-trial-v1' and hq_private.trial_review_ready(t.id)))
    and review.kind='ceo-review' and review.status='completed' and review.result_text::jsonb->>'accepted'='true'
    and q.binding_digest=r.current_binding_digest
    and q.profile_file_id=r.profile_file_id and q.skill_file_ids=r.skill_file_ids
    and q.model_tier=r.model_tier and q.manager_id=r.manager_id and q.department_key=r.department_key));
end
$function$
;

commit;

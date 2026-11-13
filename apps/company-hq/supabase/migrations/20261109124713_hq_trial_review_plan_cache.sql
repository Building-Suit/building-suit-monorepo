-- Keep the exact current evidence predicate and function identity.
-- Cache a plan, not a result: each call evaluates the current statement snapshot.
-- No worker gate, timeout, queue, lease, receipt or API contract changes.
begin;

CREATE OR REPLACE FUNCTION hq_private.trial_review_ready(p_trial_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 return (select exists(select 1 from hq_private.workforce_trials t
 join hq_private.agent_roster a on a.id=t.agent_id and a.enabled and a.model_tier='T1_WORKER'
 join hq_private.agent_roster m on m.id=t.manager_id and m.id=a.manager_id and m.enabled and m.model_tier='T2_HEAD'
 join public.hq_business_tasks task on task.id=t.task_id and task.founder_user_id=t.requested_by and task.status='completed'
 join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and artifact.task_id=task.id and artifact.agent_id=a.id
 join public.hq_agent_jobs review on review.id=t.review_job_id and review.task_id=task.id and review.artifact_id=artifact.id
  and review.kind='ceo-review' and review.agent_id=hq_private.trial_evaluator(task.id) and review.status='completed'
  and review.result_text::jsonb->>'accepted'='true' and review.result_text::jsonb->>'artifactDigest'=artifact.digest
 join public.hq_agent_jobs head on head.id=review.depends_on and head.task_id=task.id and head.artifact_id=artifact.id
  and head.kind='head-review' and head.agent_id=m.id and head.status='completed'
  and head.result_text::jsonb->>'accepted'='true' and head.result_text::jsonb->>'artifactDigest'=artifact.digest
 join hq_private.workforce_trial_host_execution_receipts x on x.trial_id=t.id and x.agent_id=a.id
  and x.artifact_id=artifact.id and x.artifact_digest=artifact.digest and x.worker_job_id=artifact.job_id
  and x.outcome='completed' and x.provider_served_model='unknown' and x.attestation_level='host-returned-resolution'
  and x.configured_model=a.model and x.launch_model=a.model and x.configured_effort=a.effort and x.launch_effort=a.effort
  and x.host_returned_model=a.model and x.host_returned_effort=a.effort and x.host_returned_thread_id=x.thread_id
 where t.id=p_trial_id and t.status='passed' and t.completed_at<=t.expires_at
  and a.lifecycle ~* case when t.purpose='evaluator-skill-trial-v1' then '(configured|trial|pending|active)' else '(configured|trial|pending)' end
  and a.lifecycle !~* '(suspended|inactive|retired|terminated|archived|paused|testing-only)'
  and m.department_key=a.department_key and hq_private.workforce_agent_assignable(m.id)
  and t.binding_digest=hq_private.workforce_trial_binding_digest(a.id)
  and t.reviewer_binding_digest=hq_private.workforce_agent_binding_digest(hq_private.trial_evaluator(task.id))
  and hq_private.trial_evaluator_ready(hq_private.trial_evaluator(task.id))
  and a.id<>review.agent_id and m.id<>review.agent_id
  and exists(select 1 from public.hq_agent_jobs r where r.task_id=task.id and r.kind='task-report' and r.status='completed')
  and exists(select 1 from public.hq_agent_jobs l where l.task_id=task.id and l.kind='lesson-extract' and l.status='blocked' and l.error='trial-learning-disabled')));
end
$function$
;

-- Retain the existing private-only execution contract.
revoke all on function hq_private.trial_review_ready(uuid) from public,anon,authenticated,service_role;

commit;

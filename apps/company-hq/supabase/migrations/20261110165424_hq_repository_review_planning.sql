-- Reuse the current repository proof plan and bound its join search.
-- No result cache, timeout/global setting change, grant or evidence mutation.
begin;
do $guard$
begin
 if not exists(
  select 1 from pg_catalog.pg_proc p join pg_catalog.pg_language l on l.oid=p.prolang
  where p.oid=pg_catalog.to_regprocedure('hq_private.repository_review_ready(uuid)')
   and p.prokind='f' and p.pronargs=1 and p.prorettype='pg_catalog.bool'::pg_catalog.regtype
   and l.lanname='sql' and p.prosecdef and p.provolatile='s' and not p.proisstrict
   and p.proconfig=array['search_path=""']::text[]
   and pg_catalog.md5(p.prosrc)='328a9a163dcaa3880b8e4679969599c8'
 ) then
  raise exception 'HQ_REPOSITORY_REVIEW_PLANNING_PREDECESSOR_MISMATCH' using errcode='55000';
 end if;
end
$guard$;

create or replace function hq_private.repository_review_ready(p_trial uuid) returns boolean
language plpgsql stable security definer set search_path='' set join_collapse_limit='1' as $function$
begin
 -- Necessary conditions already present in the exact proof below. Missing and
 -- NULL trial inputs still return false. STABLE preserves one statement snapshot.
 if not exists(select 1 from hq_private.workforce_trials t
  where t.id=p_trial and t.purpose='public-repository-read-trial-v1'
   and t.manager_id='AG-DEV-001' and t.status='passed' and t.completed_at<=t.expires_at) then
  return false;
 end if;
 -- Preserve the complete current proof, including the reviewed worker-digest
 -- allowlist. Local join planning also applies to nested helpers during this call.
 return (
 select exists(select 1 from hq_private.workforce_trials t
 join hq_private.repository_tasks rt on rt.trial_id=t.id and rt.task_id=t.task_id
 join hq_private.repository_bundles b on b.id=rt.bundle_id and b.agent_id=t.agent_id and b.founder_id=t.requested_by
 join public.hq_business_tasks task on task.id=t.task_id and task.founder_user_id=t.requested_by and task.status='completed'
 join public.hq_task_artifacts artifact on artifact.id=t.artifact_id and artifact.task_id=task.id and artifact.agent_id=b.agent_id
 join public.hq_agent_jobs review on review.id=t.review_job_id and review.task_id=task.id and review.artifact_id=artifact.id
 and review.agent_id='AG-HR-003' and review.kind='ceo-review' and review.status='completed'
 and review.result_text::jsonb->>'accepted'='true' and review.result_text::jsonb->>'artifactDigest'=artifact.digest
 join public.hq_agent_jobs head on head.id=review.depends_on and head.task_id=task.id and head.artifact_id=artifact.id
 and head.agent_id='AG-DEV-001' and head.kind='head-review' and head.status='completed'
 and head.result_text::jsonb->>'accepted'='true' and head.result_text::jsonb->>'artifactDigest'=artifact.digest
 join hq_private.repository_host_executions execution on execution.job_id=artifact.job_id and execution.artifact_id=artifact.id
 and execution.artifact_digest=artifact.digest and execution.outcome='completed'
 where t.id=p_trial and t.purpose='public-repository-read-trial-v1' and t.manager_id='AG-DEV-001' and t.status='passed'
 and t.completed_at<=t.expires_at and hq_private.repository_agent_ready(t.agent_id)
 and t.binding_digest=hq_private.workforce_agent_binding_digest(t.agent_id) and b.binding_digest=t.binding_digest
 and b.reviewer_binding=hq_private.workforce_agent_binding_digest('AG-HR-003') and t.reviewer_binding_digest=b.reviewer_binding
 and b.manager_binding=hq_private.workforce_agent_binding_digest('AG-DEV-001')
 and b.manifest_digest=hq_private.repository_manifest_digest() and b.criteria=hq_private.repository_criteria(b.agent_id)
 and rt.task_digest=hq_private.repository_task_digest(task.id)
 and hq_private.repository_worker_digest_allowed(execution.proof->>'workerSourceDigest')
 and execution.proof->'publicRepositoryPolicy'->>'moduleSha256'=hq_private.repository_module_digest()
 and hq_private.repository_source_valid(task.id,artifact.id)
 and exists(select 1 from public.hq_agent_jobs report where report.task_id=task.id and report.kind='task-report' and report.status='completed')
 and exists(select 1 from public.hq_agent_jobs lesson where lesson.task_id=task.id and lesson.kind='lesson-extract' and lesson.status='blocked' and lesson.error='trial-learning-disabled'))
);
end
$function$;

commit;

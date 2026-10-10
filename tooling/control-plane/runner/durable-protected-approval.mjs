// Read authenticated owner receipts. A scheduling revision is not a source
// revision. This fallback is limited to a current RESTORE-111 frozen queue;
// changed contracts, verification, actors or source subjects remain denied.
export const durableProtectedApprovalSql = `
WITH subject AS (
 SELECT t.*, c.contract_fingerprint, c.input_generation, c.valid,
 e.execution_id, e.status AS execution_status, v.verification_run_id,
 md5(jsonb_build_object('allowed_paths',t.metadata->'allowed_paths','acceptance',t.acceptance_criteria,'title',t.title,'description',t.description,
 'requirements',(SELECT jsonb_agg(to_jsonb(link) ORDER BY link.requirement_id) FROM control.task_requirements link WHERE link.task_id=t.task_id),
 'decisions',(SELECT jsonb_agg(to_jsonb(link) ORDER BY link.decision_id) FROM control.task_decisions link WHERE link.task_id=t.task_id))::text) AS scope_fingerprint,
 v.status AS verification_status, v.metadata AS verification_metadata,
 md5(jsonb_build_object('task_id',t.task_id,'verification_plan',t.verification_plan,
 'project_verification_config',p.verification_config,
 'workstream_verification_config',w.verification_config)::text) AS verification_fingerprint
 FROM control.tasks t JOIN control.publication_readiness_contracts c USING(task_id)
 JOIN control.task_admission_generations generation ON generation.task_id=t.task_id AND generation.input_generation=c.input_generation
 JOIN control.projects p USING(project_id)
 JOIN control.workstreams w ON w.project_id=t.project_id AND w.slug=t.workstream_slug
 JOIN LATERAL (SELECT * FROM control.executions WHERE task_id=t.task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1) e ON true
 JOIN LATERAL (SELECT * FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1) v ON true
 WHERE t.task_id=:'task_id'
), eligible AS (
 SELECT a.*, s.verification_metadata, r.current_task_id,
 s.status AS task_status, s.execution_status, s.verification_status
 FROM subject s JOIN control.operator_authority_events a ON a.task_id=s.task_id
 JOIN control.operator_actors actor USING(actor_id)
 JOIN control.workflow_runs r USING(run_id)
 WHERE a.action='protected-publication' AND a.response='approve' AND actor.enabled
 AND r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
 AND r.max_tasks=(a.offer->>'max_tasks')::integer
 AND control.unattended_queue_task_current(r.run_id,s.task_id)
 AND s.valid AND a.offer->>'contract_fingerprint'=s.contract_fingerprint
 AND a.offer->>'scope_fingerprint'=s.scope_fingerprint
 AND (a.offer->>'input_generation')::bigint=s.input_generation
 AND (a.offer->>'execution_id')::bigint=s.execution_id
 AND (a.offer->>'verification_run_id')::bigint=s.verification_run_id
 AND a.offer->>'verification_fingerprint'=s.verification_fingerprint
 AND a.offer->>'verified_state_fingerprint'=s.verification_metadata#>>'{verified_state,fingerprint}'
 AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events rev
 WHERE rev.run_id=a.run_id AND rev.gate_fingerprint=a.gate_fingerprint AND rev.response='revoke')
 AND jsonb_array_length(a.offer->'protected_files')>0
 AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(a.offer->'protected_files') f
 WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(s.verification_metadata#>'{verified_state,files}') vf
 WHERE vf->>'file'=f->>'path' AND vf->>'object'=f->>'object'))
)
SELECT coalesce((SELECT offer||jsonb_build_object(
 'authorized',current_task_id=task_id AND task_status='passed' AND execution_status='succeeded' AND verification_status='passed',
 'subject_current',true,'event_id',event_id,'authority_kind','durable-owner-source-receipt')
 FROM eligible ORDER BY event_id DESC LIMIT 1),'{"authorized":false,"subject_current":false}'::jsonb);
`;

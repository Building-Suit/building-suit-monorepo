BEGIN;
-- Owner-authorized 2026-10-09 Draft-source policy amendment. This is not a BS22
-- approval event and does not change frozen queue grants, task scope or history.
CREATE FUNCTION control.queue_draft_source_policy(p_task text) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE;e control.executions%ROWTYPE;v control.verification_runs%ROWTYPE;g jsonb;ancillary jsonb:='[]';
BEGIN
 SELECT run.* INTO r FROM control.workflow_runs run WHERE run.run_id IN('06124632-a51d-4d08-bb62-ee4e8cedb9dc','2518c051-fb28-4641-ae03-c046d7c30807','1a75a547-3372-4e2a-b51c-3b1b2bf9ad81') AND control.unattended_queue_task_current(run.run_id,p_task) ORDER BY started_at DESC LIMIT 1;
 IF r.run_id IS NULL THEN RETURN NULL;END IF;
 g:=control.unattended_queue_grant(r.run_id);
 IF g IS NULL OR (g->>'event_id')::bigint NOT IN(17,18,19) THEN RETURN NULL;END IF;
 IF NOT EXISTS(SELECT 1 FROM control.workstreams WHERE project_id=r.project_id AND slug=r.workstream_slug AND publication_config->>'merge_authorized'='false' AND publication_config->>'deployment_authorized'='false' AND publication_config->>'hosted_database_changes_authorized'='false') THEN RETURN NULL;END IF;
 SELECT * INTO e FROM control.executions WHERE task_id=p_task ORDER BY execution_id DESC LIMIT 1;
 SELECT * INTO v FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1;
 IF e.execution_id IS NULL OR v.status IS DISTINCT FROM 'passed' OR NOT control.publication_execution_is_eligible(p_task,e.execution_id) OR e.branch_name !~ '^codex/' OR e.branch_name IN('main','stg') OR e.parent_sha !~ '^[a-f0-9]{40}$' OR v.metadata#>>'{verified_state,fingerprint}' IS NULL THEN RETURN NULL;END IF;
 -- Exact verifier-only exception reviewed against the independently passing 359
 -- baseline. No wildcard tooling authority and no task scope/frozen-grant edits.
 IF p_task='SS-LAUNCH-SOLO-VARIANTS-001' AND e.execution_id=324 AND e.parent_sha='e64116c20923e124f3b8cab312e12aa95bc00026' THEN
 ancillary:='[{"file":"tooling/database/test-shop-plan-limits-local.mjs","object":"8fa7484032e4e670d1efbef020ac0c3d611a2c3a"}]';END IF;
 RETURN jsonb_build_object('version',1,'mode','verified-source-draft-only','authorization','owner-policy-amendment-2026-10-09','run_id',r.run_id,'queue_event',g->'event_id','task_id',p_task,'execution_id',e.execution_id,'verification_run_id',v.verification_run_id,'parent_sha',e.parent_sha,'state_fingerprint',v.metadata#>>'{verified_state,fingerprint}','files',v.metadata#>'{verified_state,files}','ancillary',ancillary,'merge',false,'deploy',false,'hosted_sql',false);
END $$;
ALTER FUNCTION control.queue_draft_source_policy(text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.queue_draft_source_policy(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.queue_draft_source_policy(text) TO bs_control_executor,bs_runtime_executor;
DO $amend$
DECLARE original text;
BEGIN
 original:=pg_get_functiondef('control.current_run_publication_authority(text)'::regprocedure);
 IF position('RETURN receipt||jsonb_build_object' in original)=0 THEN RAISE EXCEPTION 'draft_authority_baseline_mismatch';END IF;
 original:=replace(original,'''queue_authority_event'',control.unattended_queue_grant(owning_run)->''event_id''','''queue_authority_event'',control.unattended_queue_grant(owning_run)->''event_id'',''draft_source_policy'',control.queue_draft_source_policy(p_task)');
 EXECUTE original;
 original:=pg_get_functiondef('control.operator_task_gate_snapshot(uuid)'::regprocedure);
 IF position('IF protected_files IS NOT NULL THEN' in original)=0 THEN RAISE EXCEPTION 'draft_gate_baseline_mismatch';END IF;
 original:=replace(original,'IF protected_files IS NOT NULL THEN','IF protected_files IS NOT NULL AND control.queue_draft_source_policy(t.task_id) IS NULL THEN');
 EXECUTE original;
END $amend$;
COMMIT;

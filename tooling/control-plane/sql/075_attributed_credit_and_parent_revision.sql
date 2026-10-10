BEGIN;
ALTER FUNCTION control.record_workflow_task_success(uuid,text,text) RENAME TO record_workflow_task_success_publication_v1;
CREATE FUNCTION control.record_workflow_task_success(p_run uuid,p_task text,p_key text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 PERFORM 1 FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF EXISTS(SELECT 1 FROM control.workflow_run_task_credits WHERE run_id=p_run AND task_id=p_task) THEN RETURN control.record_workflow_task_success_publication_v1(p_run,p_task,p_key);END IF;
 IF p_key IS DISTINCT FROM p_run::text||':'||p_task THEN RAISE EXCEPTION 'canonical_attributed_completion_key_required';END IF;
 IF NOT EXISTS(
 SELECT 1 FROM control.workflow_runs r JOIN control.tasks t ON t.task_id=r.current_task_id
 JOIN control.executions e ON e.task_id=t.task_id AND e.execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id=t.task_id)
 JOIN control.verification_runs v ON v.execution_id=e.execution_id AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id)
 JOIN control.task_events event ON event.task_id=t.task_id AND event.event_type='publication_completed' AND (event.payload->>'verification_run_id')::bigint=v.verification_run_id
 JOIN control.pull_requests pr ON pr.task_id=t.task_id AND pr.repository=event.payload->>'repository' AND pr.pr_number=(event.payload->>'pr_number')::integer AND pr.head_sha=event.payload->>'head_sha' AND pr.head_branch=e.branch_name
 WHERE r.run_id=p_run AND t.task_id=p_task AND t.status='complete' AND control.publication_execution_is_eligible(t.task_id,e.execution_id) AND v.status='passed' AND coalesce(pr.head_sha,'') ~ '^[a-f0-9]{40}$') THEN RAISE EXCEPTION 'exact_publication_verification_identity_required_for_credit';END IF;
 RETURN control.record_workflow_task_success_publication_v1(p_run,p_task,p_key);
END $$;
REVOKE ALL ON FUNCTION control.record_workflow_task_success_publication_v1(uuid,text,text),control.record_workflow_task_success(uuid,text,text) FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT EXECUTE ON FUNCTION control.record_workflow_task_success(uuid,text,text) TO bs_control_app;
CREATE TABLE control.execution_parent_revisions(
 revision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,execution_id bigint NOT NULL REFERENCES control.executions,
 original_parent_branch text,original_parent_sha text,new_parent_branch text NOT NULL,new_parent_sha text NOT NULL CHECK(new_parent_sha ~ '^[a-f0-9]{40}$'),snapshot_path text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.execution_parent_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY parent_revision_read ON control.execution_parent_revisions FOR SELECT TO bs_control_app,bs_control_observer USING(true);
REVOKE ALL ON control.execution_parent_revisions FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.execution_parent_revisions TO bs_control_app,bs_control_observer;
CREATE FUNCTION control.record_trusted_task_reparent(p_task text,p_execution bigint,p_old_branch text,p_old_sha text,p_new_branch text,p_new_sha text,p_snapshot text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e control.executions%ROWTYPE;t control.tasks%ROWTYPE;id bigint;
BEGIN
 SELECT * INTO t FROM control.tasks WHERE task_id=p_task FOR UPDATE;
 SELECT * INTO e FROM control.executions WHERE execution_id=p_execution AND task_id=p_task FOR UPDATE;
 IF NOT FOUND OR e.status<>'succeeded' OR t.status NOT IN('passed','failed','verification') OR e.parent_branch IS DISTINCT FROM p_old_branch OR e.parent_sha IS DISTINCT FROM p_old_sha OR e.execution_id<>(SELECT max(execution_id) FROM control.executions WHERE task_id=p_task) OR EXISTS(SELECT 1 FROM control.pull_requests WHERE task_id=p_task) THEN RAISE EXCEPTION 'current_unpublished_parent_revision_required';END IF;
 INSERT INTO control.execution_parent_revisions(execution_id,original_parent_branch,original_parent_sha,new_parent_branch,new_parent_sha,snapshot_path) VALUES(p_execution,p_old_branch,p_old_sha,p_new_branch,p_new_sha,p_snapshot);
 UPDATE control.executions SET parent_branch=p_new_branch,parent_sha=p_new_sha,engine_stage='reverification_required' WHERE execution_id=p_execution;
 UPDATE control.tasks SET status='verification',engine_stage='reverification_required' WHERE task_id=p_task;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task,'task_reparented',t.status,'verification','runner',jsonb_build_object('execution_id',p_execution,'old_parent',jsonb_build_object('branch',p_old_branch,'sha',p_old_sha),'new_parent',jsonb_build_object('branch',p_new_branch,'sha',p_new_sha),'snapshot',p_snapshot)) RETURNING event_id INTO id;
 RETURN jsonb_build_object('recorded',true,'event_id',id);
END $$;
REVOKE ALL ON FUNCTION control.record_trusted_task_reparent(text,bigint,text,text,text,text,text) FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT EXECUTE ON FUNCTION control.record_trusted_task_reparent(text,bigint,text,text,text,text,text) TO bs_control_verifier;
COMMIT;

BEGIN;
CREATE FUNCTION control.reconcile_dot_recovery_completion() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE settled integer;
BEGIN
 UPDATE control.dot_recovery_jobs j SET status='resolved',claim_token=NULL,claim_until=NULL,updated_at=now(),
 evidence=evidence||jsonb_build_object('resolved_by','authoritative_lifecycle_transition','resolved_at',now())
 FROM control.workflow_runs r WHERE r.run_id=j.run_id AND j.status IN('queued','running')
 AND ((j.task_id IS NULL AND r.current_task_id IS NOT NULL)
 OR (j.task_id IS NOT NULL AND r.current_task_id IS DISTINCT FROM j.task_id
 AND EXISTS(SELECT 1 FROM control.tasks t JOIN control.pull_requests p USING(task_id)
 WHERE t.task_id=j.task_id AND t.status='complete' AND p.is_draft AND p.metadata->>'verification_run_id' IS NOT NULL
 AND EXISTS(SELECT 1 FROM control.verification_runs v JOIN control.executions e USING(execution_id)
 WHERE e.task_id=t.task_id AND v.verification_run_id::text=p.metadata->>'verification_run_id' AND v.status='passed'))));
 GET DIAGNOSTICS settled=ROW_COUNT;
 UPDATE control.dot_incidents i SET status='resolved',claim_until=NULL WHERE EXISTS(SELECT 1 FROM control.dot_recovery_jobs j WHERE j.incident_id=i.incident_id AND j.status='resolved');
 RETURN settled;
END $$;
REVOKE ALL ON FUNCTION control.reconcile_dot_recovery_completion() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.reconcile_dot_recovery_completion() TO bs_control_app;
CREATE OR REPLACE FUNCTION control.finish_dot_recovery(p_id uuid,p_token uuid,p_status text,p_evidence jsonb,p_runtime text DEFAULT NULL,p_regression text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE j control.dot_recovery_jobs%ROWTYPE; ex bigint; cls text;
BEGIN
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_id FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR p_status NOT IN('queued','running','resolved','human-gate') THEN RETURN false;END IF;
 IF p_runtime IS NOT NULL THEN
 IF p_runtime !~ '^[0-9a-f]{40}$' OR p_regression NOT LIKE 'tooling/control-plane/tests/%' OR p_evidence->>'regression_passed' IS DISTINCT FROM 'true' THEN RAISE EXCEPTION 'Verified runtime/regression evidence required';END IF;
 cls:=coalesce(p_evidence->>'failure_class','TRANSIENT_INFRASTRUCTURE');
 IF cls NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE') THEN RAISE EXCEPTION 'Reviewed structured incident classification required';END IF;
 SELECT execution_id INTO ex FROM control.dot_incidents WHERE incident_id=p_id;
 IF ex IS NOT NULL AND p_evidence->>'product_source_unchanged'='true' THEN
 INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence) VALUES(ex,cls,md5(control.retry_evidence_fingerprint(ex)||p_runtime),'dot',p_evidence||jsonb_build_object('incident_id',p_id,'basis','isolated runtime-only fix and executed regression; mandatory same-attempt verification remains required')) ON CONFLICT DO NOTHING;
 END IF;
 INSERT INTO control.dot_recovery_catalog VALUES(j.root_family,cls,'run-recover',p_regression,p_runtime,j.incident_id,now())
 ON CONFLICT(root_family) DO UPDATE SET compatible_runtime=excluded.compatible_runtime,regression_test=excluded.regression_test,learned_from=excluded.learned_from,failure_class=excluded.failure_class;
 END IF;
 UPDATE control.dot_recovery_jobs SET status=p_status,evidence=evidence||p_evidence,owner=CASE WHEN p_evidence->>'recovery_owner'='Codex' THEN 'Codex' ELSE owner END,action=CASE WHEN p_evidence->>'recovery_owner'='Codex' THEN 'incident-investigate' ELSE action END,
 claim_until=CASE WHEN p_status='running' THEN now()+interval '3 minutes' ELSE NULL END,
 next_check_at=now()+interval '2 minutes',updated_at=now() WHERE incident_id=p_id;
 UPDATE control.dot_incidents SET status=CASE WHEN p_status='resolved' THEN 'resolved' WHEN p_status='human-gate' THEN 'operator-gate' ELSE 'recovering' END WHERE incident_id=p_id;
 RETURN true;
END $$;

COMMIT;

BEGIN;
-- Separate the task engine's durable inbox from Dot's observation outbox.
CREATE TABLE control.supervisor_wakes(
 run_id uuid PRIMARY KEY REFERENCES control.workflow_runs,
 event_id bigint NOT NULL DEFAULT 0, version bigint NOT NULL DEFAULT 1,
 pending boolean NOT NULL DEFAULT true, due_at timestamptz NOT NULL DEFAULT now(),
 claim_token uuid, claim_until timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE control.recovery_action_claims(
 task_id text NOT NULL REFERENCES control.tasks, execution_id bigint NOT NULL REFERENCES control.executions,
 action text NOT NULL CHECK(action IN('task-verify','task-reaccept')),
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 classification text NOT NULL CHECK(classification IN('VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','EXTERNAL_EVIDENCE')),
 evidence jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(task_id,execution_id,action,fingerprint)
);
ALTER TABLE control.supervisor_wakes OWNER TO bs_control_migration_owner;
ALTER TABLE control.recovery_action_claims OWNER TO bs_control_migration_owner;
ALTER TABLE control.supervisor_wakes ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.recovery_action_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.supervisor_wakes,control.recovery_action_claims FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
CREATE TRIGGER immutable_control_evidence BEFORE UPDATE OR DELETE ON control.recovery_action_claims FOR EACH ROW EXECUTE FUNCTION control.reject_append_only_mutation();

CREATE FUNCTION control.enqueue_supervisor_wake(p_run uuid,p_event bigint DEFAULT 0)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.workflow_runs r WHERE r.run_id=p_run AND r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks) THEN RETURN;END IF;
 INSERT INTO control.supervisor_wakes(run_id,event_id) VALUES(p_run,p_event)
 ON CONFLICT(run_id) DO UPDATE SET event_id=greatest(control.supervisor_wakes.event_id,excluded.event_id),version=control.supervisor_wakes.version+1,pending=true,due_at=now(),updated_at=now()
 WHERE p_event=0 OR excluded.event_id>control.supervisor_wakes.event_id;
END $$;
CREATE FUNCTION control.supervisor_state_signal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r record; task text:=NEW.payload->>'task_id'; subject uuid:=NULLIF(NEW.payload->>'run_id','')::uuid;
BEGIN
 IF NEW.wake_kind<>'state' OR NEW.origin IN('recovery_states','product_attempt_classifications') OR NEW.payload->>'event_type'='retry_exhaustion_audited' THEN RETURN NEW;END IF;
 FOR r IN SELECT run_id FROM control.workflow_runs wr WHERE wr.status='running' AND
 (wr.run_id=subject OR wr.current_task_id=task OR
 EXISTS(SELECT 1 FROM control.dot_task_scope_authorities scope WHERE scope.run_id=wr.run_id AND scope.task_id=task) OR
 EXISTS(SELECT 1 FROM control.batch_task_admissions scope WHERE scope.run_id=wr.run_id AND scope.task_id=task) OR
 EXISTS(SELECT 1 FROM control.task_dependencies dep WHERE dep.depends_on_task_id=task AND dep.dependency_type='hard' AND
 (EXISTS(SELECT 1 FROM control.dot_task_scope_authorities scope WHERE scope.run_id=wr.run_id AND scope.task_id=dep.task_id) OR EXISTS(SELECT 1 FROM control.batch_task_admissions scope WHERE scope.run_id=wr.run_id AND scope.task_id=dep.task_id))))
 LOOP PERFORM control.enqueue_supervisor_wake(r.run_id,NEW.event_id);END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER supervisor_authoritative_state AFTER INSERT OR UPDATE OF event_id ON control.dot_wake_events FOR EACH ROW EXECUTE FUNCTION control.supervisor_state_signal();

CREATE FUNCTION control.claim_supervisor_wake()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE w control.supervisor_wakes%ROWTYPE;
BEGIN
 SELECT q.* INTO w FROM control.supervisor_wakes q JOIN control.workflow_runs r USING(run_id)
 WHERE q.pending AND q.due_at<=now() AND (q.claim_until IS NULL OR q.claim_until<=now()) AND r.status='running' AND NOT r.stop_requested AND NOT r.maintenance_requested AND r.completed_tasks<r.max_tasks
 ORDER BY q.due_at,q.run_id FOR UPDATE OF q SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL;END IF;
 UPDATE control.supervisor_wakes SET claim_token=gen_random_uuid(),claim_until=now()+interval '3 minutes' WHERE run_id=w.run_id RETURNING * INTO w;
 RETURN jsonb_build_object('run_id',w.run_id,'version',w.version,'claim_token',w.claim_token);
END $$;
CREATE FUNCTION control.finish_supervisor_wake(p_run uuid,p_token uuid,p_version bigint,p_retry_seconds integer DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF p_retry_seconds IS NOT NULL AND p_retry_seconds NOT BETWEEN 1 AND 3600 THEN RAISE EXCEPTION 'bounded_supervisor_backoff_required';END IF;
 UPDATE control.supervisor_wakes SET pending=(version<>p_version OR p_retry_seconds IS NOT NULL),due_at=CASE WHEN version<>p_version THEN now() ELSE now()+make_interval(secs=>coalesce(p_retry_seconds,0)) END,claim_token=NULL,claim_until=NULL,updated_at=now()
 WHERE run_id=p_run AND claim_token=p_token;
 RETURN FOUND;
END $$;
CREATE FUNCTION control.claim_recovery_action(p_task text,p_execution bigint,p_action text,p_fingerprint text,p_classification text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE claimed integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.executions e JOIN control.tasks t USING(task_id) WHERE e.execution_id=p_execution AND e.task_id=p_task AND t.status='failed' AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1)) THEN RAISE EXCEPTION 'current_failed_execution_required';END IF;
 IF EXISTS(SELECT 1 FROM control.lifecycle_failure_current c JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint) WHERE c.execution_id=p_execution AND (g.fingerprint=p_fingerprint OR g.evidence->>'source_fingerprint'=p_evidence->>'source_fingerprint')) THEN RETURN jsonb_build_object('claimed',false,'reason','classified_verifier_repair_required');END IF;
 INSERT INTO control.recovery_action_claims(task_id,execution_id,action,fingerprint,classification,evidence) VALUES(p_task,p_execution,p_action,p_fingerprint,p_classification,p_evidence) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS claimed=ROW_COUNT;
 RETURN jsonb_build_object('claimed',claimed=1,'fingerprint',p_fingerprint,'reason',CASE WHEN claimed=1 THEN 'new_recovery_inputs' ELSE 'unchanged_recovery_action_forbidden' END);
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='control' AND p.proname IN('enqueue_supervisor_wake','supervisor_state_signal','claim_supervisor_wake','finish_supervisor_wake','claim_recovery_action') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',f);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION control.enqueue_supervisor_wake(uuid,bigint),control.claim_supervisor_wake(),control.finish_supervisor_wake(uuid,uuid,bigint,integer),control.claim_recovery_action(text,bigint,text,text,text,jsonb) TO bs_runtime_executor;
CREATE TABLE control.lifecycle_failure_generations(
 execution_id bigint NOT NULL REFERENCES control.executions,
 fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 classification text NOT NULL CHECK(classification IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN','HUMAN_AUTHORITY','EXTERNAL_EVIDENCE')),
 evidence jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(execution_id,fingerprint)
);
CREATE TABLE control.lifecycle_failure_current(
 execution_id bigint PRIMARY KEY REFERENCES control.executions,fingerprint text NOT NULL,
 FOREIGN KEY(execution_id,fingerprint) REFERENCES control.lifecycle_failure_generations
);
ALTER TABLE control.lifecycle_failure_generations OWNER TO bs_control_migration_owner;
ALTER TABLE control.lifecycle_failure_current OWNER TO bs_control_migration_owner;
ALTER TABLE control.lifecycle_failure_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.lifecycle_failure_current ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.lifecycle_failure_generations,control.lifecycle_failure_current FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
CREATE TRIGGER immutable_control_evidence BEFORE UPDATE OR DELETE ON control.lifecycle_failure_generations FOR EACH ROW EXECUTE FUNCTION control.reject_append_only_mutation();
CREATE FUNCTION control.record_lifecycle_failure(p_task text,p_execution bigint,p_fingerprint text,p_classification text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE result control.lifecycle_failure_generations%ROWTYPE; verification bigint;
BEGIN
 PERFORM 1 FROM control.tasks t JOIN control.executions e USING(task_id) WHERE t.task_id=p_task AND t.status='failed' AND e.execution_id=p_execution AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1) FOR UPDATE OF t;
 IF NOT FOUND THEN RETURN NULL;END IF;
 IF p_classification='PRODUCT_DEFECT' AND NOT EXISTS(SELECT 1 FROM control.verification_results v JOIN control.verification_failure_reviews review USING(verification_id) WHERE v.execution_id=p_execution AND v.status='fail' AND review.evidence->>'classification'='PRODUCT_DEFECT' AND v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=p_execution) AND review.check_fingerprint=md5(jsonb_build_array(v.execution_id,v.verification_run_id,v.check_name,v.command,v.exit_code,v.status,v.log_path)::text)) THEN RAISE EXCEPTION 'trusted_product_review_required';END IF;
 SELECT max(verification_run_id) INTO verification FROM control.verification_runs WHERE execution_id=p_execution;
 SELECT g.* INTO result FROM control.lifecycle_failure_current c JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint) WHERE c.execution_id=p_execution;
 IF result.classification=p_classification AND (result.evidence->>'verification_run_id')::bigint IS NOT DISTINCT FROM verification THEN RETURN jsonb_build_object('fingerprint',result.fingerprint,'classification',result.classification);END IF;
 IF (result.evidence->>'verification_run_id')::bigint IS NOT DISTINCT FROM verification AND result.evidence ? 'source_fingerprint' THEN p_evidence:=p_evidence||jsonb_build_object('source_fingerprint',result.evidence->'source_fingerprint');END IF;
 p_evidence:=p_evidence||jsonb_build_object('verification_run_id',verification);
 INSERT INTO control.lifecycle_failure_generations VALUES(p_execution,p_fingerprint,p_classification,p_evidence,now()) ON CONFLICT DO NOTHING;
 SELECT * INTO result FROM control.lifecycle_failure_generations WHERE execution_id=p_execution AND fingerprint=p_fingerprint;
 IF result.classification IS DISTINCT FROM p_classification THEN RAISE EXCEPTION 'failure_generation_classification_conflict';END IF;
 INSERT INTO control.lifecycle_failure_current VALUES(p_execution,p_fingerprint) ON CONFLICT(execution_id) DO UPDATE SET fingerprint=excluded.fingerprint WHERE control.lifecycle_failure_current.fingerprint IS DISTINCT FROM excluded.fingerprint;
 RETURN jsonb_build_object('fingerprint',result.fingerprint,'classification',result.classification);
END $$;
CREATE FUNCTION control.current_lifecycle_failure(p_task text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('execution_id',e.execution_id,'fingerprint',g.fingerprint,'classification',g.classification)
 FROM control.executions e JOIN control.lifecycle_failure_current c USING(execution_id) JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint)
 WHERE e.task_id=p_task AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1);
$$;
ALTER FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb) OWNER TO bs_control_migration_owner;
ALTER FUNCTION control.current_lifecycle_failure(text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb),control.current_lifecycle_failure(text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.record_lifecycle_failure(text,bigint,text,text,jsonb) TO bs_runtime_executor;
GRANT EXECUTE ON FUNCTION control.current_lifecycle_failure(text) TO bs_runtime_executor,bs_control_observer;
CREATE FUNCTION control.recovery_action_readiness(p_execution bigint,p_action text,p_fingerprint text,p_source text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('allowed',NOT EXISTS(SELECT 1 FROM control.recovery_action_claims WHERE execution_id=p_execution AND action=p_action AND fingerprint=p_fingerprint)
 AND NOT EXISTS(SELECT 1 FROM control.lifecycle_failure_current c JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint) WHERE c.execution_id=p_execution AND (g.fingerprint=p_fingerprint OR g.evidence->>'source_fingerprint'=p_source)));
$$;
ALTER FUNCTION control.recovery_action_readiness(bigint,text,text,text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.recovery_action_readiness(bigint,text,text,text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.recovery_action_readiness(bigint,text,text,text) TO bs_runtime_executor;
CREATE FUNCTION control.reconcile_lifecycle_incidents(p_run uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE count_resolved integer;
BEGIN
 PERFORM 1 FROM control.workflow_runs WHERE run_id=p_run AND status='running' AND NOT stop_requested AND NOT maintenance_requested FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('resolved',0);END IF;
 WITH settled AS(UPDATE control.dot_recovery_jobs j SET status='resolved',claim_until=NULL,updated_at=now(),evidence=evidence||jsonb_build_object('resolution','subject_verification_passed','owner','Supervisor','history_preserved',true)
 FROM control.tasks t WHERE j.run_id=p_run AND t.task_id=j.task_id AND t.status IN('passed','complete') AND j.status IN('queued','human-gate') RETURNING j.incident_id)
 UPDATE control.dot_incidents i SET status='resolved',claim_until=NULL WHERE incident_id IN(SELECT incident_id FROM settled);
 GET DIAGNOSTICS count_resolved=ROW_COUNT;
 RETURN jsonb_build_object('resolved',count_resolved);
END $$;
ALTER FUNCTION control.reconcile_lifecycle_incidents(uuid) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.reconcile_lifecycle_incidents(uuid) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.reconcile_lifecycle_incidents(uuid) TO bs_runtime_executor;
-- Preserve existing invocation budgets, with a stronger unchanged-input fuse.
ALTER FUNCTION control.reserve_dot_model_invocation(uuid,uuid,text,text) RENAME TO reserve_dot_model_invocation_budget_v1;
CREATE FUNCTION control.reserve_dot_model_invocation(p_incident uuid,p_token uuid,p_receipt text,p_before text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE j control.dot_recovery_jobs%ROWTYPE; reservation jsonb; extension bigint;
BEGIN
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_incident FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.status<>'running' OR j.claim_until<=now() THEN RAISE EXCEPTION 'investigation_claim_required';END IF;
 IF EXISTS(SELECT 1 FROM control.dot_model_invocations WHERE incident_id=p_incident AND before_fingerprint=p_before AND launched_at IS NOT NULL AND finished_at IS NOT NULL AND progressed IS NOT TRUE)
 AND NOT EXISTS(SELECT 1 FROM control.operator_invocation_extensions WHERE incident_id=p_incident AND kind='incident-investigation-extension' AND revoked_at IS NULL AND consumed_at IS NULL AND invocation_id IS NULL AND granted_at>now()-interval '45 minutes') THEN
 UPDATE control.dot_recovery_jobs SET status='human-gate',claim_until=NULL,evidence=evidence||jsonb_build_object('gate_kind','incident-investigation-extension','reason','unchanged_incident_inputs','requested_extra_invocations',1) WHERE incident_id=p_incident;
 UPDATE control.dot_incidents SET status='operator-gate',claim_until=NULL WHERE incident_id=p_incident;
 RETURN jsonb_build_object('allowed',false,'reason','unchanged_incident_inputs');END IF;
 reservation:=control.reserve_dot_model_invocation_budget_v1(p_incident,p_token,p_receipt,p_before);
 IF reservation->>'allowed'='true' AND EXISTS(SELECT 1 FROM control.dot_model_invocations WHERE incident_id=p_incident AND before_fingerprint=p_before AND launched_at IS NOT NULL AND finished_at IS NOT NULL AND progressed IS NOT TRUE) THEN
 SELECT grant_id INTO extension FROM control.operator_invocation_extensions WHERE incident_id=p_incident AND kind='incident-investigation-extension' AND revoked_at IS NULL AND consumed_at IS NULL AND invocation_id IS NULL AND granted_at>now()-interval '45 minutes' FOR UPDATE;
 IF extension IS NOT NULL THEN UPDATE control.operator_invocation_extensions SET invocation_id=(reservation->>'invocation_id')::bigint WHERE grant_id=extension;END IF;
 END IF;
 RETURN reservation;
END $$;
ALTER FUNCTION control.reserve_dot_model_invocation(uuid,uuid,text,text) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.reserve_dot_model_invocation_budget_v1(uuid,uuid,text,text),control.reserve_dot_model_invocation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.reserve_dot_model_invocation(uuid,uuid,text,text) TO bs_runtime_executor;

-- Additive reconciliation: no task/run/attempt/history row is rewritten.
SELECT control.enqueue_supervisor_wake(run_id) FROM control.workflow_runs WHERE status='running';
COMMIT;

BEGIN;
-- Preserve the legacy human gate. Dot's derived authority is accepted only
-- with exact guarded acceptance, executed mandatory checks and the frozen
-- ordinary-draft grant of the SAME bounded run. Completed receipts are replayable.
CREATE OR REPLACE FUNCTION control.publication_execution_is_eligible(p_task_id text, p_execution_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SET search_path=pg_catalog,control
AS $function$
SELECT COALESCE((SELECT e.status='succeeded' OR (
 e.status='failed' AND t.status IN('passed','complete') AND v.status='passed'
 AND v.metadata->>'verifier_only_reacceptance'='true'
 AND v.metadata#>>'{verified_state,fingerprint}' ~ '^[0-9a-f]{64}$'
 AND a.event_type='verifier_reacceptance_authorized'
 AND (
  (a.source='human' AND v.metadata->>'preserved_execution'='true')
  OR (a.source='dot' AND v.metadata->>'preserved_failed_execution'='true'
   AND (a.payload->>'run_id') IS NOT NULL
   AND EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g
    JOIN control.workflow_runs run USING(run_id)
    WHERE g.run_id::text=a.payload->>'run_id' AND g.project_id=t.project_id AND g.workstream_slug=t.workstream_slug
    AND g.revoked_at IS NULL AND g.max_tasks=run.max_tasks AND g.repair_id IS NOT DISTINCT FROM run.admitted_repair_id AND g.controller_fingerprint=run.controller_fingerprint)
   AND (
    ((control.current_run_publication_authority(e.task_id)->>'authorized')::boolean
     AND control.current_run_publication_authority(e.task_id)->>'run_id'=a.payload->>'run_id')
    OR (t.status='complete' AND EXISTS(SELECT 1 FROM control.pull_requests published
     JOIN control.task_events completed ON completed.task_id=published.task_id AND completed.event_type='publication_completed'
     WHERE published.task_id=e.task_id AND published.head_sha=e.commit_sha
      AND completed.payload->>'verification_run_id'=v.verification_run_id::text
      AND completed.payload->>'head_sha'=e.commit_sha))
   )
   AND jsonb_typeof(a.payload->'required_checks')='array' AND jsonb_array_length(a.payload->'required_checks')>0
   AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements_text(a.payload->'required_checks') required WHERE NOT EXISTS(
    SELECT 1 FROM control.verification_results result WHERE result.verification_run_id=v.verification_run_id
    AND result.check_name=required AND result.status='pass' AND coalesce(result.metadata->>'required','true')<>'false'))
  )
 )
 AND a.payload->>'execution_id'=e.execution_id::text AND a.payload->>'attempt'=e.attempt::text
 AND EXISTS(SELECT 1 FROM control.task_events accepted WHERE accepted.task_id=e.task_id AND accepted.event_type='verifier_only_reaccepted'
   AND accepted.payload->>'verification_run_id'=v.verification_run_id::text AND accepted.payload->>'execution_id'=e.execution_id::text
   AND accepted.payload->>'approval_event_id'=a.event_id::text)
 AND EXISTS(SELECT 1 FROM control.verification_results r WHERE r.verification_run_id=v.verification_run_id)
 AND NOT EXISTS(SELECT 1 FROM control.verification_results r WHERE r.verification_run_id=v.verification_run_id
   AND (r.status NOT IN('pass','skipped') OR (coalesce(r.metadata->>'required','true')<>'false' AND r.status<>'pass')))
 ) FROM control.executions e JOIN control.tasks t USING(task_id)
 LEFT JOIN LATERAL(SELECT * FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1) v ON true
 LEFT JOIN control.task_events a ON a.event_id::text=v.metadata->>'approval_event_id' AND a.task_id=e.task_id
 WHERE e.task_id=p_task_id AND e.execution_id=p_execution_id
 AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1)),false);
$function$;


CREATE OR REPLACE FUNCTION control.audit_product_attempts(p_task text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e record; checks jsonb; blocking jsonb; cls text;
BEGIN
 FOR e IN SELECT * FROM control.executions WHERE task_id=p_task AND status IN('failed','succeeded','blocked','cancelled') ORDER BY attempt LOOP
  IF EXISTS(SELECT 1 FROM control.product_attempt_classifications WHERE execution_id=e.execution_id AND evidence_fingerprint=control.retry_evidence_fingerprint(e.execution_id)) THEN CONTINUE; END IF;
  checks:=e.metadata->'verification_probe_failures';
  IF checks IS NULL OR jsonb_array_length(checks)=0 THEN
   SELECT jsonb_agg(jsonb_build_object('status',v.status,'failure_class',v.metadata->>'failure_class','selection_reason',v.metadata->>'selection_reason','required',coalesce(v.metadata->'required','true'::jsonb),'summary',v.summary,'name',v.check_name)) INTO checks
   FROM control.verification_results v WHERE v.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=e.execution_id);
  END IF;
  -- Full persisted probe receipts retain selection_reason, unlike summaries.
  IF EXISTS(SELECT 1 FROM control.failures f WHERE f.execution_id=e.execution_id AND jsonb_typeof(f.metadata#>'{verification_probe,checks}')='array') THEN
   SELECT f.metadata#>'{verification_probe,checks}' INTO checks FROM control.failures f WHERE f.execution_id=e.execution_id AND jsonb_typeof(f.metadata#>'{verification_probe,checks}')='array' ORDER BY failure_id DESC LIMIT 1;
  END IF;
  SELECT coalesce(jsonb_agg(c),'[]'::jsonb) INTO blocking FROM jsonb_array_elements(coalesce(checks,'[]'::jsonb)) c
   WHERE coalesce(c->>'required','true')<>'false' AND c->>'status' IN('fail','not_run','unavailable');
  cls:='OTHER';
  IF jsonb_array_length(blocking)>0 THEN
   IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE NOT coalesce(c->>'summary' ~ 'EADDRINUSE|listen EPERM|spawn E2BIG',false)) THEN cls:='VERIFIER_INFRA';
   ELSIF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE NOT coalesce((
    c->>'status'='not_run' AND c->>'selection_reason' IN('generator_disposable_fixture_runner_not_registered','missing_generated_fixture_boundary_runner','browser_configuration_discovery_failed','verification_plan_entry_unenforced')
    OR coalesce(c->>'failure_class','') IN('verification-configuration','CONFIGURATION')),false)) THEN cls:='CONFIGURATION';
   ELSIF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE coalesce(c->>'failure_class','') NOT IN('verification-infrastructure','verification-lifecycle','flaky-verification','VERIFIER_INFRA')) THEN cls:='VERIFIER_INFRA';
   ELSIF EXISTS(SELECT 1 FROM jsonb_array_elements(blocking) c WHERE c->>'status'='fail' AND c->>'failure_class' IN('verification-product-defect','PRODUCT_DEFECT')) THEN cls:='PRODUCT_DEFECT';
   END IF;
  ELSE
   IF e.status='succeeded' AND NOT EXISTS(SELECT 1 FROM control.failures WHERE execution_id=e.execution_id) THEN CONTINUE; END IF;
   SELECT CASE f.failure_class WHEN 'transient-infrastructure' THEN 'TRANSIENT_INFRASTRUCTURE' WHEN 'repository-state' THEN 'REPOSITORY_WORKTREE' ELSE 'OTHER' END INTO cls
   FROM control.failures f WHERE f.execution_id=e.execution_id ORDER BY failure_id DESC LIMIT 1;
   cls:=coalesce(cls,'OTHER');
  END IF;
  INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
  VALUES(e.execution_id,cls,control.retry_evidence_fingerprint(e.execution_id),'dot',jsonb_build_object('checks',blocking,'basis','persisted structured evidence; unknown stays guarded')) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN control.product_retry_accounting(p_task);
END $$;
CREATE OR REPLACE FUNCTION control.product_retry_accounting(p_task text) RETURNS jsonb LANGUAGE sql STABLE SET search_path=pg_catalog,control AS $$
 WITH entries AS (
 SELECT e.execution_id,e.attempt,e.status,coalesce(c.classification,'OTHER') AS classification,c.source,
 c.evidence,c.classification_id,
 coalesce(c.classification='PRODUCT_DEFECT',false) AS charged
 FROM control.executions e LEFT JOIN LATERAL (
 SELECT * FROM control.product_attempt_classifications a WHERE a.execution_id=e.execution_id
 ORDER BY classification_id DESC LIMIT 1) c ON true WHERE e.task_id=p_task)
 SELECT jsonb_build_object('consumed',count(*) FILTER(WHERE charged),'genuine_product',count(*) FILTER(WHERE classification='PRODUCT_DEFECT'),
 'all_product',coalesce(bool_and(classification='PRODUCT_DEFECT') FILTER(WHERE charged),false),'classifications',coalesce(jsonb_agg(to_jsonb(entries) ORDER BY attempt),'[]'::jsonb)) FROM entries;
$$;


-- Dispatcher ownership is separate from product executions and never spends a retry.
CREATE TABLE control.dot_recovery_catalog (
 root_family text PRIMARY KEY CHECK(root_family ~ '^[a-z][a-z0-9-]{1,80}$'),
 failure_class text NOT NULL, handler text NOT NULL CHECK(handler IN('run-recover')),
 regression_test text NOT NULL CHECK(regression_test LIKE 'tooling/control-plane/tests/%'),
 compatible_runtime text NOT NULL, learned_from uuid REFERENCES control.dot_incidents,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE control.dot_recovery_jobs (
 incident_id uuid PRIMARY KEY REFERENCES control.dot_incidents,
 run_id uuid NOT NULL REFERENCES control.workflow_runs,
 task_id text REFERENCES control.tasks,
 root_family text NOT NULL, owner text NOT NULL CHECK(owner IN('Dot','Codex')),
 action text NOT NULL, status text NOT NULL CHECK(status IN('queued','running','resolved','human-gate')),
 claim_token uuid, claim_until timestamptz, started_at timestamptz NOT NULL DEFAULT now(),
 next_check_at timestamptz NOT NULL DEFAULT now(), attempts integer NOT NULL DEFAULT 0,
 evidence jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.dot_incidents ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE control.dot_recovery_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.dot_recovery_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY dot_catalog_private ON control.dot_recovery_catalog TO bs_control_app USING(true);
CREATE POLICY dot_jobs_private ON control.dot_recovery_jobs TO bs_control_app USING(true) WITH CHECK(true);
REVOKE ALL ON control.dot_recovery_catalog,control.dot_recovery_jobs FROM PUBLIC,anon,authenticated;
GRANT SELECT ON control.dot_recovery_catalog TO bs_control_app;
GRANT SELECT ON control.dot_recovery_jobs TO bs_control_app;
INSERT INTO control.dot_recovery_catalog(root_family,failure_class,handler,regression_test,compatible_runtime)
SELECT family,cls,'run-recover','tooling/control-plane/tests/dot-general-recovery.test.mjs','dot-general-v1'
FROM (VALUES ('publication-handoff','PUBLICATION_INFRA'),('completion-credit','PUBLICATION_INFRA'),
 ('controller-acquisition','CONFIGURATION'),('worker-transport','TRANSIENT_INFRASTRUCTURE'),
 ('verifier-configuration','CONFIGURATION'),('verifier-infrastructure','VERIFIER_INFRA'),
 ('repository-reconciliation','REPOSITORY_WORKTREE'),('transient-infrastructure','TRANSIENT_INFRASTRUCTURE'),
 ('product-repair','PRODUCT_DEFECT'),('timer-reconciliation','TRANSIENT_INFRASTRUCTURE'),
 ('lease-reconciliation','TRANSIENT_INFRASTRUCTURE')) c(family,cls);
-- Run-row lock plus incident uniqueness serialize duplicate/restarted watchdogs.
CREATE FUNCTION control.claim_dot_recovery(p_run uuid,p_fingerprint text,p_family text,p_evidence jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; h jsonb; id uuid; j control.dot_recovery_jobs%ROWTYPE;
 c control.dot_recovery_catalog%ROWTYPE; b jsonb; cls text;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT snapshot INTO h FROM control.dot_health_current WHERE run_id=p_run;
 IF r.run_id IS NULL OR r.status NOT IN('running','failed') OR r.stop_requested OR r.maintenance_requested
 OR r.completed_tasks>=r.max_tasks OR h->>'state' IS DISTINCT FROM 'STUCK'
 OR h->>'operator_action_required' IS DISTINCT FROM 'false' OR h->>'worker_alive' IS DISTINCT FROM 'false'
 OR (h->>'observed_at')::timestamptz<now()-interval '90 seconds'
 OR h->>'task_id' IS DISTINCT FROM r.current_task_id
 THEN RETURN jsonb_build_object('claimed',false,'reason','live_safety_gate'); END IF;
 IF r.current_task_id IS NOT NULL THEN
 b:=control.audit_product_attempts(r.current_task_id);
 IF EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status='failed')
 AND b->>'all_product'='true' AND (b->>'consumed')::integer >= (control.resolved_retry_policy(r.current_task_id)->>'max_attempts')::integer
 THEN
 PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||r.current_task_id,p_idempotency_key=>'dot-general-product-exhaustion:'||p_fingerprint,
 p_project_id=>r.project_id,p_workstream_slug=>r.workstream_slug,p_current_task_id=>r.current_task_id,p_workflow_run_id=>r.run_id,
 p_execution_id=>(h->>'execution_id')::bigint,p_failure_class=>'operator-wait',p_error_code=>'retry_budget_exhausted',p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'dot',p_status=>'active');
 RETURN jsonb_build_object('claimed',false,'reason','genuine_product_budget_exhausted');END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM control.recovery_states s WHERE s.current_task_id=r.current_task_id AND s.status='active' AND s.next_action IN('wait-operator','wait-decision','safety-stop') AND s.error_code IS DISTINCT FROM 'retry_budget_exhausted') THEN RETURN jsonb_build_object('claimed',false,'reason','authoritative_human_gate');END IF;
 SELECT * INTO c FROM control.dot_recovery_catalog WHERE root_family=p_family;
 cls:=coalesce(c.failure_class,'UNKNOWN');
 id:=control.record_dot_incident(r.run_id,r.current_task_id,(h->>'execution_id')::bigint,p_fingerprint,cls,jsonb_build_object('health',h,'dispatcher',p_evidence,'accounting',b));
 INSERT INTO control.dot_recovery_jobs(incident_id,run_id,task_id,root_family,owner,action,status,evidence)
 VALUES(id,r.run_id,r.current_task_id,p_family,CASE WHEN c.root_family IS NULL THEN 'Codex' ELSE 'Dot' END,
 CASE WHEN c.root_family IS NULL THEN 'incident-investigate' ELSE p_family END,'queued',p_evidence)
 ON CONFLICT(incident_id) DO NOTHING;
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=id FOR UPDATE;
 IF j.claim_until>now() OR (j.status='queued' AND j.next_check_at>now()) OR j.status='human-gate' THEN RETURN jsonb_build_object('claimed',false,'reason','incident_owned','job',to_jsonb(j));END IF;
 -- Repeated handler failure is an unknown implementation gap, not product exhaustion.
 IF j.attempts>=2 AND j.owner='Dot' THEN
 UPDATE control.dot_recovery_jobs SET owner='Codex',action='incident-investigate',status='queued' WHERE incident_id=id;
 END IF;
 UPDATE control.dot_recovery_jobs SET status='running',claim_token=gen_random_uuid(),claim_until=now()+interval '3 minutes',next_check_at=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() WHERE incident_id=id RETURNING * INTO j;
 UPDATE control.dot_incidents SET status='recovering',claim_until=j.claim_until WHERE incident_id=id;
 RETURN jsonb_build_object('claimed',true,'job',to_jsonb(j));
END $$;
CREATE FUNCTION control.finish_dot_recovery(p_id uuid,p_token uuid,p_status text,p_evidence jsonb,p_runtime text DEFAULT NULL,p_regression text DEFAULT NULL)
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
 UPDATE control.dot_recovery_jobs SET status=p_status,evidence=evidence||p_evidence,
 claim_until=CASE WHEN p_status='running' THEN now()+interval '3 minutes' ELSE NULL END,
 next_check_at=now()+interval '2 minutes',updated_at=now() WHERE incident_id=p_id;
 UPDATE control.dot_incidents SET status=CASE WHEN p_status='resolved' THEN 'resolved' WHEN p_status='human-gate' THEN 'operator-gate' ELSE 'recovering' END WHERE incident_id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION control.claim_dot_recovery(uuid,text,text,jsonb),control.finish_dot_recovery(uuid,uuid,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.claim_dot_recovery(uuid,text,text,jsonb),control.finish_dot_recovery(uuid,uuid,text,jsonb,text,text) TO bs_control_app;
COMMIT;

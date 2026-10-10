BEGIN;
-- Audited accounting applies to every retry policy, without rewriting executions.
CREATE OR REPLACE FUNCTION control.audit_product_attempts(p_task text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e record; checks jsonb; blocking jsonb; cls text;
BEGIN
 FOR e IN SELECT * FROM control.executions WHERE task_id=p_task AND status IN('failed','succeeded','blocked','cancelled') ORDER BY attempt LOOP
  IF EXISTS(SELECT 1 FROM control.product_attempt_classifications WHERE execution_id=e.execution_id AND evidence_fingerprint=control.retry_evidence_fingerprint(e.execution_id)) THEN CONTINUE; END IF;
  IF NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task AND status='failed') THEN CONTINUE; END IF;
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
CREATE OR REPLACE FUNCTION control.product_retry_accounting(p_task text) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH entries AS (
 SELECT e.execution_id,e.attempt,e.status,coalesce(c.classification,'OTHER') AS classification,c.source,
 c.evidence,c.classification_id,
 coalesce(c.classification NOT IN('VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE'),true) AS charged
 FROM control.executions e LEFT JOIN LATERAL (
 SELECT * FROM control.product_attempt_classifications a WHERE a.execution_id=e.execution_id
 ORDER BY classification_id DESC LIMIT 1) c ON true WHERE e.task_id=p_task)
 SELECT jsonb_build_object('consumed',count(*) FILTER(WHERE charged),'genuine_product',count(*) FILTER(WHERE classification='PRODUCT_DEFECT'),
 'all_product',coalesce(bool_and(classification='PRODUCT_DEFECT') FILTER(WHERE charged),false),'classifications',coalesce(jsonb_agg(to_jsonb(entries) ORDER BY attempt),'[]'::jsonb)) FROM entries;
$$;

-- One persisted incident and recoverable claim lease survive watchdog restarts.
ALTER TABLE control.dot_incidents ADD COLUMN claim_until timestamptz;
CREATE FUNCTION control.claim_dot_stuck_recovery(p_run uuid,p_fingerprint text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; h jsonb; s control.recovery_states%ROWTYPE; e control.executions%ROWTYPE;
 budget jsonb; cls text; id uuid; old_claim timestamptz; old_status text; max_budget integer;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 SELECT snapshot INTO h FROM control.dot_health_current WHERE run_id=p_run;
 IF r.run_id IS NULL OR r.current_task_id IS NULL OR r.status NOT IN('running','failed')
 OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks
 OR h->>'task_id' IS DISTINCT FROM r.current_task_id OR h->>'state' IS DISTINCT FROM 'STUCK'
 OR h->>'operator_action_required' IS DISTINCT FROM 'false' OR h->>'worker_alive' IS DISTINCT FROM 'false'
 OR (h->>'observed_at')::timestamptz<now()-interval '90 seconds'
 OR (h->>'next_wake_at')::timestamptz>now() OR r.controller_lease_expires_at>now()
 THEN RETURN jsonb_build_object('claimed',false,'reason','live_health_or_run_gate'); END IF;
 SELECT * INTO s FROM control.recovery_states WHERE resume_identity='task:'||r.current_task_id FOR UPDATE;
 IF s.lease_expires_at>now() OR (s.status='active' AND s.next_wake_at>now())
 OR (s.status='active' AND s.next_action IN('wait-operator','wait-decision','safety-stop') AND s.error_code IS DISTINCT FROM 'retry_budget_exhausted')
 OR (r.status='failed' AND (s.error_code IS DISTINCT FROM 'retry_budget_exhausted' OR s.next_action<>'safety-stop'))
 OR EXISTS(SELECT 1 FROM control.workflow_runs other WHERE other.run_id<>r.run_id AND other.suit_slug=r.suit_slug AND other.status='running')
 THEN RETURN jsonb_build_object('claimed',false,'reason','recovery_gate');END IF;
 SELECT * INTO e FROM control.executions WHERE task_id=r.current_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1;
 IF e.execution_id IS DISTINCT FROM (h->>'execution_id')::bigint THEN RETURN jsonb_build_object('claimed',false,'reason','execution_changed');END IF;
 id:=control.record_dot_incident(r.run_id,r.current_task_id,e.execution_id,p_fingerprint,'UNKNOWN',jsonb_build_object('health',h,'basis','deterministic STUCK watchdog dispatch'));
 SELECT claim_until,status INTO old_claim,old_status FROM control.dot_incidents WHERE incident_id=id FOR UPDATE;
 IF old_claim>now() OR old_status='operator-gate' THEN RETURN jsonb_build_object('claimed',false,'reason','incident_already_owned','incident_id',id);END IF;
 budget:=control.audit_product_attempts(r.current_task_id);
 cls:=budget#>>'{classifications,-1,classification}';
 max_budget:=(control.resolved_retry_policy(r.current_task_id)->>'max_attempts')::integer;
 IF (cls='OTHER' AND EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status='failed')) OR (cls='PRODUCT_DEFECT' AND (budget->>'consumed')::integer>=max_budget) THEN
  UPDATE control.dot_incidents SET status='operator-gate',classification=CASE WHEN cls='OTHER' THEN 'OPERATOR_AUTHORIZATION' ELSE 'RETRY_BUDGET_EXHAUSTED' END,evidence=evidence||jsonb_build_object('accounting',budget) WHERE incident_id=id;
  PERFORM control.record_recovery_condition(p_resume_identity=>'task:'||r.current_task_id,p_idempotency_key=>'dot-stuck-gate:'||id,
   p_project_id=>r.project_id,p_workstream_slug=>r.workstream_slug,p_current_task_id=>r.current_task_id,p_workflow_run_id=>r.run_id,p_execution_id=>e.execution_id,
   p_failure_class=>'operator-wait',p_error_code=>CASE WHEN cls='OTHER' THEN 'retry_classification_review_required' ELSE 'retry_budget_exhausted' END,
   p_next_action=>'wait-operator',p_recoverable=>false,p_source=>'dot',p_status=>'active');
  RETURN jsonb_build_object('claimed',false,'reason','operator_gate','incident_id',id,'accounting',budget);
 END IF;
 -- Failed runs are re-entered solely for the mischarged exhaustion condition,
 -- with the original frozen operator authority, task, counters and history.
 IF r.status='failed' THEN
  IF NOT EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations g WHERE g.run_id=r.run_id AND g.revoked_at IS NULL
   AND g.project_id=r.project_id AND g.workstream_slug=r.workstream_slug AND g.max_tasks=r.max_tasks AND g.repair_id IS NOT DISTINCT FROM r.admitted_repair_id AND g.controller_fingerprint=r.controller_fingerprint)
  THEN RETURN jsonb_build_object('claimed',false,'reason','bounded_authority_missing');END IF;
  UPDATE control.workflow_runs SET status='running',finished_at=NULL,run_revision=run_revision+1 WHERE run_id=r.run_id;
 END IF;
 IF s.error_code='retry_budget_exhausted' THEN
  UPDATE control.recovery_states SET status='resolved',next_action=CASE WHEN cls='PRODUCT_DEFECT' THEN 'retry' ELSE 'reverify' END,
   error_code='stuck_exhaustion_reconciled',recoverable=true,next_wake_at=NULL,resolved_at=now(),version=version+1,updated_at=now(),condition=condition||jsonb_build_object('classification_reconciled',true) WHERE recovery_state_id=s.recovery_state_id;
 END IF;
 UPDATE control.dot_incidents SET status='recovering',claim_until=now()+interval '2 minutes',classification=coalesce(nullif(cls,'OTHER'),'UNKNOWN'),evidence=evidence||jsonb_build_object('accounting',budget) WHERE incident_id=id;
 INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(r.current_task_id,'dot_stuck_recovery_started','dot',jsonb_build_object('incident_id',id,'run_id',r.run_id,'execution_id',e.execution_id,'accounting',budget,'product_attempts_added',0,'existing_run_preserved',true));
 RETURN jsonb_build_object('claimed',true,'incident_id',id,'classification',cls,'accounting',budget,'run_id',r.run_id);
END $$;
REVOKE ALL ON FUNCTION control.claim_dot_stuck_recovery(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.claim_dot_stuck_recovery(uuid,text) TO bs_control_app;
ALTER FUNCTION control.start_retry_execution(text,integer,text,text,text) RENAME TO start_retry_execution_shared_accounted_v1;
CREATE FUNCTION control.start_retry_execution(p_task_id text,p_max_attempts integer,p_model_profile text,p_model_name text,p_reasoning_effort text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE policy jsonb; budget jsonb; previous control.executions%ROWTYPE; slot integer; new_id bigint;
BEGIN
 PERFORM 1 FROM control.tasks WHERE task_id=p_task_id FOR UPDATE;
 policy:=control.resolved_retry_policy(p_task_id);
 IF policy->>'policy_id'='shared-foundation-five' THEN RETURN control.start_retry_execution_shared_accounted_v1(p_task_id,p_max_attempts,p_model_profile,p_model_name,p_reasoning_effort);END IF;
 IF p_max_attempts IS DISTINCT FROM (policy->>'max_attempts')::integer THEN RAISE EXCEPTION 'Configured product budget must remain unchanged';END IF;
 budget:=control.audit_product_attempts(p_task_id);slot:=(budget->>'consumed')::integer+1;
 IF slot>p_max_attempts THEN RETURN jsonb_build_object('allowed',false,'reason','retry_limit_reached','max_attempts',p_max_attempts,'accounting',budget);END IF;
 IF budget#>>'{classifications,-1,classification}' IS DISTINCT FROM 'PRODUCT_DEFECT' THEN RAISE EXCEPTION 'Non-product or unknown failure must recover on the same execution';END IF;
 IF p_model_profile IS DISTINCT FROM policy->'attempt_profiles'->>(slot-1) OR btrim(coalesce(p_model_name,''))='' OR btrim(coalesce(p_reasoning_effort,''))='' THEN RAISE EXCEPTION 'Incorrect product slot routing';END IF;
 SELECT * INTO previous FROM control.executions WHERE task_id=p_task_id ORDER BY attempt DESC LIMIT 1;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=p_task_id AND status='failed') OR previous.status='running' THEN RAISE EXCEPTION 'Latest settled failed task required';END IF;
 UPDATE control.tasks SET status='in_progress' WHERE task_id=p_task_id;
 INSERT INTO control.executions(task_id,attempt,model_profile,model_name,reasoning_effort,status,worktree_path,branch_name,parent_branch,parent_sha,started_at,resolved_retry_policy)
 VALUES(p_task_id,previous.attempt+1,p_model_profile,p_model_name,p_reasoning_effort,'running',previous.worktree_path,previous.branch_name,previous.parent_branch,previous.parent_sha,now(),policy) RETURNING execution_id INTO new_id;
 INSERT INTO control.task_events(task_id,event_type,from_status,to_status,source,payload) VALUES(p_task_id,'retry_started','failed','in_progress','runner',jsonb_build_object('execution_id',new_id,'previous_execution_id',previous.execution_id,'attempt',previous.attempt+1,'product_slot',slot,'max_attempts',p_max_attempts,'accounting',budget,'model_profile',p_model_profile,'model_name',p_model_name,'reasoning_effort',p_reasoning_effort));
 RETURN jsonb_build_object('allowed',true,'execution_id',new_id,'attempt',previous.attempt+1,'previous_execution_id',previous.execution_id,'previous_attempt',previous.attempt,'worktree_path',previous.worktree_path,'branch_name',previous.branch_name,'parent_branch',previous.parent_branch,'parent_sha',previous.parent_sha,'product_slot',slot,'max_attempts',p_max_attempts);
END $$;
REVOKE ALL ON FUNCTION control.start_retry_execution_shared_accounted_v1(text,integer,text,text,text) FROM PUBLIC,bs_control_app;
REVOKE ALL ON FUNCTION control.start_retry_execution(text,integer,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION control.start_retry_execution(text,integer,text,text,text) TO bs_control_app;
COMMIT;

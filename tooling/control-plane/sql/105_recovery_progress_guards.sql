BEGIN;
-- Independent recovery fix on schema 103. Does not install or require migration 104.
-- History stays append-only; only current pointers/operations use supported lifecycles.
CREATE OR REPLACE FUNCTION control.lifecycle_evidence_fingerprint(p_execution bigint,p_verification bigint) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_object(
 'check',v.check_name,'command',v.command,'status',v.status,'exit_code',v.exit_code,
 'artifact',v.trusted_receipt->'artifact'->>'sha256',
 'source',v.trusted_receipt->>'source_fingerprint',
 'command_version',v.trusted_receipt->>'command_version',
 'verifier',v.trusted_registration->>'verifier_sha256',
 'registry',v.trusted_registration->>'registry_version',
 'configuration',v.trusted_receipt->'configuration',
 'classification',CASE WHEN review.check_fingerprint=md5(jsonb_build_array(v.execution_id,v.verification_run_id,v.check_name,v.command,v.exit_code,v.status,v.log_path)::text) THEN review.evidence->>'classification' ELSE 'UNKNOWN' END)
 ORDER BY v.check_name,v.command)::text,'[]'))
 FROM control.verification_results v LEFT JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE v.execution_id=p_execution AND v.verification_run_id=p_verification AND v.status IN('fail','not_run','unavailable');
$$;
CREATE FUNCTION control.legacy_verification_materialization_needed(p_execution bigint,p_verification bigint) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT EXISTS(SELECT 1 FROM control.verification_results v WHERE v.execution_id=p_execution AND v.verification_run_id=p_verification
 AND v.status='fail' AND v.exit_code IS NOT NULL AND nullif(v.command,'') IS NOT NULL AND coalesce((v.metadata->>'required')::boolean,true)
 AND (v.trusted_receipt IS NULL OR v.trusted_registration IS NULL))
 AND NOT EXISTS(SELECT 1 FROM control.verification_results v JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE v.execution_id=p_execution AND v.verification_run_id=p_verification AND review.evidence->>'classification'='PRODUCT_DEFECT'
 AND review.check_fingerprint=md5(jsonb_build_array(v.execution_id,v.verification_run_id,v.check_name,v.command,v.exit_code,v.status,v.log_path)::text));
$$;
-- Narrow the existing exception at all three entrances, including old adoption rows.
DO $$ DECLARE original text; updated text; BEGIN
 original:=pg_get_functiondef('control.adopt_lifecycle_recovery(uuid,integer,text)'::regprocedure);
 updated:=replace(original,'SELECT EXISTS(SELECT 1 FROM control.verification_results c WHERE c.verification_run_id=v.verification_run_id AND c.status IN(''fail'',''not_run'',''unavailable'') AND (c.trusted_receipt IS NULL OR c.trusted_registration IS NULL)) INTO missing_receipts;',
 'SELECT control.legacy_verification_materialization_needed(e.execution_id,v.verification_run_id) INTO missing_receipts;');
 IF updated=original THEN RAISE EXCEPTION 'expected_schema_103_adoption_required'; END IF;
 EXECUTE updated;
 original:=pg_get_functiondef('control.claim_recovery_action(text,bigint,text,text,text,jsonb)'::regprocedure);
 updated:=replace(original,'AND a.materialize_evidence AND a.verification_run_id=',
 'AND a.materialize_evidence AND control.legacy_verification_materialization_needed(a.execution_id,a.verification_run_id) AND a.verification_run_id=');
 IF updated=original THEN RAISE EXCEPTION 'expected_schema_103_claim_required'; END IF;
 updated:=replace(updated,'RETURN control.claim_recovery_action_inputs_v2',
 $guard$IF p_action='task-verify' AND (control.current_lifecycle_failure(p_task)->>'classification' NOT IN('VERIFIER_INFRA','CONFIGURATION','EXTERNAL_EVIDENCE') OR control.current_lifecycle_failure(p_task)->>'classification' IS DISTINCT FROM p_classification) THEN RETURN jsonb_build_object('claimed',false,'reason','trusted_verifier_recovery_required');END IF;
 RETURN control.claim_recovery_action_inputs_v2$guard$);
 EXECUTE updated;
 original:=pg_get_functiondef('control.recovery_action_readiness(bigint,text,text,text)'::regprocedure);
 updated:=replace(original,'AND a.materialize_evidence AND a.verification_run_id=',
 'AND a.materialize_evidence AND control.legacy_verification_materialization_needed(a.execution_id,a.verification_run_id) AND a.verification_run_id=');
 IF updated=original THEN RAISE EXCEPTION 'expected_schema_103_readiness_required'; END IF;
 EXECUTE updated;
END $$;

-- Missing external evidence is a reviewed result, never an operator waiver.
DO $$ DECLARE original text; updated text; BEGIN
 original:=pg_get_functiondef('control.review_verification_failure_legacy_v2(bigint,jsonb)'::regprocedure);
 updated:=replace(original,'''PUBLICATION_INFRA'', ''UNKNOWN''','''PUBLICATION_INFRA'', ''EXTERNAL_EVIDENCE'', ''UNKNOWN''');
 IF updated=original THEN
  updated:=replace(original,'''PUBLICATION_INFRA'',''UNKNOWN''','''PUBLICATION_INFRA'',''EXTERNAL_EVIDENCE'',''UNKNOWN''');
 END IF;
 IF updated=original THEN RAISE EXCEPTION 'expected_external_review_vocabulary_required';END IF;
 EXECUTE updated;
 original:=pg_get_functiondef('control.record_retry_exhaustion_audit(text,jsonb)'::regprocedure);
 updated:=replace(original,'''PUBLICATION_INFRA'',''UNKNOWN''', '''PUBLICATION_INFRA'',''EXTERNAL_EVIDENCE'',''UNKNOWN''');
 updated:=replace(updated,'WHEN item->>''classification''=''UNKNOWN'' THEN ''OTHER''', 'WHEN item->>''classification'' IN(''UNKNOWN'',''EXTERNAL_EVIDENCE'') THEN ''OTHER''');
 IF updated=original THEN RAISE EXCEPTION 'expected_external_audit_vocabulary_required';END IF;
 EXECUTE updated;
 -- Blocked checks retain their required status but do not need fabricated receipts.
 original:=pg_get_functiondef('control.converge_lifecycle_recovery(text)'::regprocedure);
 updated:=replace(original,'AND coalesce((v.metadata->>''required'')::boolean,true)',
 'AND coalesce((v.metadata->>''required'')::boolean,true) AND NOT (v.status=''not_run'' AND v.metadata->>''selection_reason''=''database_prerequisite_failed'' AND EXISTS(SELECT 1 FROM control.verification_results prerequisite JOIN control.verification_failure_reviews prerequisite_review USING(verification_id) WHERE prerequisite.execution_id=v.execution_id AND prerequisite.verification_run_id=v.verification_run_id AND prerequisite.check_name LIKE ''%-database-reset'' AND prerequisite.status=''fail'' AND prerequisite.trusted_receipt IS NOT NULL AND prerequisite.trusted_registration IS NOT NULL AND prerequisite_review.check_fingerprint=md5(jsonb_build_array(prerequisite.execution_id,prerequisite.verification_run_id,prerequisite.check_name,prerequisite.command,prerequisite.exit_code,prerequisite.status,prerequisite.log_path)::text)))');
 IF updated=original THEN RAISE EXCEPTION 'expected_schema_103_convergence_required';END IF;
 EXECUTE updated;
END $$;

CREATE FUNCTION control.reconcile_settled_verification_operation(p_run uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; e control.executions%ROWTYPE; v control.verification_runs%ROWTYPE; o control.runtime_operations%ROWTYPE; g jsonb; n integer:=0;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run AND status='running' AND NOT stop_requested AND NOT maintenance_requested FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('reconciled',false);END IF;
 SELECT * INTO e FROM control.executions WHERE task_id=r.current_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1;
 SELECT * INTO v FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1;
 IF e.status IN('queued','running') OR v.status NOT IN('passed','failed') OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status IN('failed','passed','complete')) THEN RETURN jsonb_build_object('reconciled',false);END IF;
 IF EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id=r.current_task_id AND status='active' AND (lease_expires_at>now() OR next_action IN('wait-operator','wait-decision','safety-stop'))) THEN RETURN jsonb_build_object('reconciled',false,'reason','current_owner_or_authority_boundary');END IF;
 g:=control.current_lifecycle_failure(r.current_task_id);
 FOR o IN SELECT * FROM control.runtime_operations WHERE task_id=r.current_task_id AND execution_id=e.execution_id AND action='task-verify' AND status<>'consumed' AND (lease_expires_at IS NULL OR lease_expires_at<=now()) FOR UPDATE LOOP
  IF o.result IS NULL AND o.created_at>v.finished_at THEN CONTINUE;END IF;
  -- An unstarted explicitly reserved reverify is still owned by the Supervisor.
  IF control.legacy_verification_materialization_needed(e.execution_id,v.verification_run_id) AND EXISTS(SELECT 1 FROM control.lifecycle_recovery_adoptions WHERE execution_id=e.execution_id AND verification_run_id=v.verification_run_id AND materialize_evidence) AND NOT EXISTS(SELECT 1 FROM control.recovery_action_claims WHERE execution_id=e.execution_id AND evidence->>'legacy_materialization_protocol'='2') THEN CONTINUE;END IF;
  PERFORM control.set_runtime_operation_outcome(o.operation_id,'consumed',jsonb_build_object('ok',v.status='passed','command','task-verify','execution_id',e.execution_id,'verification_run_id',v.verification_run_id,'replayed_authoritative_state',true,'classification',g->>'classification','previous_result',o.result));
  INSERT INTO control.task_events(task_id,event_type,source,payload) VALUES(r.current_task_id,'verification_operation_reconciled','supervisor',jsonb_build_object('operation_id',o.operation_id,'execution_id',e.execution_id,'verification_run_id',v.verification_run_id,'previous_result',o.result,'history_preserved',true));
  n:=n+1;
 END LOOP;
 RETURN jsonb_build_object('reconciled',n>0,'operations',n,'verification_run_id',v.verification_run_id);
END $$;

CREATE FUNCTION control.handoff_dot_recovery(p_incident uuid,p_token uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; j control.dot_recovery_jobs%ROWTYPE; g jsonb;
BEGIN
 SELECT r0.* INTO r FROM control.workflow_runs r0 JOIN control.dot_recovery_jobs j0 ON j0.run_id=r0.run_id WHERE j0.incident_id=p_incident FOR UPDATE OF r0;
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_incident FOR UPDATE;
 IF j.status='resolved' AND j.evidence ? 'supervisor_handoff' THEN RETURN jsonb_build_object('handed_off',true,'wake_enqueued',false);END IF;
 IF j.status IS DISTINCT FROM 'running' OR j.claim_token IS DISTINCT FROM p_token OR j.claim_until IS NULL OR j.claim_until<=now() OR r.status IS DISTINCT FROM 'running' OR r.current_task_id IS DISTINCT FROM j.task_id OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks THEN RETURN jsonb_build_object('handed_off',false,'reason','current_owner_or_authority_boundary');END IF;
 IF EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id=j.task_id AND status='active' AND next_action IN('wait-operator','wait-decision','safety-stop')) THEN RETURN jsonb_build_object('handed_off',false,'reason','authoritative_human_gate');END IF;
 g:=control.current_lifecycle_failure(j.task_id);
 -- Classification changed by the investigator is retained, not replaced by a summary.
 PERFORM control.finish_dot_recovery(p_incident,p_token,'resolved',jsonb_build_object('supervisor_handoff',jsonb_build_object('failure_fingerprint',g->>'fingerprint','verification_run_id',g->'evidence'->'verification_run_id'),'product_attempts_added_by_dispatcher',0));
 PERFORM control.enqueue_supervisor_wake(r.run_id);
 RETURN jsonb_build_object('handed_off',true,'wake_enqueued',true);
END $$;

CREATE OR REPLACE FUNCTION control.claim_dot_recovery(p_run uuid,p_fingerprint text,p_family text,p_evidence jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; e control.executions%ROWTYPE; v control.verification_runs%ROWTYPE; h jsonb;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF NOT coalesce(control.run_is_actionable(r.status,r.current_task_id,r.finished_at),false) THEN RETURN jsonb_build_object('claimed',false,'reason','terminal_run');END IF;
 SELECT * INTO e FROM control.executions WHERE task_id=r.current_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1;
 SELECT * INTO v FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1;
 SELECT snapshot INTO h FROM control.dot_health_current WHERE run_id=p_run;
 IF e.status IN('queued','running') OR v.status='running' OR h->>'execution_id' IS DISTINCT FROM e.execution_id::text OR h->>'verification_id' IS DISTINCT FROM v.verification_run_id::text OR EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id=r.current_task_id AND status='active' AND lease_expires_at>now()) THEN RETURN jsonb_build_object('claimed',false,'reason','current_owner_or_generation_boundary');END IF;
 IF EXISTS(SELECT 1 FROM control.dot_recovery_jobs j WHERE j.run_id=p_run AND j.task_id=r.current_task_id AND j.status='resolved' AND j.evidence->'supervisor_handoff'->>'failure_fingerprint'=control.current_lifecycle_failure(r.current_task_id)->>'fingerprint') THEN RETURN jsonb_build_object('claimed',false,'reason','awaiting_supported_repair');END IF;
 -- This retains every original live_safety_gate check. Fresh STUCK health is
 -- persisted by the caller first; a timer alone never grants recovery authority.
 RETURN control.claim_dot_recovery_live(p_run,p_fingerprint,p_family,p_evidence);
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='control' AND p.proname IN('legacy_verification_materialization_needed','reconcile_settled_verification_operation','handoff_dot_recovery','claim_dot_recovery') LOOP
  EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',f);
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator',f);
 END LOOP;
END $$;
GRANT EXECUTE ON FUNCTION control.reconcile_settled_verification_operation(uuid),control.handoff_dot_recovery(uuid,uuid),control.claim_dot_recovery(uuid,text,text,jsonb) TO bs_runtime_executor;
COMMIT;

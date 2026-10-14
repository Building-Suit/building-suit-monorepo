BEGIN;
-- A legacy semantic fingerprint cannot acquire a new incident generation.
CREATE OR REPLACE FUNCTION control.adopt_lifecycle_recovery(p_run uuid,p_protocol integer,p_release text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; e control.executions%ROWTYPE; v control.verification_runs%ROWTYPE;
 old_failure jsonb; fingerprint text; stale jsonb; missing_receipts boolean; changed integer; evidence jsonb; adoption_fingerprint text;
BEGIN
 IF p_protocol<>2 OR p_release !~ '^[a-f0-9]{64}$' THEN RAISE EXCEPTION 'current_lifecycle_protocol_required';END IF;
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run AND status='running' AND NOT stop_requested AND NOT maintenance_requested FOR UPDATE;
 IF NOT FOUND OR r.current_task_id IS NULL THEN RETURN jsonb_build_object('adopted',false);END IF;
 SELECT * INTO e FROM control.executions WHERE task_id=r.current_task_id ORDER BY attempt DESC,execution_id DESC LIMIT 1;
 SELECT * INTO v FROM control.verification_runs WHERE execution_id=e.execution_id ORDER BY verification_run_id DESC LIMIT 1;
 -- Never steal an executing worker or a genuine current publication gate.
 IF e.status IN('queued','running') OR v.status='running' OR NOT EXISTS(SELECT 1 FROM control.tasks WHERE task_id=r.current_task_id AND status='failed') OR v.status<>'failed' THEN RETURN jsonb_build_object('adopted',false);END IF;
 IF EXISTS(SELECT 1 FROM control.recovery_states WHERE current_task_id=r.current_task_id AND status='active' AND lease_expires_at>now()) OR EXISTS(SELECT 1 FROM control.dot_recovery_jobs WHERE run_id=p_run AND task_id=r.current_task_id AND status='running' AND claim_until>now()) THEN RETURN jsonb_build_object('adopted',false,'reason','current_owner_active');END IF;
 fingerprint:=control.lifecycle_evidence_fingerprint(e.execution_id,v.verification_run_id);
 old_failure:=control.current_lifecycle_failure(r.current_task_id);
 SELECT coalesce(jsonb_agg(i.incident_id ORDER BY i.incident_id),'[]') INTO stale FROM control.dot_incidents i WHERE i.run_id=p_run AND i.task_id=r.current_task_id AND i.status NOT IN('resolved','superseded','closed','cancelled','failed') AND
 (old_failure->'evidence'->>'protocol' IS DISTINCT FROM p_protocol::text OR i.execution_id IS DISTINCT FROM e.execution_id OR i.evidence->'lifecycle'->>'protocol' IS DISTINCT FROM p_protocol::text OR i.evidence->'lifecycle'->>'verification_run_id' IS DISTINCT FROM v.verification_run_id::text OR i.evidence->'lifecycle'->>'evidence_fingerprint' IS DISTINCT FROM fingerprint OR i.evidence->'lifecycle'->>'incident_id' IS DISTINCT FROM i.incident_id::text OR i.evidence->'lifecycle'->>'failure_fingerprint' IS DISTINCT FROM old_failure->>'fingerprint');
 IF stale='[]' AND old_failure->'evidence'->>'protocol'=p_protocol::text THEN RETURN jsonb_build_object('adopted',false);END IF;
 SELECT EXISTS(SELECT 1 FROM control.verification_results c WHERE c.verification_run_id=v.verification_run_id AND c.status IN('fail','not_run','unavailable') AND (c.trusted_receipt IS NULL OR c.trusted_registration IS NULL)) INTO missing_receipts;
 INSERT INTO control.lifecycle_recovery_adoptions VALUES(e.execution_id,v.verification_run_id,p_protocol,p_release,fingerprint,md5(jsonb_build_array(fingerprint,stale,old_failure->>'fingerprint')::text),missing_receipts,stale,now()) ON CONFLICT DO NOTHING;
 GET DIAGNOSTICS changed=ROW_COUNT;
 IF changed=0 THEN RETURN jsonb_build_object('adopted',false);END IF;
 UPDATE control.dot_recovery_jobs j SET status='superseded',claim_token=NULL,claim_until=NULL,updated_at=now(),evidence=j.evidence||jsonb_build_object('resolution','lifecycle_generation_superseded','current_execution',e.execution_id,'current_verification',v.verification_run_id,'lifecycle_protocol',p_protocol,'history_preserved',true) WHERE incident_id IN(SELECT value::text::uuid FROM jsonb_array_elements_text(stale)) AND status NOT IN('resolved','superseded','closed','cancelled','failed');
 UPDATE control.dot_incidents i SET status='superseded',claim_until=NULL,evidence=i.evidence||jsonb_build_object('resolution','lifecycle_generation_superseded','superseding_evidence_fingerprint',fingerprint,'history_preserved',true) WHERE incident_id IN(SELECT value::text::uuid FROM jsonb_array_elements_text(stale));
 -- Rebuild solely from the current generation. Missing trusted receipts are
 -- verification infrastructure debt; they never grant product retry authority.
 IF missing_receipts OR old_failure IS NOT NULL THEN
  evidence:=jsonb_build_object('protocol',p_protocol,'release_id',p_release,'verification_run_id',v.verification_run_id,'adoption_materialization',missing_receipts,'adoption_evidence_fingerprint',fingerprint,'source_fingerprint',coalesce(old_failure->'evidence'->>'source_fingerprint',fingerprint),'failed_checks',(SELECT jsonb_agg(jsonb_build_object('name',c.check_name,'command',c.command,'status',c.status,'exit_code',c.exit_code,'artifact',c.metadata->'failure_evidence'->'artifact')) FROM control.verification_results c WHERE c.verification_run_id=v.verification_run_id AND c.status IN('fail','not_run','unavailable')));
  adoption_fingerprint:=md5(evidence::text)||md5(evidence::text||'legacy-adoption');
  PERFORM control.record_lifecycle_failure(r.current_task_id,e.execution_id,adoption_fingerprint,CASE WHEN missing_receipts THEN 'VERIFIER_INFRA' ELSE coalesce(old_failure->>'classification','UNKNOWN') END,evidence);
 END IF;
 UPDATE control.recovery_states SET status='resolved',resolved_at=now(),lease_owner=NULL,lease_token=NULL,lease_expires_at=NULL,metadata=metadata||jsonb_build_object('resolution','lifecycle_generation_superseded','protocol',p_protocol,'evidence_fingerprint',fingerprint),updated_at=now() WHERE current_task_id=r.current_task_id AND status='active' AND next_action NOT IN('wait-operator','wait-decision','safety-stop');
 PERFORM control.enqueue_supervisor_wake(p_run);
 RETURN jsonb_build_object('adopted',true,'materialize_evidence',missing_receipts,'superseded',stale,'execution_id',e.execution_id,'verification_run_id',v.verification_run_id,'evidence_fingerprint',fingerprint);
END $$;
CREATE OR REPLACE FUNCTION control.record_dot_incident(p_run uuid,p_task text,p_execution bigint,p_fingerprint text,p_class text,p_evidence jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id uuid; verification bigint; lifecycle jsonb; context_fingerprint text;
BEGIN
 SELECT max(verification_run_id) INTO verification FROM control.verification_runs WHERE execution_id=p_execution;
 lifecycle:=jsonb_build_object('protocol',2,'execution_id',p_execution,'verification_run_id',verification,'evidence_fingerprint',control.lifecycle_evidence_fingerprint(p_execution,verification),'failure_fingerprint',control.current_lifecycle_failure(p_task)->>'fingerprint');
 context_fingerprint:=md5(p_fingerprint||lifecycle::text)||md5(lifecycle::text||p_fingerprint);
 id:=control.record_dot_incident_protocol_v1(p_run,p_task,p_execution,context_fingerprint,p_class,p_evidence||jsonb_build_object('lifecycle',lifecycle));
 UPDATE control.dot_incidents SET evidence=evidence||jsonb_build_object('lifecycle',lifecycle||jsonb_build_object('incident_id',id)) WHERE incident_id=id;
 RETURN id;
END $$;
COMMIT;

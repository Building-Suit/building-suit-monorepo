BEGIN;
-- Adoption is a bounded evidence reconciliation, not another task engine.
CREATE TABLE control.lifecycle_recovery_adoptions(
 execution_id bigint NOT NULL REFERENCES control.executions,
 verification_run_id bigint NOT NULL REFERENCES control.verification_runs,
 protocol integer NOT NULL CHECK(protocol=2), release_id text NOT NULL,
 evidence_fingerprint text NOT NULL, context_fingerprint text NOT NULL, materialize_evidence boolean NOT NULL,
 superseded_incidents jsonb NOT NULL, recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(execution_id,verification_run_id,protocol,context_fingerprint)
);
ALTER TABLE control.lifecycle_recovery_adoptions OWNER TO bs_control_migration_owner;
ALTER TABLE control.lifecycle_recovery_adoptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.lifecycle_recovery_adoptions FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
CREATE TRIGGER immutable_control_evidence BEFORE UPDATE OR DELETE ON control.lifecycle_recovery_adoptions FOR EACH ROW EXECUTE FUNCTION control.reject_append_only_mutation();
CREATE FUNCTION control.lifecycle_evidence_fingerprint(p_execution bigint,p_verification bigint) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT md5(coalesce(jsonb_agg(jsonb_build_array(v.verification_id,v.check_name,v.command,v.status,v.exit_code,v.metadata->'failure_evidence'->'artifact'->>'sha256',v.trusted_receipt,review.evidence) ORDER BY v.verification_id)::text,'[]'))
 FROM control.verification_results v LEFT JOIN control.verification_failure_reviews review USING(verification_id)
 WHERE v.execution_id=p_execution AND v.verification_run_id=p_verification AND v.status IN('fail','not_run','unavailable');
$$;
CREATE FUNCTION control.adopt_lifecycle_recovery(p_run uuid,p_protocol integer,p_release text) RETURNS jsonb
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
 (i.execution_id IS DISTINCT FROM e.execution_id OR i.evidence->'lifecycle'->>'protocol' IS DISTINCT FROM p_protocol::text OR i.evidence->'lifecycle'->>'verification_run_id' IS DISTINCT FROM v.verification_run_id::text OR i.evidence->'lifecycle'->>'evidence_fingerprint' IS DISTINCT FROM fingerprint OR i.evidence->'lifecycle'->>'incident_id' IS DISTINCT FROM i.incident_id::text OR i.evidence->'lifecycle'->>'failure_fingerprint' IS DISTINCT FROM old_failure->>'fingerprint');
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
-- A new protocol or trusted evidence review replaces the current pointer while
-- immutable historical generations remain untouched.
DO $$BEGIN
 EXECUTE replace(pg_get_functiondef('control.record_lifecycle_failure(text,bigint,text,text,jsonb)'::regprocedure),
 'IF result.classification=p_classification AND (result.evidence->>''verification_run_id'')::bigint IS NOT DISTINCT FROM verification THEN',
 'IF result.classification=p_classification AND (result.evidence->>''verification_run_id'')::bigint IS NOT DISTINCT FROM verification AND result.evidence->>''protocol'' IS NOT DISTINCT FROM p_evidence->>''protocol'' AND result.evidence->>''adoption_evidence_fingerprint'' IS NOT DISTINCT FROM p_evidence->>''adoption_evidence_fingerprint'' THEN');
END $$;
-- Expose bounded current generation details to the existing engine/read model.
CREATE OR REPLACE FUNCTION control.current_lifecycle_failure(p_task text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT jsonb_build_object('execution_id',e.execution_id,'fingerprint',g.fingerprint,'classification',g.classification,'evidence',g.evidence)
 FROM control.executions e JOIN control.lifecycle_failure_current c USING(execution_id) JOIN control.lifecycle_failure_generations g USING(execution_id,fingerprint)
 WHERE e.task_id=p_task AND e.execution_id=(SELECT execution_id FROM control.executions WHERE task_id=p_task ORDER BY attempt DESC,execution_id DESC LIMIT 1);
$$;
ALTER FUNCTION control.claim_recovery_action(text,bigint,text,text,text,jsonb) RENAME TO claim_recovery_action_inputs_v2;
CREATE FUNCTION control.claim_recovery_action(p_task text,p_execution bigint,p_action text,p_fingerprint text,p_classification text,p_evidence jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE adoption control.lifecycle_recovery_adoptions%ROWTYPE; inserted integer;
BEGIN
 SELECT a.* INTO adoption FROM control.lifecycle_recovery_adoptions a JOIN control.executions e USING(execution_id) JOIN control.tasks t USING(task_id) WHERE a.execution_id=p_execution AND e.task_id=p_task AND t.status='failed' AND a.materialize_evidence AND a.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=p_execution) AND a.verification_run_id=(p_evidence->>'verification_run_id')::bigint AND e.execution_id=(SELECT max(execution_id) FROM control.executions WHERE task_id=p_task) ORDER BY a.recorded_at LIMIT 1 FOR UPDATE OF t;
 IF FOUND AND p_action='task-verify' AND p_classification='VERIFIER_INFRA' THEN
  IF EXISTS(SELECT 1 FROM control.recovery_action_claims WHERE execution_id=p_execution AND evidence->>'legacy_materialization_protocol'='2') THEN RETURN jsonb_build_object('claimed',false,'reason','unchanged_recovery_action_forbidden');END IF;
  INSERT INTO control.recovery_action_claims VALUES(p_task,p_execution,p_action,p_fingerprint,p_classification,p_evidence||jsonb_build_object('legacy_materialization_protocol',2,'original_verification',adoption.verification_run_id),now()) ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS inserted=ROW_COUNT;
  RETURN jsonb_build_object('claimed',inserted=1,'reason','legacy_receipt_materialization_once');
 END IF;
 RETURN control.claim_recovery_action_inputs_v2(p_task,p_execution,p_action,p_fingerprint,p_classification,p_evidence);
END $$;
ALTER FUNCTION control.recovery_action_readiness(bigint,text,text,text) RENAME TO recovery_action_inputs_readiness_v2;
CREATE FUNCTION control.recovery_action_readiness(p_execution bigint,p_action text,p_fingerprint text,p_source text) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT CASE WHEN p_action='task-verify' AND EXISTS(SELECT 1 FROM control.lifecycle_recovery_adoptions a WHERE a.execution_id=p_execution AND a.materialize_evidence AND a.verification_run_id=(SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=p_execution)) THEN jsonb_build_object('allowed',NOT EXISTS(SELECT 1 FROM control.recovery_action_claims WHERE execution_id=p_execution AND evidence->>'legacy_materialization_protocol'='2')) ELSE control.recovery_action_inputs_readiness_v2(p_execution,p_action,p_fingerprint,p_source) END;
$$;
-- Fresh incidents carry exact lifecycle identity, preventing stale health from
-- becoming their authority. Existing semantic fingerprint/budget rules remain.
ALTER FUNCTION control.record_dot_incident(uuid,text,bigint,text,text,jsonb) RENAME TO record_dot_incident_protocol_v1;
CREATE FUNCTION control.record_dot_incident(p_run uuid,p_task text,p_execution bigint,p_fingerprint text,p_class text,p_evidence jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id uuid; verification bigint; lifecycle jsonb;
BEGIN
 SELECT max(verification_run_id) INTO verification FROM control.verification_runs WHERE execution_id=p_execution;
 lifecycle:=jsonb_build_object('protocol',2,'execution_id',p_execution,'verification_run_id',verification,'evidence_fingerprint',control.lifecycle_evidence_fingerprint(p_execution,verification),'failure_fingerprint',control.current_lifecycle_failure(p_task)->>'fingerprint');
 id:=control.record_dot_incident_protocol_v1(p_run,p_task,p_execution,p_fingerprint,p_class,p_evidence||jsonb_build_object('lifecycle',lifecycle));
 UPDATE control.dot_incidents SET evidence=evidence||jsonb_build_object('lifecycle',lifecycle||jsonb_build_object('incident_id',id)) WHERE incident_id=id;
 RETURN id;
END $$;
DO $$ DECLARE f regprocedure;BEGIN
 FOR f IN SELECT p.oid::regprocedure FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='control' AND p.proname IN('lifecycle_evidence_fingerprint','adopt_lifecycle_recovery','claim_recovery_action','recovery_action_readiness','record_dot_incident') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',f);EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator',f);
 END LOOP;
END $$;
REVOKE ALL ON FUNCTION control.claim_recovery_action_inputs_v2(text,bigint,text,text,text,jsonb),control.recovery_action_inputs_readiness_v2(bigint,text,text,text),control.record_dot_incident_protocol_v1(uuid,text,bigint,text,text,jsonb) FROM bs_runtime_executor,bs_control_observer,bs_control_executor;
GRANT EXECUTE ON FUNCTION control.adopt_lifecycle_recovery(uuid,integer,text),control.claim_recovery_action(text,bigint,text,text,text,jsonb),control.recovery_action_readiness(bigint,text,text,text),control.record_dot_incident(uuid,text,bigint,text,text,jsonb) TO bs_runtime_executor;
COMMIT;

BEGIN;
CREATE OR REPLACE FUNCTION control.dot_signal() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE v_new jsonb:=to_jsonb(NEW); v_old jsonb; v_event bigint; kind text; identity text;
BEGIN
 IF TG_TABLE_NAME='recovery_states' AND v_new->>'error_code'='retry_exhaustion_reconciled' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' THEN
  v_old:=to_jsonb(OLD);
  -- Ignore heartbeats and lease renewals; state transitions and evidence wake Dot.
  IF (v_new->'status',v_new->'engine_stage',v_new->'current_task_id',v_new->'completed_tasks',v_new->'next_action',v_new->'failure_class',v_new->'verification_plan',v_new->'execution_id',v_new->'commit_sha',v_new->'error_code',v_new->'failure_id')
   IS NOT DISTINCT FROM (v_old->'status',v_old->'engine_stage',v_old->'current_task_id',v_old->'completed_tasks',v_old->'next_action',v_old->'failure_class',v_old->'verification_plan',v_old->'execution_id',v_old->'commit_sha',v_old->'error_code',v_old->'failure_id') THEN RETURN NEW; END IF;
 END IF;
 kind:=CASE WHEN TG_TABLE_NAME='product_attempt_classifications' AND v_new#>>'{evidence,audited}'='true' THEN 'derived' ELSE 'state' END;
 identity:=md5(jsonb_build_array(TG_TABLE_NAME,v_new->'task_id',v_new->'execution_id',v_new->'evidence_fingerprint',v_new->'run_id',v_new->'workflow_run_id',v_new->'status',v_new->'engine_stage',v_new->'current_task_id',v_new->'completed_tasks',v_new->'next_action',v_new->'failure_class',v_new->'verification_plan',v_new->'execution_id',v_new->'commit_sha',v_new->'error_code',v_new->'failure_id',v_new->'verification_run_id',v_new->'attempt',v_new->'recovery_state_id',v_new->'pull_request_id',v_new->'state')::text);
 INSERT INTO control.dot_wake_events(origin,payload,wake_kind,wake_identity) VALUES(TG_TABLE_NAME,jsonb_build_object('run_id',coalesce(v_new->>'run_id',v_new->>'workflow_run_id'),'task_id',coalesce(v_new->>'task_id',v_new->>'current_task_id'),'execution_id',v_new->>'execution_id','status',v_new->>'status'),kind,identity)
 -- Advance the identifier on a repeated authoritative transition. Coalescing
 -- must never let an old scan watermark acknowledge a later A->B->A change.
 ON CONFLICT(wake_identity) WHERE consumed_at IS NULL AND wake_identity IS NOT NULL
 DO UPDATE SET event_id=DEFAULT,payload=excluded.payload,created_at=now() RETURNING event_id INTO v_event;
 IF v_event IS NULL OR kind='derived' THEN RETURN NEW;END IF;
 PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',v_event)::text);
 RETURN NEW;
END $$;

-- Operator approval was previously NOTIFY-only. The relay reads an outbox, so
-- notifications must have a durable, subject-bound identifier across restart.
CREATE FUNCTION control.dot_operator_authority_signal() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF NEW.response<>'approve' THEN RETURN NEW;END IF;
 INSERT INTO control.dot_wake_events(origin,payload,wake_kind,wake_identity)
 VALUES('operator_gate_resolved',jsonb_build_object('run_id',NEW.run_id,'task_id',NEW.task_id,'event_type','operator_gate_resolved','authority_event_id',NEW.event_id,'action',NEW.action,'incident_id',NEW.offer->>'incident_id'),'state',md5('operator-authority:'||NEW.event_id))
 ON CONFLICT(wake_identity) WHERE consumed_at IS NULL AND wake_identity IS NOT NULL DO NOTHING RETURNING event_id INTO id;
 IF id IS NOT NULL THEN PERFORM pg_notify('bs_dot_wake',jsonb_build_object('event_id',id)::text);END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION control.dot_operator_authority_signal() OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.dot_operator_authority_signal() FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
CREATE TRIGGER dot_operator_authority_changed AFTER INSERT ON control.operator_authority_events FOR EACH ROW EXECUTE FUNCTION control.dot_operator_authority_signal();
CREATE FUNCTION control.dot_lifecycle_event_signal() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF NEW.event_type NOT IN('operator_gate_resolved','verification_finished','recovery_budget_extended','incident_extension_authorized','failure_classification_required','task_completed','publication_completed','task_ready','verifier_only_reaccepted') THEN RETURN NEW;END IF;
 INSERT INTO control.dot_wake_events(origin,payload,wake_kind,wake_identity)
 VALUES('task-lifecycle',jsonb_build_object('task_id',NEW.task_id,'run_id',NEW.payload->>'run_id','event_type',NEW.event_type,'task_event_id',NEW.event_id),'state',md5('task-lifecycle:'||NEW.event_id));
 RETURN NEW;
END $$;
ALTER FUNCTION control.dot_lifecycle_event_signal() OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.dot_lifecycle_event_signal() FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_operator,bs_control_verifier;
CREATE TRIGGER dot_lifecycle_event_changed AFTER INSERT ON control.task_events FOR EACH ROW EXECUTE FUNCTION control.dot_lifecycle_event_signal();
CREATE FUNCTION control.claim_approved_dot_incident(p_run uuid,p_incident uuid,p_grant bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE r control.workflow_runs%ROWTYPE; j control.dot_recovery_jobs%ROWTYPE; g control.operator_invocation_extensions%ROWTYPE;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run FOR UPDATE;
 IF r.run_id IS NULL OR r.status NOT IN('running','failed') OR r.stop_requested OR r.maintenance_requested OR r.completed_tasks>=r.max_tasks THEN RETURN jsonb_build_object('claimed',false,'reason','hard_run_gate');END IF;
 SELECT * INTO g FROM control.operator_invocation_extensions WHERE grant_id=p_grant AND run_id=p_run AND incident_id=p_incident FOR UPDATE;
 IF g.grant_id IS NULL OR g.kind<>'incident-investigation-extension' OR g.task_id IS DISTINCT FROM r.current_task_id OR g.revoked_at IS NOT NULL OR g.consumed_at IS NOT NULL OR g.granted_at<=now()-interval '45 minutes'
 OR NOT EXISTS(SELECT 1 FROM control.operator_authority_events a WHERE a.event_id=g.event_id AND a.response='approve' AND a.action=g.kind AND a.run_id=g.run_id AND a.offer->>'incident_id'=p_incident::text)
 THEN RETURN jsonb_build_object('claimed',false,'reason','current_incident_approval_required');END IF;
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_incident FOR UPDATE;
 IF j.run_id IS DISTINCT FROM p_run OR j.task_id IS DISTINCT FROM r.current_task_id OR j.status NOT IN('queued','running') THEN RETURN jsonb_build_object('claimed',false,'reason','incident_not_actionable');END IF;
 IF EXISTS(SELECT 1 FROM control.recovery_states s WHERE s.current_task_id=r.current_task_id AND s.status='active' AND s.next_action IN('wait-operator','wait-decision','safety-stop') AND s.error_code NOT IN('retry_budget_exhausted','retry_audit_investigation_required')) THEN RETURN jsonb_build_object('claimed',false,'reason','authoritative_safety_gate');END IF;
 IF j.claim_until>now() OR j.next_check_at>now() OR EXISTS(SELECT 1 FROM control.dot_recovery_jobs other WHERE other.run_id=p_run AND other.incident_id<>p_incident AND other.status='running' AND other.claim_until>now()) THEN RETURN jsonb_build_object('claimed',false,'reason','incident_owned');END IF;
 UPDATE control.dot_recovery_jobs SET status='running',claim_token=gen_random_uuid(),claim_until=now()+interval '3 minutes',next_check_at=now()+interval '2 minutes',attempts=attempts+1,updated_at=now() WHERE incident_id=p_incident RETURNING * INTO j;
 UPDATE control.dot_incidents SET status='recovering',claim_until=j.claim_until WHERE incident_id=p_incident;
 RETURN jsonb_build_object('claimed',true,'job',to_jsonb(j),'grant_id',g.grant_id);
END $$;
ALTER FUNCTION control.claim_approved_dot_incident(uuid,uuid,bigint) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.claim_approved_dot_incident(uuid,uuid,bigint) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_observer,bs_control_operator,bs_control_verifier;
GRANT EXECUTE ON FUNCTION control.claim_approved_dot_incident(uuid,uuid,bigint) TO bs_control_executor;
-- Catch existing unconsumed approvals once; do not alter budgets or approval time.
INSERT INTO control.dot_wake_events(origin,payload,wake_kind,wake_identity)
SELECT 'operator_gate_resolved',jsonb_build_object('run_id',g.run_id,'task_id',g.task_id,'incident_id',g.incident_id,'authority_event_id',g.event_id,'event_type','operator_gate_resolved'),'state',md5('operator-authority:'||g.event_id)
FROM control.operator_invocation_extensions g WHERE g.kind='incident-investigation-extension' AND g.revoked_at IS NULL AND g.consumed_at IS NULL AND g.granted_at>now()-interval '45 minutes'
ON CONFLICT(wake_identity) WHERE consumed_at IS NULL AND wake_identity IS NOT NULL DO NOTHING;
COMMIT;

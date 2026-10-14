BEGIN;
CREATE FUNCTION control.operator_gate_status(p_run uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE offers jsonb; r control.workflow_runs%ROWTYPE; reason text;
BEGIN
 SELECT * INTO r FROM control.workflow_runs WHERE run_id=p_run;
 offers:=CASE WHEN p_run IS NULL THEN '[]'::jsonb ELSE control.operator_gate_offers(p_run) END;
 IF jsonb_array_length(offers)=0 THEN
 reason:=CASE WHEN p_run IS NULL THEN 'task_has_no_existing_bounded_run_authority'
 WHEN r.run_id IS NULL THEN 'registered_bounded_run_required'
 WHEN NOT control.run_is_actionable(r.status,r.current_task_id,r.finished_at) THEN 'terminal_run_cannot_be_released'
 WHEN EXISTS(SELECT 1 FROM control.run_ordinary_publication_authorizations WHERE run_id=p_run AND revoked_at IS NOT NULL) THEN 'bounded_authority_revoked_no_automatic_restoration'
 WHEN EXISTS(SELECT 1 FROM control.dot_recovery_jobs WHERE run_id=p_run AND status='human-gate') THEN 'incident_change_exceeds_the_authorized_runtime_safety_boundary'
 ELSE 'no_current_registered_release_authority_or_trusted_external_evidence' END;
 END IF;
 RETURN jsonb_build_object('gate_offers',offers,'gate_id',offers#>>'{0,gate_id}','hard_policy_reason',reason,'bs22_path','/form/building-suit-operator-gates');
END $$;
CREATE FUNCTION control.operator_gate_review(p_run uuid) RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,control AS $$
 SELECT control.operator_gate_status(p_run)||jsonb_build_object('gates',control.operator_gate_offers(p_run)||coalesce((
 SELECT jsonb_agg(ev.offer||jsonb_build_object('available_responses',jsonb_build_array('revoke'),'choice_suffix','approved unused authority','actor_id',ev.actor_id,'authority_event_id',ev.event_id)) FROM control.operator_authority_events ev
 WHERE ev.run_id=p_run AND ev.response='approve' AND NOT EXISTS(SELECT 1 FROM control.operator_authority_events rev WHERE rev.run_id=ev.run_id AND rev.gate_fingerprint=ev.gate_fingerprint AND rev.response='revoke') AND NOT EXISTS(SELECT 1 FROM control.operator_invocation_extensions g WHERE g.event_id=ev.event_id AND (g.consumed_at IS NOT NULL OR g.invocation_id IS NOT NULL))
 AND NOT EXISTS(SELECT 1 FROM control.task_events progress WHERE progress.task_id=ev.task_id AND progress.event_type='publication_completed' AND progress.created_at>=ev.recorded_at)
 AND ev.action NOT IN('external-evidence-acknowledgement','incident-human-resolution')
 ),'[]'::jsonb));
$$;
-- Keep resolution serialized and append-only; revocation never undoes already
-- consumed publication/model/execution authority or cancels an owned worker.
DO $$DECLARE definition text;BEGIN
 definition:=pg_get_functiondef('control.resolve_authenticated_operator_gate(uuid,uuid,text,text)'::regprocedure);
 definition:=replace(definition,'AND consumed_at IS NOT NULL)', 'AND (consumed_at IS NOT NULL OR invocation_id IS NOT NULL))');
 definition:=replace(definition,' INSERT INTO control.operator_authority_events(', $replacement$ IF p_response='revoke' AND EXISTS(SELECT 1 FROM control.task_events progress JOIN control.operator_authority_events auth ON auth.run_id=p_run AND auth.gate_fingerprint=p_gate AND auth.response='approve' WHERE progress.task_id=auth.task_id AND progress.event_type='publication_completed' AND progress.created_at>=auth.recorded_at) THEN RAISE EXCEPTION 'consumed_publication_authority_cannot_be_revoked';END IF;
 IF item->>'action'='registered-decision' AND p_response='approve' THEN item:=item||jsonb_build_object('previous_decision_status',(SELECT status FROM control.decisions WHERE suit_slug=item->>'decision_suit' AND decision_id=item->>'decision_id'));END IF;
 INSERT INTO control.operator_authority_events($replacement$);
 definition:=replace(definition, $find$ ELSIF p_response='revoke' THEN
 UPDATE control.operator_invocation_extensions$find$, $replacement$ ELSIF p_response='revoke' THEN
 IF item->>'action' IN('maintenance-hold-release','registered-decision','bounded-run-release') AND EXISTS(SELECT 1 FROM control.workflow_runs run WHERE run.run_id=p_run AND run.controller_lease_expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'active_owned_authority_cannot_be_revoked';END IF;
 IF item->>'action'='maintenance-hold-release' THEN UPDATE control.workflow_runs SET stop_requested=(item->>'stop_requested')::boolean,maintenance_requested=(item->>'maintenance_requested')::boolean,run_revision=run_revision+1 WHERE run_id=p_run;
 ELSIF item->>'action'='bounded-run-release' THEN UPDATE control.run_ordinary_publication_authorizations SET revoked_at=now() WHERE run_id=p_run;
 ELSIF item->>'action'='registered-decision' THEN
 IF EXISTS(SELECT 1 FROM control.executions WHERE task_id=item->>'task_id' AND started_at>=(SELECT recorded_at FROM control.operator_authority_events WHERE run_id=p_run AND gate_fingerprint=p_gate AND response='approve')) THEN RAISE EXCEPTION 'consumed_decision_authority_cannot_be_revoked';END IF;
 UPDATE control.decisions SET status=item->>'previous_decision_status',updated_at=now(),metadata=metadata||jsonb_build_object('revoked_authenticated_operator_event',ev.event_id) WHERE suit_slug=item->>'decision_suit' AND decision_id=item->>'decision_id';
 ELSIF item->>'action' IN('external-evidence-acknowledgement','incident-human-resolution') THEN RAISE EXCEPTION 'consumed_acknowledgement_cannot_be_revoked';END IF;
 UPDATE control.operator_invocation_extensions$replacement$);
 EXECUTE definition;
END $$;
REVOKE ALL ON FUNCTION control.operator_gate_status(uuid),control.operator_gate_review(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.operator_gate_status(uuid),control.operator_gate_review(uuid) TO bs_control_executor,bs_control_observer,bs_control_operator;
ALTER FUNCTION control.operator_gate_status(uuid) OWNER TO bs_control_migration_owner;
ALTER FUNCTION control.operator_gate_review(uuid) OWNER TO bs_control_migration_owner;
COMMIT;

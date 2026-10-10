BEGIN;
CREATE TABLE control.dot_model_invocations (
 invocation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 incident_id uuid NOT NULL REFERENCES control.dot_incidents,
 receipt_key text NOT NULL, claim_token uuid NOT NULL,
 status text NOT NULL CHECK(status IN('reserved','launched','finished','aborted')),
 reserved_at timestamptz NOT NULL DEFAULT now(), launched_at timestamptz, finished_at timestamptz,
 before_fingerprint text NOT NULL CHECK(before_fingerprint ~ '^[a-f0-9]{64}$'),
 after_fingerprint text CHECK(after_fingerprint ~ '^[a-f0-9]{64}$'),
 progressed boolean, UNIQUE(incident_id,receipt_key)
);
ALTER TABLE control.dot_model_invocations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.dot_model_invocations FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.dot_model_invocations TO bs_control_app;
CREATE FUNCTION control.reserve_dot_model_invocation(p_incident uuid,p_token uuid,p_receipt text,p_before text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE j control.dot_recovery_jobs%ROWTYPE; existing control.dot_model_invocations%ROWTYPE;
 actual integer; pending integer; first_launch timestamptz; streak integer;
BEGIN
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=p_incident FOR UPDATE;
 IF j.claim_token IS DISTINCT FROM p_token OR j.status<>'running' OR j.claim_until<=now() THEN
  RAISE EXCEPTION 'investigation_claim_required'; END IF;
 SELECT * INTO existing FROM control.dot_model_invocations WHERE incident_id=p_incident AND receipt_key=p_receipt;
 IF existing.invocation_id IS NOT NULL THEN
 UPDATE control.dot_model_invocations SET claim_token=p_token WHERE invocation_id=existing.invocation_id AND status IN('reserved','launched');
 RETURN to_jsonb(existing)||jsonb_build_object('allowed',existing.status IN('reserved','launched')); END IF;
 SELECT count(*) FILTER(WHERE launched_at IS NOT NULL),count(*) FILTER(WHERE status='reserved'),min(launched_at)
 INTO actual,pending,first_launch FROM control.dot_model_invocations WHERE incident_id=p_incident;
 SELECT count(*) INTO streak FROM control.dot_model_invocations x WHERE x.incident_id=p_incident
 AND x.launched_at IS NOT NULL AND x.finished_at IS NOT NULL AND x.progressed IS NOT TRUE
 AND x.invocation_id>coalesce((SELECT max(y.invocation_id) FROM control.dot_model_invocations y WHERE y.incident_id=p_incident AND y.progressed),0);
 IF actual+pending>=3 OR first_launch<=now()-interval '45 minutes' OR streak>=2 THEN
  UPDATE control.dot_recovery_jobs SET status='human-gate',claim_until=NULL,evidence=evidence||jsonb_build_object(
   'gate_kind','incident-investigation-extension','actual_model_invocations',actual,'no_progress_streak',streak,
   'first_launched_at',first_launch,'reason','incident_investigation_budget_exhausted','requested_extra_invocations',1) WHERE incident_id=p_incident;
  UPDATE control.dot_incidents SET status='operator-gate',claim_until=NULL WHERE incident_id=p_incident;
  RETURN jsonb_build_object('allowed',false,'actual_invocations',actual,'no_progress_streak',streak,'reason','incident_investigation_budget_exhausted');
 END IF;
 INSERT INTO control.dot_model_invocations(incident_id,receipt_key,claim_token,status,before_fingerprint)
 VALUES(p_incident,p_receipt,p_token,'reserved',p_before) RETURNING * INTO existing;
 RETURN to_jsonb(existing)||jsonb_build_object('allowed',true,'remaining_ms',CASE WHEN first_launch IS NULL THEN 2700000 ELSE greatest(0,2700000-extract(epoch FROM(now()-first_launch))*1000)::bigint END);
END $$;
CREATE FUNCTION control.record_dot_model_launch(p_incident uuid,p_token uuid,p_receipt text,p_launched timestamptz)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 UPDATE control.dot_model_invocations SET status='launched',launched_at=coalesce(launched_at,p_launched)
 WHERE incident_id=p_incident AND claim_token=p_token AND receipt_key=p_receipt AND status IN('reserved','launched');
 IF NOT FOUND THEN RAISE EXCEPTION 'investigation_launch_reservation_required'; END IF;
END $$;
CREATE FUNCTION control.finish_dot_model_invocation(p_incident uuid,p_token uuid,p_receipt text,p_after text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 UPDATE control.dot_model_invocations SET status=CASE WHEN launched_at IS NULL THEN 'aborted' ELSE 'finished' END,
 finished_at=now(),after_fingerprint=p_after,progressed=before_fingerprint IS DISTINCT FROM p_after
 WHERE incident_id=p_incident AND claim_token=p_token AND receipt_key=p_receipt AND status IN('reserved','launched');
END $$;
REVOKE ALL ON FUNCTION control.reserve_dot_model_invocation(uuid,uuid,text,text),control.record_dot_model_launch(uuid,uuid,text,timestamptz),control.finish_dot_model_invocation(uuid,uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION control.reserve_dot_model_invocation(uuid,uuid,text,text),control.record_dot_model_launch(uuid,uuid,text,timestamptz),control.finish_dot_model_invocation(uuid,uuid,text,text) TO bs_control_app;
COMMIT;

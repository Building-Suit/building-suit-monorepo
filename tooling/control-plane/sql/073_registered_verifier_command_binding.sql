BEGIN;
ALTER TABLE control.verification_results ADD COLUMN trusted_registration jsonb;
CREATE FUNCTION control.register_trusted_verification_command(p_id bigint,p_registration jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF NOT FOUND OR c.verification_run_id IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=c.execution_id)
 OR p_registration->>'version' IS DISTINCT FROM '1'
 OR (p_registration->>'check_id')::bigint IS DISTINCT FROM c.verification_id
 OR (p_registration->>'execution_id')::bigint IS DISTINCT FROM c.execution_id
 OR (p_registration->>'verification_run_id')::bigint IS DISTINCT FROM c.verification_run_id
 OR p_registration->>'task_id' IS DISTINCT FROM (SELECT task_id FROM control.executions WHERE execution_id=c.execution_id)
 OR p_registration->>'command' IS DISTINCT FROM c.command OR p_registration->>'command_id' IS DISTINCT FROM c.check_name
 OR coalesce(p_registration->>'command_version','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_registration->>'registry_version','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_registration->>'verifier_sha256','') !~ '^[a-f0-9]{64}$'
 OR jsonb_typeof(p_registration->'obligation_ids') IS DISTINCT FROM 'array' OR jsonb_array_length(p_registration->'obligation_ids')<1
 THEN RAISE EXCEPTION 'trusted_registered_command_binding_required';END IF;
 IF c.trusted_registration IS NOT NULL AND c.trusted_registration IS DISTINCT FROM p_registration THEN RAISE EXCEPTION 'immutable_command_registration_conflict';END IF;
 UPDATE control.verification_results SET trusted_registration=p_registration WHERE verification_id=p_id AND trusted_registration IS NULL;
 RETURN p_registration;
END $$;
CREATE FUNCTION control.preserve_trusted_command_registration() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE owner_name text;
BEGIN
 SELECT pg_get_userbyid(proowner) INTO owner_name FROM pg_proc WHERE oid='control.register_trusted_verification_command(bigint,jsonb)'::regprocedure;
 IF TG_OP='UPDATE' AND OLD.trusted_registration IS NOT NULL AND NEW.trusted_registration IS DISTINCT FROM OLD.trusted_registration THEN RAISE EXCEPTION 'immutable_command_registration_conflict';END IF;
 IF NEW.trusted_registration IS NOT NULL AND (TG_OP='INSERT' OR NEW.trusted_registration IS DISTINCT FROM OLD.trusted_registration) AND current_user IS DISTINCT FROM owner_name THEN RAISE EXCEPTION 'trusted_command_registration_capability_required';END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER trusted_command_registration_guard BEFORE INSERT OR UPDATE ON control.verification_results FOR EACH ROW EXECUTE FUNCTION control.preserve_trusted_command_registration();
CREATE OR REPLACE FUNCTION control.capture_verifier_receipt(p_id bigint,p_receipt jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF c.verification_id IS NULL OR c.status NOT IN('pass','fail','not_run','skipped','unavailable')
 OR p_receipt->>'version' IS DISTINCT FROM '2'
 OR (p_receipt->>'check_id')::bigint IS DISTINCT FROM c.verification_id
 OR (p_receipt->>'execution_id')::bigint IS DISTINCT FROM c.execution_id
 OR (p_receipt->>'verification_run_id')::bigint IS DISTINCT FROM c.verification_run_id
 OR p_receipt->'registration' IS DISTINCT FROM c.trusted_registration
 OR c.trusted_registration IS NULL
 OR p_receipt->>'verifier_version' IS DISTINCT FROM 'trusted-receipt-v2'
 OR (p_receipt->>'evidence_generation')::bigint IS DISTINCT FROM c.verification_run_id
 OR p_receipt->>'task_id' IS DISTINCT FROM (SELECT task_id FROM control.executions WHERE execution_id=c.execution_id)
 OR nullif(p_receipt->>'run_id','')::uuid IS DISTINCT FROM (SELECT run_id FROM control.workflow_runs WHERE current_task_id=(SELECT task_id FROM control.executions WHERE execution_id=c.execution_id) AND status IN('running','failed') ORDER BY started_at DESC LIMIT 1)
 OR p_receipt->>'check_name' IS DISTINCT FROM c.check_name
 OR p_receipt->>'command' IS DISTINCT FROM c.command
 OR p_receipt->>'status' IS DISTINCT FROM c.status
 OR (p_receipt->>'exit_code')::integer IS DISTINCT FROM c.exit_code
 OR p_receipt#>>'{artifact,path}' IS DISTINCT FROM c.log_path
 OR coalesce(p_receipt#>>'{artifact,sha256}','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_receipt->>'source_fingerprint','') !~ '^[a-f0-9]{64}$'
 OR coalesce(p_receipt->>'command_version','') !~ '^[a-f0-9]{64}$'
 OR p_receipt->>'command_version' IS DISTINCT FROM c.trusted_registration->>'command_version'
 OR p_receipt->>'started_at' IS NULL OR p_receipt->>'finished_at' IS NULL
 OR (p_receipt->>'finished_at')::timestamptz < (p_receipt->>'started_at')::timestamptz
 OR c.verification_run_id IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=c.execution_id)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='trusted_verifier_receipt_binding_mismatch'; END IF;
 IF c.trusted_receipt IS NOT NULL AND c.trusted_receipt IS DISTINCT FROM p_receipt THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='immutable_verifier_receipt_conflict';
 END IF;
 UPDATE control.verification_results SET trusted_receipt=p_receipt WHERE verification_id=p_id AND trusted_receipt IS NULL;
END $$;
REVOKE ALL ON FUNCTION control.register_trusted_verification_command(bigint,jsonb),control.preserve_trusted_command_registration() FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT EXECUTE ON FUNCTION control.register_trusted_verification_command(bigint,jsonb) TO bs_control_verifier;
DO $$BEGIN
 EXECUTE replace(pg_get_functiondef('control.review_verification_failure(bigint,jsonb)'::regprocedure), 'IF c.trusted_receipt IS NULL', $replacement$IF c.trusted_receipt IS NULL OR c.trusted_receipt->>'version' IS DISTINCT FROM '2'
 OR p_evidence->>'task_id' IS DISTINCT FROM c.trusted_receipt->>'task_id'
 OR p_evidence->'run_id' IS DISTINCT FROM c.trusted_receipt->'run_id'
 OR (p_evidence->>'evidence_generation')::bigint IS DISTINCT FROM c.verification_run_id
 OR p_evidence->'registered_command' IS DISTINCT FROM c.trusted_registration$replacement$);
 EXECUTE replace(pg_get_functiondef('control.product_retry_accounting(text)'::regprocedure), 'vr.trusted_receipt IS NOT NULL', $replacement$vr.trusted_receipt IS NOT NULL AND vr.trusted_receipt->>'version'='2' AND vr.trusted_registration IS NOT NULL$replacement$);
END $$;
COMMIT;

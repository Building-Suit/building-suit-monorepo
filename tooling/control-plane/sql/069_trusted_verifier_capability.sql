BEGIN;
DO $$BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_verifier') THEN CREATE ROLE bs_control_verifier NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE INHERIT;END IF;
END $$;
-- Membership is one-way: the verifier can use ordinary read/verification APIs;
-- the runtime cannot SET ROLE to the trusted verifier or mint bound receipts.
GRANT bs_control_app TO bs_control_verifier;
GRANT USAGE ON SCHEMA control TO bs_control_verifier;
REVOKE ALL ON FUNCTION control.capture_verifier_receipt(bigint,jsonb),control.review_verification_failure(bigint,jsonb) FROM bs_control_app;
GRANT EXECUTE ON FUNCTION control.capture_verifier_receipt(bigint,jsonb),control.review_verification_failure(bigint,jsonb) TO bs_control_verifier;
CREATE OR REPLACE FUNCTION control.preserve_trusted_verifier_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
DECLARE function_owner text;
BEGIN
 SELECT pg_get_userbyid(proowner) INTO function_owner FROM pg_proc WHERE oid='control.capture_verifier_receipt(bigint,jsonb)'::regprocedure;
 IF NEW.trusted_receipt IS NOT NULL AND (TG_OP='INSERT' OR NEW.trusted_receipt IS DISTINCT FROM OLD.trusted_receipt)
 AND current_user IS DISTINCT FROM function_owner AND NOT pg_has_role(current_user,'bs_control_verifier','MEMBER') THEN
 RAISE EXCEPTION 'trusted_verifier_capability_required';END IF;
 IF TG_OP='UPDATE' AND OLD.trusted_receipt IS NOT NULL AND
 (NEW.trusted_receipt IS DISTINCT FROM OLD.trusted_receipt OR
 ROW(NEW.execution_id,NEW.verification_run_id,NEW.check_name,NEW.command,NEW.status,NEW.exit_code,NEW.log_path)
 IS DISTINCT FROM ROW(OLD.execution_id,OLD.verification_run_id,OLD.check_name,OLD.command,OLD.status,OLD.exit_code,OLD.log_path)) THEN
 RAISE EXCEPTION 'immutable_verifier_receipt_conflict';END IF;
 RETURN NEW;
END $$;
DROP TRIGGER immutable_trusted_verifier_receipt ON control.verification_results;
CREATE TRIGGER immutable_trusted_verifier_receipt BEFORE INSERT OR UPDATE ON control.verification_results FOR EACH ROW EXECUTE FUNCTION control.preserve_trusted_verifier_receipt();
-- Destructive history operations are never runtime capabilities.
REVOKE DELETE,TRUNCATE,TRIGGER,REFERENCES ON ALL TABLES IN SCHEMA control FROM bs_control_app;
REVOKE CREATE ON SCHEMA control FROM bs_control_app,bs_control_verifier;
COMMIT;

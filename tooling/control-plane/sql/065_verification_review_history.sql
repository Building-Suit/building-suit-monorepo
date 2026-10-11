BEGIN;
CREATE TABLE control.verification_review_revisions(
 revision_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 verification_id bigint NOT NULL REFERENCES control.verification_results,
 check_fingerprint text NOT NULL,evidence jsonb NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),revision_source text NOT NULL
);
ALTER TABLE control.verification_review_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY verifier_review_history_read ON control.verification_review_revisions FOR SELECT TO bs_control_app USING(true);
REVOKE ALL ON control.verification_review_revisions FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.verification_review_revisions TO bs_control_app;
INSERT INTO control.verification_review_revisions(verification_id,check_fingerprint,evidence,recorded_at,revision_source)
SELECT verification_id,check_fingerprint,evidence,reviewed_at,'preserved_pre_ledger_review' FROM control.verification_failure_reviews;
CREATE FUNCTION control.audit_verification_review_revision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='INSERT' OR OLD.evidence IS DISTINCT FROM NEW.evidence OR OLD.check_fingerprint IS DISTINCT FROM NEW.check_fingerprint THEN
 INSERT INTO control.verification_review_revisions(verification_id,check_fingerprint,evidence,revision_source)
 VALUES(NEW.verification_id,NEW.check_fingerprint,NEW.evidence,'trusted_review_reconciliation');END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER verification_review_revision AFTER INSERT OR UPDATE ON control.verification_failure_reviews FOR EACH ROW EXECUTE FUNCTION control.audit_verification_review_revision();
REVOKE ALL ON FUNCTION control.audit_verification_review_revision() FROM PUBLIC,anon,authenticated,bs_control_app;
COMMIT;

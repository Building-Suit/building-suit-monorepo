BEGIN;
-- Capture scope only when operator-owned ordinary task authority is inserted.
-- Runtime workers cannot INSERT this table or write the frozen scope table.
CREATE OR REPLACE FUNCTION control.capture_dot_authorized_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.publication_readiness_contracts%ROWTYPE; g control.run_ordinary_publication_authorizations%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.publication_readiness_contracts WHERE task_id=NEW.task_id;
 SELECT * INTO g FROM control.run_ordinary_publication_authorizations WHERE run_id=NEW.run_id;
 IF g.revoked_at IS NULL AND c.valid AND c.input_generation=NEW.input_generation
  AND c.contract_fingerprint=NEW.contract_fingerprint
  AND NEW.verification_fingerprint=control.verification_contract_fingerprint(NEW.task_id) THEN
  INSERT INTO control.dot_task_scope_authorities(run_id,task_id,required_paths,scope_fingerprint,audit_evidence)
  VALUES(NEW.run_id,NEW.task_id,c.required_paths,control.dot_scope_fingerprint(NEW.task_id),g.audit_evidence)
  ON CONFLICT(run_id,task_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION control.capture_dot_authorized_scope() FROM PUBLIC;
CREATE TRIGGER dot_capture_authorized_scope AFTER INSERT ON control.run_task_publication_authorities
 FOR EACH ROW EXECUTE FUNCTION control.capture_dot_authorized_scope();
-- Existing exact/current operator authority is sufficient; stale scope is not inferred.
INSERT INTO control.dot_task_scope_authorities(run_id,task_id,required_paths,scope_fingerprint,audit_evidence)
SELECT a.run_id,a.task_id,c.required_paths,control.dot_scope_fingerprint(a.task_id),g.audit_evidence
FROM control.run_task_publication_authorities a
JOIN control.run_ordinary_publication_authorizations g USING(run_id)
JOIN control.publication_readiness_contracts c USING(task_id)
WHERE g.revoked_at IS NULL AND c.valid AND c.input_generation=a.input_generation
 AND c.contract_fingerprint=a.contract_fingerprint
 AND a.verification_fingerprint=control.verification_contract_fingerprint(a.task_id)
ON CONFLICT(run_id,task_id) DO NOTHING;
COMMIT;

BEGIN;
ALTER TABLE control.verification_results ADD COLUMN trusted_receipt jsonb;

CREATE FUNCTION control.capture_verifier_receipt(p_id bigint,p_receipt jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF c.verification_id IS NULL OR c.status NOT IN('pass','fail','not_run','skipped','unavailable')
 OR p_receipt->>'version' IS DISTINCT FROM '1'
 OR (p_receipt->>'check_id')::bigint IS DISTINCT FROM c.verification_id
 OR (p_receipt->>'execution_id')::bigint IS DISTINCT FROM c.execution_id
 OR (p_receipt->>'verification_run_id')::bigint IS DISTINCT FROM c.verification_run_id
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
 OR p_receipt->>'started_at' IS NULL OR p_receipt->>'finished_at' IS NULL
 OR (p_receipt->>'finished_at')::timestamptz < (p_receipt->>'started_at')::timestamptz
 OR c.verification_run_id IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=c.execution_id)
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='trusted_verifier_receipt_binding_mismatch'; END IF;
 IF c.trusted_receipt IS NOT NULL AND c.trusted_receipt IS DISTINCT FROM p_receipt THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='immutable_verifier_receipt_conflict';
 END IF;
 UPDATE control.verification_results SET trusted_receipt=p_receipt WHERE verification_id=p_id AND trusted_receipt IS NULL;
END $$;

CREATE FUNCTION control.preserve_trusted_verifier_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
BEGIN
 IF OLD.trusted_receipt IS NOT NULL AND NEW.trusted_receipt IS DISTINCT FROM OLD.trusted_receipt THEN
  RAISE EXCEPTION 'immutable_verifier_receipt_conflict';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER immutable_trusted_verifier_receipt BEFORE UPDATE ON control.verification_results
FOR EACH ROW EXECUTE FUNCTION control.preserve_trusted_verifier_receipt();

ALTER FUNCTION control.review_verification_failure(bigint,jsonb) RENAME TO review_verification_failure_legacy_v2;
CREATE FUNCTION control.review_verification_failure(p_id bigint,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF c.trusted_receipt IS NULL
 OR (p_evidence->>'check_id')::bigint IS DISTINCT FROM c.verification_id
 OR p_evidence->>'source_fingerprint' IS DISTINCT FROM c.trusted_receipt->>'source_fingerprint'
 OR p_evidence->'artifact' IS DISTINCT FROM c.trusted_receipt->'artifact'
 OR (p_evidence->>'execution_id')::bigint IS DISTINCT FROM (c.trusted_receipt->>'execution_id')::bigint
 OR (p_evidence->>'verification_run_id')::bigint IS DISTINCT FROM (c.trusted_receipt->>'verification_run_id')::bigint
 THEN RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='trusted_verifier_receipt_required'; END IF;
 PERFORM control.review_verification_failure_legacy_v2(p_id,p_evidence);
END $$;
REVOKE ALL ON FUNCTION control.review_verification_failure_legacy_v2(bigint,jsonb) FROM PUBLIC,anon,authenticated,bs_control_app;
REVOKE ALL ON FUNCTION control.capture_verifier_receipt(bigint,jsonb),control.review_verification_failure(bigint,jsonb),control.preserve_trusted_verifier_receipt() FROM PUBLIC,anon,authenticated;
-- Transitional host capability; role separation migration replaces this grant before activation.
GRANT EXECUTE ON FUNCTION control.capture_verifier_receipt(bigint,jsonb),control.review_verification_failure(bigint,jsonb) TO bs_control_app;

CREATE OR REPLACE FUNCTION control.product_retry_accounting(p_task text) RETURNS jsonb LANGUAGE sql STABLE AS $$
 WITH entries AS (
 SELECT e.execution_id,e.attempt,e.status,coalesce(c.classification,'OTHER') AS classification,c.source,c.evidence,c.classification_id,
 coalesce(c.classification='PRODUCT_DEFECT' AND EXISTS(
  SELECT 1 FROM control.verification_results vr JOIN control.verification_failure_reviews r USING(verification_id)
  WHERE vr.execution_id=e.execution_id AND vr.status='fail' AND vr.trusted_receipt IS NOT NULL
  AND r.evidence->>'classification'='PRODUCT_DEFECT' AND (r.evidence->>'check_id')::bigint=vr.verification_id
  AND r.evidence->'artifact'=vr.trusted_receipt->'artifact'
 ),false) AS charged
 FROM control.executions e LEFT JOIN LATERAL (SELECT * FROM control.product_attempt_classifications a WHERE a.execution_id=e.execution_id ORDER BY classification_id DESC LIMIT 1)c ON true WHERE e.task_id=p_task)
 SELECT jsonb_build_object('consumed',count(*) FILTER(WHERE charged),'genuine_product',count(*) FILTER(WHERE charged),
 'all_product',coalesce(bool_and(charged),false),'classifications',coalesce(jsonb_agg(to_jsonb(entries) ORDER BY attempt),'[]'::jsonb)) FROM entries;
$$;

CREATE OR REPLACE FUNCTION control.audit_product_attempts(p_task text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE e record; cls text; proof jsonb;
BEGIN
 FOR e IN SELECT * FROM control.executions WHERE task_id=p_task AND status<>'running' ORDER BY attempt LOOP
  SELECT r.evidence->>'classification',r.evidence INTO cls,proof
  FROM control.verification_results vr JOIN control.verification_failure_reviews r USING(verification_id)
  WHERE vr.execution_id=e.execution_id AND vr.trusted_receipt IS NOT NULL
  AND (r.evidence->>'check_id')::bigint=vr.verification_id AND r.evidence->'artifact'=vr.trusted_receipt->'artifact'
  ORDER BY CASE WHEN r.evidence->>'classification'='PRODUCT_DEFECT' THEN 0 ELSE 1 END,vr.verification_id DESC LIMIT 1;
  cls:=CASE WHEN cls IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE') THEN cls ELSE 'OTHER' END;
  INSERT INTO control.product_attempt_classifications(execution_id,classification,evidence_fingerprint,source,evidence)
  VALUES(e.execution_id,cls,md5(jsonb_build_array('trusted-receipt-v1',control.retry_evidence_fingerprint(e.execution_id),proof)::text),'dot',
   jsonb_build_object('basis','trusted-receipt-v1','review',proof,'legacy_history_preserved',true)) ON CONFLICT DO NOTHING;
 END LOOP;
 RETURN control.product_retry_accounting(p_task);
END $$;
COMMIT;

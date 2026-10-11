BEGIN;
CREATE OR REPLACE FUNCTION control.review_verification_failure(p_id bigint,p_evidence jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE c control.verification_results%ROWTYPE;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_id=p_id FOR UPDATE;
 IF c.status NOT IN('fail','not_run','unavailable') OR c.verification_run_id IS DISTINCT FROM (SELECT max(verification_run_id) FROM control.verification_runs WHERE execution_id=c.execution_id)
 OR p_evidence->>'version' IS DISTINCT FROM '2' OR (p_evidence->>'execution_id')::bigint IS DISTINCT FROM c.execution_id
 OR (p_evidence->>'verification_run_id')::bigint IS DISTINCT FROM c.verification_run_id OR p_evidence->>'check_name' IS DISTINCT FROM c.check_name
 OR p_evidence->>'command' IS DISTINCT FROM c.command OR (p_evidence->>'exit_code')::integer IS DISTINCT FROM c.exit_code
 OR p_evidence->'artifact'->>'path' IS DISTINCT FROM c.log_path OR p_evidence->'artifact'->>'sha256' IS NULL OR p_evidence->'artifact'->>'sha256' !~ '^[a-f0-9]{64}$'
 OR (c.metadata->'failure_evidence'->'artifact'->>'sha256' IS NOT NULL AND c.metadata->'failure_evidence'->'artifact'->>'sha256' IS DISTINCT FROM p_evidence->'artifact'->>'sha256')
 OR jsonb_typeof(p_evidence->'review'->'source') IS DISTINCT FROM 'array'
 OR p_evidence->'review'->>'root_cause' IS NULL OR jsonb_array_length(p_evidence->'review'->'source')=0
 OR coalesce(p_evidence->>'classification','') NOT IN('PRODUCT_DEFECT','VERIFIER_INFRA','CONFIGURATION','TRANSIENT_INFRASTRUCTURE','REPOSITORY_WORKTREE','PUBLICATION_INFRA','UNKNOWN')
 OR (p_evidence->>'classification'='PRODUCT_DEFECT' AND coalesce(p_evidence->>'origin','') NOT IN('product-test','application-sql','application-http','application-behavior'))
 THEN RAISE EXCEPTION 'Bound latest verifier receipt and reviewed root cause required';END IF;
 INSERT INTO control.verification_failure_reviews VALUES(p_id,md5(jsonb_build_array(c.execution_id,c.verification_run_id,c.check_name,c.command,c.exit_code,c.status,c.log_path)::text),p_evidence,now())
 ON CONFLICT(verification_id) DO UPDATE SET evidence=excluded.evidence,check_fingerprint=excluded.check_fingerprint,reviewed_at=now();
END $$;
COMMIT;

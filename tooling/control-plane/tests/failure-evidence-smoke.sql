BEGIN;
DO $$
DECLARE c control.verification_results%ROWTYPE; e jsonb; rejected boolean:=false;
BEGIN
 SELECT * INTO c FROM control.verification_results WHERE verification_run_id=(SELECT max(v.verification_run_id) FROM control.verification_runs v WHERE v.execution_id=verification_results.execution_id) LIMIT 1;
 UPDATE control.verification_results SET status='fail',exit_code=1 WHERE verification_id=c.verification_id RETURNING * INTO c;
 IF c.verification_id IS NULL THEN RAISE EXCEPTION 'Failed execution-bound fixture required';END IF;
 e:=jsonb_build_object('version',2,'execution_id',c.execution_id,'verification_run_id',c.verification_run_id,'check_name',c.check_name,'command',c.command,'exit_code',c.exit_code,'classification','PRODUCT_DEFECT','origin','application-sql','artifact',jsonb_build_object('path',c.log_path,'sha256',repeat('a',64)),'review',jsonb_build_object('root_cause','Product query uses absent registered application column','source',jsonb_build_array(jsonb_build_object('path','apps/fixture/query.sql','sha256',repeat('b',64)))));
 BEGIN PERFORM control.review_verification_failure(c.verification_id,jsonb_set(e,'{execution_id}','-1'));EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Wrong execution accepted';END IF;
 rejected:=false;
 BEGIN PERFORM control.review_verification_failure(c.verification_id,e-'review');EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Forged unreviewed product accepted';END IF;
 rejected:=false;
 BEGIN PERFORM control.review_verification_failure(c.verification_id,e-'version');EXCEPTION WHEN OTHERS THEN rejected:=true;END;
 IF NOT rejected THEN RAISE EXCEPTION 'Unversioned forged receipt accepted';END IF;
 PERFORM control.review_verification_failure(c.verification_id,e);
 IF NOT EXISTS(SELECT 1 FROM control.verification_failure_reviews WHERE verification_id=c.verification_id AND evidence->>'classification'='PRODUCT_DEFECT') THEN RAISE EXCEPTION 'Structured SQL receipt not accepted';END IF;
 UPDATE control.verification_results SET metadata=metadata||jsonb_build_object('failure_evidence',e||jsonb_build_object('execution_id',-1)) WHERE verification_id=c.verification_id;
 IF (SELECT metadata->'failure_evidence'->>'execution_id' FROM control.verification_results WHERE verification_id=c.verification_id)<>c.execution_id::text THEN RAISE EXCEPTION 'Verifier identity not bound server-side';END IF;
END $$;
ROLLBACK;

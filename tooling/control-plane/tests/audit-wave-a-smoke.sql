\set ON_ERROR_STOP on
BEGIN;
DO $$
DECLARE task text:='CP-TRUSTED-RECEIPT-SYNTHETIC'; ex bigint; vr bigint; cid bigint; receipt jsonb; evidence jsonb; rejected boolean; cnt integer;
BEGIN
 INSERT INTO control.tasks(task_id,suit_slug,sequence,title,status,acceptance_criteria,verification_plan)
 VALUES(task,'ledger-suit',-91001,'Disposable trusted evidence fixture','in_progress','["synthetic"]','["synthetic"]');
 INSERT INTO control.executions(task_id,attempt,status,model_profile) VALUES(task,1,'succeeded','standard') RETURNING execution_id INTO ex;
 INSERT INTO control.verification_runs(execution_id,status) VALUES(ex,'failed') RETURNING verification_run_id INTO vr;
 INSERT INTO control.verification_results(execution_id,verification_run_id,check_name,command,status,exit_code,log_path)
 VALUES(ex,vr,'synthetic-check','node --test synthetic.mjs','fail',1,'/synthetic/check.log') RETURNING verification_id INTO cid;
 evidence:=jsonb_build_object('version',2,'source_fingerprint',repeat('e',64),'execution_id',ex,'verification_run_id',vr,'check_id',cid,'check_name','synthetic-check','command','node --test synthetic.mjs','status','fail','exit_code',1,
 'artifact',jsonb_build_object('path','/synthetic/check.log','sha256',repeat('a',64)),
 'classification','PRODUCT_DEFECT','origin','product-test','review',jsonb_build_object('root_cause','Synthetic product violation','source',jsonb_build_array(jsonb_build_object('path','synthetic.mjs','sha256',repeat('c',64)))));
 rejected:=false;
 BEGIN PERFORM control.review_verification_failure(cid,evidence); EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Legacy untrusted evidence accepted';END IF;
 receipt:=jsonb_build_object('version',1,'task_id',task,'execution_id',ex,'verification_run_id',vr,'check_id',cid,'check_name','synthetic-check','command','node --test synthetic.mjs','command_version',repeat('d',64),'status','fail','exit_code',1,
 'artifact',evidence->'artifact','source_fingerprint',repeat('e',64),'started_at','2026-10-07T00:00:00Z','finished_at','2026-10-07T00:00:01Z');
 PERFORM control.capture_verifier_receipt(cid,receipt);
 PERFORM control.capture_verifier_receipt(cid,receipt);
 FOR evidence IN SELECT evidence||jsonb_build_object('check_id',cid+1) UNION ALL SELECT evidence||jsonb_build_object('artifact',jsonb_build_object('path','/synthetic/check.log','sha256',repeat('b',64))) LOOP
  rejected:=false;
  BEGIN PERFORM control.review_verification_failure(cid,evidence); EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
  IF NOT rejected THEN RAISE EXCEPTION 'Substituted check/digest accepted'; END IF;
 END LOOP;
 evidence:=jsonb_build_object('version',2,'source_fingerprint',repeat('e',64),'execution_id',ex,'verification_run_id',vr,'check_id',cid,'check_name','synthetic-check','command','node --test synthetic.mjs','status','fail','exit_code',1,
 'artifact',receipt->'artifact','classification','PRODUCT_DEFECT','origin','product-test','review',jsonb_build_object('root_cause','Synthetic product violation','source',jsonb_build_array(jsonb_build_object('path','synthetic.mjs','sha256',repeat('c',64)))));
 PERFORM control.review_verification_failure(cid,evidence);
 PERFORM control.audit_product_attempts(task);
 IF (control.product_retry_accounting(task)->>'consumed')::integer<>1 THEN RAISE EXCEPTION 'Reviewed product not charged exactly once';END IF;
 SELECT count(*) INTO cnt FROM control.product_attempt_classifications WHERE execution_id=ex;
 PERFORM control.audit_product_attempts(task);
 IF cnt<>(SELECT count(*) FROM control.product_attempt_classifications WHERE execution_id=ex) THEN RAISE EXCEPTION 'Replay duplicated accounting'; END IF;
 rejected:=false;
 BEGIN PERFORM control.capture_verifier_receipt(cid,receipt||jsonb_build_object('source_fingerprint',repeat('f',64))); EXCEPTION WHEN SQLSTATE '22023' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Immutable receipt replaced'; END IF;
END $$;
ROLLBACK;

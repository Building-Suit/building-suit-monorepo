BEGIN;
CREATE OR REPLACE FUNCTION control.bind_verifier_failure_evidence() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,control AS $$
BEGIN
 IF TG_OP='UPDATE' AND (NEW.metadata->'failure_evidence' IS NULL OR NEW.metadata->'failure_evidence'='null'::jsonb) AND OLD.metadata->'failure_evidence' IS NOT NULL THEN
 NEW.metadata:=jsonb_set(NEW.metadata,'{failure_evidence}',OLD.metadata->'failure_evidence');
 END IF;
 IF NEW.metadata->'failure_evidence' IS NOT NULL AND NEW.metadata->'failure_evidence'<>'null'::jsonb THEN
 NEW.metadata:=jsonb_set(NEW.metadata,'{failure_evidence}',(NEW.metadata->'failure_evidence')||jsonb_build_object('execution_id',NEW.execution_id,'verification_run_id',NEW.verification_run_id,'check_id',NEW.verification_id,'check_name',NEW.check_name,'command',NEW.command,'status',NEW.status,'exit_code',NEW.exit_code));
 END IF;
 RETURN NEW;
END $$;
COMMIT;

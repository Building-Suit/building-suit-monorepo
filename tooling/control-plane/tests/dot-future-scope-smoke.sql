\set ON_ERROR_STOP on
BEGIN;
UPDATE control.run_ordinary_publication_authorizations SET revoked_at=NULL WHERE run_id='22222222-2222-4333-8444-555555555555';
UPDATE control.tasks SET metadata=metadata-'scope_drift' WHERE task_id='CP-BOUND-PUBLISH-002';
SELECT control.refresh_publication_readiness_contract('CP-BOUND-PUBLISH-002','dot-future-fixture');
DELETE FROM control.dot_task_scope_authorities WHERE task_id='CP-BOUND-PUBLISH-002';
DELETE FROM control.run_task_publication_authorities WHERE task_id='CP-BOUND-PUBLISH-002';
INSERT INTO control.run_task_publication_authorities
SELECT '22222222-2222-4333-8444-555555555555',task_id,input_generation,contract_fingerprint,control.verification_contract_fingerprint(task_id)
FROM control.publication_readiness_contracts WHERE task_id='CP-BOUND-PUBLISH-002';
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM control.dot_task_scope_authorities WHERE task_id='CP-BOUND-PUBLISH-002'
 AND scope_fingerprint=control.dot_scope_fingerprint(task_id)) THEN RAISE EXCEPTION 'new authorized run scope not captured'; END IF;
 IF has_table_privilege('bs_control_app','control.dot_task_scope_authorities','INSERT,UPDATE,DELETE') THEN RAISE EXCEPTION 'worker can expand frozen scope'; END IF;
END $$;
UPDATE control.tasks SET acceptance_criteria='["expanded acceptance"]' WHERE task_id='CP-BOUND-PUBLISH-002';
DO $$ BEGIN
 BEGIN
  PERFORM control.refresh_dot_admission('22222222-2222-4333-8444-555555555555');
  RAISE EXCEPTION 'expanded acceptance accepted';
 EXCEPTION WHEN raise_exception THEN
  IF SQLERRM='expanded acceptance accepted' THEN RAISE; END IF;
  IF SQLERRM NOT LIKE 'Task scope changed:%' THEN RAISE; END IF;
 END;
END $$;
ROLLBACK;
SELECT 'DOT_FUTURE_SCOPE_CAPTURE_PASS';

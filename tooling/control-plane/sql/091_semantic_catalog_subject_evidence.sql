BEGIN;
-- Infrastructure incidents before verification have no verifier subject.
-- Require registered v2 evidence when the semantic cause binds checks.
CREATE OR REPLACE FUNCTION control.register_semantic_recovery_handler(p_entry jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE release control.runtime_release_ledger%ROWTYPE;j control.dot_recovery_jobs%ROWTYPE;test_hash text; evidence_requirements jsonb;
BEGIN
 SELECT * INTO release FROM control.runtime_release_ledger WHERE release_id=p_entry->>'runtime_release';
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=(p_entry->>'learned_from')::uuid;
 test_hash:=release.manifest->'files'->>(p_entry->>'regression_test');
 IF NOT FOUND OR jsonb_typeof(j.evidence->'semantic') IS DISTINCT FROM 'object' OR release.release_id IS NULL OR j.root_family IS DISTINCT FROM p_entry->>'root_family' OR j.evidence->>'cause_fingerprint' IS DISTINCT FROM p_entry->>'cause_fingerprint' OR test_hash IS DISTINCT FROM p_entry->>'regression_version' OR release.manifest#>>'{metadata,regression,failed}' IS DISTINCT FROM '0' OR release.manifest#>>'{metadata,regression,skipped}' IS DISTINCT FROM '0' OR release.manifest#>>'{metadata,focused_regression,failed}' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'independent_semantic_recovery_regression_proof_required';END IF;
 evidence_requirements:='["semantic_health","executed_regression"]'::jsonb;
 IF jsonb_array_length(coalesce(j.evidence#>'{semantic,checks}','[]'))>0 THEN evidence_requirements:=evidence_requirements||'["trusted_verifier_receipt"]'::jsonb;END IF;
 INSERT INTO control.dot_semantic_recovery_catalog(root_family,cause_fingerprint,handler_id,handler_version,protocol,schema_min,schema_max,required_preconditions,required_evidence,regression_test,regression_version,runtime_release,safety_boundary,learned_from)
 VALUES(p_entry->>'root_family',p_entry->>'cause_fingerprint','run-recover',1,p_entry->>'protocol',(release.manifest->>'schema_version')::integer,(release.manifest->>'schema_version')::integer,'["same_subject","bounded_authority"]',evidence_requirements,p_entry->>'regression_test',test_hash,release.release_id,'existing-bounded-run',j.incident_id) ON CONFLICT DO NOTHING;
END $$;
ALTER FUNCTION control.register_semantic_recovery_handler(jsonb) OWNER TO bs_control_migration_owner;
REVOKE ALL ON FUNCTION control.register_semantic_recovery_handler(jsonb) FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_observer,bs_control_verifier,bs_control_operator;
GRANT EXECUTE ON FUNCTION control.register_semantic_recovery_handler(jsonb) TO bs_control_release_installer;
COMMIT;

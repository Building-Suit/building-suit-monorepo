BEGIN;
DO $$BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='bs_control_release_installer') THEN CREATE ROLE bs_control_release_installer NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;END IF;END $$;
GRANT USAGE ON SCHEMA control TO bs_control_release_installer;
ALTER TABLE control.dot_semantic_recovery_catalog DROP CONSTRAINT dot_semantic_recovery_catalog_runtime_release_check;
ALTER TABLE control.dot_semantic_recovery_catalog ADD CONSTRAINT dot_semantic_recovery_catalog_runtime_release_check CHECK(runtime_release ~ '^([a-f0-9]{40}|[a-f0-9]{64})$');
CREATE TABLE control.control_schema_adoption_baselines(
 baseline_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_ref text NOT NULL CHECK(project_ref ~ '^[a-z]{20}$'),
 source_sha text NOT NULL CHECK(source_sha ~ '^[a-f0-9]{40}$'),canonical_migrations jsonb NOT NULL,
 canonical_schema_fingerprint text NOT NULL CHECK(canonical_schema_fingerprint ~ '^[a-f0-9]{64}$'),
 live_schema_fingerprint text NOT NULL CHECK(live_schema_fingerprint=canonical_schema_fingerprint),
 active_release_id text NOT NULL CHECK(active_release_id ~ '^[a-f0-9]{64}$'),
 adopted_at timestamptz NOT NULL DEFAULT now(),pre_ledger_application_order_asserted boolean NOT NULL DEFAULT false CHECK(NOT pre_ledger_application_order_asserted),
 note text NOT NULL CHECK(note='Schema adoption snapshot; pre-ledger historical application order is not asserted.'),UNIQUE(project_ref)
);
CREATE TABLE control.runtime_activation_events(
 activation_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,release_id text NOT NULL REFERENCES control.runtime_release_ledger,
 previous_release text,outcome text NOT NULL CHECK(outcome IN('activated','rolled_back')),
 observed_pointer text NOT NULL,readiness_proof jsonb NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE control.control_schema_adoption_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.runtime_activation_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.control_schema_adoption_baselines,control.runtime_activation_events FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_verifier,bs_control_operator,bs_control_release_installer;
GRANT SELECT ON control.control_schema_adoption_baselines,control.runtime_activation_events TO bs_control_executor,bs_control_observer;
CREATE POLICY adoption_read ON control.control_schema_adoption_baselines FOR SELECT TO bs_control_executor,bs_control_observer USING(true);
CREATE POLICY activation_read ON control.runtime_activation_events FOR SELECT TO bs_control_executor,bs_control_observer USING(true);
ALTER TABLE control.control_schema_adoption_baselines OWNER TO bs_control_migration_owner;
ALTER TABLE control.runtime_activation_events OWNER TO bs_control_migration_owner;
CREATE FUNCTION control.register_verified_runtime_release(p_manifest jsonb,p_schema text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE previous jsonb;
BEGIN
 IF coalesce(p_manifest->>'release_id','') !~ '^[a-f0-9]{64}$' OR coalesce(p_manifest->>'commit','') !~ '^[a-f0-9]{40}$' OR coalesce(p_schema,'') !~ '^[a-f0-9]{64}$' OR jsonb_typeof(p_manifest->'files') IS DISTINCT FROM 'object' OR jsonb_typeof(p_manifest->'acceptance') IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_each(p_manifest->'acceptance') check_item WHERE check_item.value<>'true'::jsonb) THEN RAISE EXCEPTION 'independently_verified_release_manifest_required';END IF;
 SELECT manifest INTO previous FROM control.runtime_release_ledger WHERE release_id=p_manifest->>'release_id';
 IF previous IS NOT NULL AND previous IS DISTINCT FROM p_manifest THEN RAISE EXCEPTION 'immutable_runtime_manifest_conflict';END IF;
 INSERT INTO control.runtime_release_ledger(release_id,source_commit,manifest,schema_fingerprint,state) VALUES(p_manifest->>'release_id',p_manifest->>'commit',p_manifest,p_schema,'prepared') ON CONFLICT DO NOTHING;
END $$;
CREATE FUNCTION control.record_runtime_activation(p_release text,p_previous text,p_outcome text,p_pointer text,p_proof jsonb) RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE id bigint;
BEGIN
 IF p_outcome NOT IN('activated','rolled_back') OR p_proof->>'readiness_passed' IS DISTINCT FROM 'true' OR NOT EXISTS(SELECT 1 FROM control.runtime_release_ledger WHERE release_id=p_release) THEN RAISE EXCEPTION 'registered_release_pointer_readiness_required';END IF;
 INSERT INTO control.runtime_activation_events(release_id,previous_release,outcome,observed_pointer,readiness_proof) VALUES(p_release,p_previous,p_outcome,p_pointer,p_proof) RETURNING activation_id INTO id;
 RETURN id;
END $$;
CREATE FUNCTION control.register_semantic_recovery_handler(p_entry jsonb) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,control AS $$
DECLARE release control.runtime_release_ledger%ROWTYPE;j control.dot_recovery_jobs%ROWTYPE;test_hash text;
BEGIN
 SELECT * INTO release FROM control.runtime_release_ledger WHERE release_id=p_entry->>'runtime_release';
 SELECT * INTO j FROM control.dot_recovery_jobs WHERE incident_id=(p_entry->>'learned_from')::uuid;
 test_hash:=release.manifest->'files'->>(p_entry->>'regression_test');
 IF NOT FOUND OR release.release_id IS NULL OR j.root_family IS DISTINCT FROM p_entry->>'root_family' OR j.evidence->>'cause_fingerprint' IS DISTINCT FROM p_entry->>'cause_fingerprint' OR test_hash IS DISTINCT FROM p_entry->>'regression_version' OR release.manifest#>>'{metadata,regression,failed}' IS DISTINCT FROM '0' OR release.manifest#>>'{metadata,regression,skipped}' IS DISTINCT FROM '0' OR release.manifest#>>'{metadata,focused_regression,failed}' IS DISTINCT FROM '0' THEN RAISE EXCEPTION 'independent_semantic_recovery_regression_proof_required';END IF;
 INSERT INTO control.dot_semantic_recovery_catalog(root_family,cause_fingerprint,handler_id,handler_version,protocol,schema_min,schema_max,required_preconditions,required_evidence,regression_test,regression_version,runtime_release,safety_boundary,learned_from)
 VALUES(p_entry->>'root_family',p_entry->>'cause_fingerprint','run-recover',1,p_entry->>'protocol',(release.manifest->>'schema_version')::integer,(release.manifest->>'schema_version')::integer,'["same_subject","bounded_authority"]','["semantic_health","trusted_verifier_receipt","executed_regression"]',p_entry->>'regression_test',test_hash,release.release_id,'existing-bounded-run',j.incident_id) ON CONFLICT DO NOTHING;
END $$;
DO $$DECLARE fn regprocedure;BEGIN
 FOR fn IN SELECT oid::regprocedure FROM pg_proc WHERE pronamespace='control'::regnamespace AND proname IN('register_verified_runtime_release','record_runtime_activation','register_semantic_recovery_handler') LOOP
 EXECUTE format('ALTER FUNCTION %s OWNER TO bs_control_migration_owner',fn);
 EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated,bs_control_app,bs_control_executor,bs_control_verifier,bs_control_operator',fn);
 EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO bs_control_release_installer',fn);
 END LOOP;
END $$;
COMMIT;

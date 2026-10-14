BEGIN;
CREATE TABLE control.dot_semantic_recovery_catalog(
 root_family text NOT NULL,cause_fingerprint text NOT NULL CHECK(cause_fingerprint ~ '^[a-f0-9]{64}$'),
 handler_id text NOT NULL CHECK(handler_id='run-recover'),handler_version integer NOT NULL CHECK(handler_version=1),
 protocol text NOT NULL,schema_min integer NOT NULL,schema_max integer NOT NULL CHECK(schema_max>=schema_min),
 required_preconditions jsonb NOT NULL CHECK(jsonb_typeof(required_preconditions)='array' AND jsonb_array_length(required_preconditions)>0),
 required_evidence jsonb NOT NULL CHECK(jsonb_typeof(required_evidence)='array' AND jsonb_array_length(required_evidence)>0),
 regression_test text NOT NULL,regression_version text NOT NULL CHECK(regression_version ~ '^[a-f0-9]{64}$'),
 runtime_release text NOT NULL CHECK(runtime_release ~ '^[a-f0-9]{40}$'),
 safety_boundary text NOT NULL CHECK(safety_boundary='existing-bounded-run'),
 learned_from uuid NOT NULL REFERENCES control.dot_incidents,created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(root_family,cause_fingerprint,runtime_release)
);
ALTER TABLE control.dot_semantic_recovery_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY semantic_catalog_read ON control.dot_semantic_recovery_catalog FOR SELECT TO bs_control_app USING(true);
REVOKE ALL ON control.dot_semantic_recovery_catalog FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.dot_semantic_recovery_catalog TO bs_control_app;
-- Entries are written only by the trusted release installer after independent regression validation.
-- Legacy family-only catalog rows remain historical evidence and are not imported as learned proofs.
COMMIT;

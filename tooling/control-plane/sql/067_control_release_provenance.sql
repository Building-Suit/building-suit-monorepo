BEGIN;
CREATE TABLE control.migration_release_ledger(
 migration_name text PRIMARY KEY CHECK(migration_name ~ '^[0-9]{3}_[a-z0-9_]+[.]sql$'),
 source_sha256 text NOT NULL CHECK(source_sha256 ~ '^[a-f0-9]{64}$'),
 source_commit text NOT NULL CHECK(source_commit ~ '^[a-f0-9]{40}$'),
 project_ref text NOT NULL CHECK(project_ref ~ '^[a-z]{20}$'),
 applied_at timestamptz NOT NULL DEFAULT now(),
 evidence_kind text NOT NULL CHECK(evidence_kind IN('applied_transaction','baseline_snapshot')),
 evidence jsonb NOT NULL
);
CREATE TABLE control.runtime_release_ledger(
 release_id text PRIMARY KEY CHECK(release_id ~ '^[a-f0-9]{64}$'),
 source_commit text NOT NULL CHECK(source_commit ~ '^[a-f0-9]{40}$'),
 manifest jsonb NOT NULL,schema_fingerprint text NOT NULL,
 activated_at timestamptz NOT NULL DEFAULT now(),previous_release text,
 state text NOT NULL CHECK(state IN('prepared','activated','rolled_back'))
);
ALTER TABLE control.migration_release_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE control.runtime_release_ledger ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON control.migration_release_ledger,control.runtime_release_ledger FROM PUBLIC,anon,authenticated,bs_control_app;
GRANT SELECT ON control.migration_release_ledger,control.runtime_release_ledger TO bs_control_app;
CREATE POLICY migration_ledger_read ON control.migration_release_ledger FOR SELECT TO bs_control_app USING(true);
CREATE POLICY runtime_ledger_read ON control.runtime_release_ledger FOR SELECT TO bs_control_app USING(true);
-- Historical migrations must be attested against a preserved baseline snapshot;
-- creating this ledger never asserts that source files were applied verbatim.
COMMIT;

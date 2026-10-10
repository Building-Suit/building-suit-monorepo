BEGIN;

/*
 * Migration 024 used NOT around nullable jsonb_typeof expressions. PostgreSQL
 * therefore classified missing keys as UNKNOWN instead of true, leaving empty
 * and partial active workstream policies unrepaired. IS NOT TRUE deliberately
 * includes both false and UNKNOWN while leaving every complete policy untouched.
 */
WITH candidates AS MATERIALIZED (
  SELECT project_id, slug, publication_config AS old_config
  FROM control.workstreams
  WHERE active = true
    AND (
      jsonb_typeof(publication_config) = 'object'
      AND jsonb_typeof(publication_config->'merge_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'deployment_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'hosted_database_changes_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'review_required_before_integration') = 'boolean'
    ) IS NOT TRUE
  FOR UPDATE
), repaired AS (
  UPDATE control.workstreams AS workstream
  SET publication_config = jsonb_build_object(
    'merge_authorized', false,
    'deployment_authorized', false,
    'hosted_database_changes_authorized', false,
    'review_required_before_integration', true
  )
  FROM candidates
  WHERE workstream.project_id = candidates.project_id
    AND workstream.slug = candidates.slug
  RETURNING workstream.project_id, workstream.slug, candidates.old_config,
    workstream.publication_config
)
INSERT INTO control.audit_events(
  project_id, workstream_slug, action, source, old_value, new_value, metadata
)
SELECT project_id, slug, 'workstream_publication_policy_backfilled', 'migration',
  old_config, publication_config,
  '{"migration":"025_workstream_publication_policy_repair","repairs_migration":"024_workstream_readiness","conservative":true}'::jsonb
FROM repaired;

/*
 * This repair changes configuration only. In particular, SS-SA-BRIDGE-001 can
 * become configuration-eligible without creating or consuming an execution.
 */

COMMIT;

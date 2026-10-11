BEGIN;

/*
 * Active workstreams created before publication policy became mandatory are
 * repaired conservatively. A complete existing policy is deliberately left
 * byte-for-byte unchanged; partial or malformed policy cannot carry forward
 * implied authorization.
 */
WITH candidates AS (
  SELECT project_id, slug, publication_config AS old_config
  FROM control.workstreams
  WHERE active = true
    AND NOT (
      jsonb_typeof(publication_config) = 'object'
      AND jsonb_typeof(publication_config->'merge_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'deployment_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'hosted_database_changes_authorized') = 'boolean'
      AND jsonb_typeof(publication_config->'review_required_before_integration') = 'boolean'
    )
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
  '{"migration":"024_workstream_readiness","conservative":true}'::jsonb
FROM repaired;

/* control.workstreams is authoritative; control.suits is compatibility state. */
UPDATE control.suits AS suit
SET status = CASE WHEN workstream.active THEN 'active' ELSE 'paused' END
FROM control.workstreams AS workstream
WHERE workstream.suit_slug = suit.slug
  AND suit.status IS DISTINCT FROM
    CASE WHEN workstream.active THEN 'active' ELSE 'paused' END;

/*
 * Configuration waits are intentionally not converted into executions or
 * retries. Once configuration changes, the supervisor fingerprint changes:
 * SS-SA-BRIDGE-001 may resume its preflight, and a succeeded implementation
 * such as SAS-M1-BOOT-001 execution 245 is reverified on that same execution.
 */

COMMIT;

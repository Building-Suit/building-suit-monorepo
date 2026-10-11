\set ON_ERROR_STOP on

/* Run only against a disposable control database after migrations 001-024. */
INSERT INTO control.projects (
  slug, display_name, repository_path, github_repository,
  local_repository_root, worktree_root, active
)
VALUES (
  'publication-repair-fixture', 'Publication repair fixture',
  'fixture/repository', 'fixture/repository', '.', '.local/worktrees', false
);

INSERT INTO control.workstreams (
  project_id, slug, display_name, stack_key, publication_config, active
)
SELECT project_id, fixture.slug, fixture.display_name, fixture.stack_key,
  fixture.publication_config, fixture.active
FROM control.projects
CROSS JOIN (VALUES
  ('empty', 'Empty', 'fixture-empty', '{}'::jsonb, true),
  ('partial', 'Partial', 'fixture-partial', '{"merge_authorized":true}'::jsonb, true),
  ('explicit-null', 'Explicit null', 'fixture-explicit-null',
    '{"merge_authorized":null,"deployment_authorized":false,"hosted_database_changes_authorized":false,"review_required_before_integration":true}'::jsonb, true),
  ('wrong-type', 'Wrong type', 'fixture-wrong-type',
    '{"merge_authorized":"false","deployment_authorized":false,"hosted_database_changes_authorized":false,"review_required_before_integration":true}'::jsonb, true),
  ('array', 'Array', 'fixture-array', '[]'::jsonb, true),
  ('scalar-null', 'Scalar null', 'fixture-scalar-null', 'null'::jsonb, true),
  ('complete', 'Complete', 'fixture-complete',
    '{"merge_authorized":true,"deployment_authorized":true,"hosted_database_changes_authorized":true,"review_required_before_integration":false,"retained_extension":{"exact":true}}'::jsonb, true),
  ('inactive-empty', 'Inactive empty', 'fixture-inactive-empty', '{}'::jsonb, false)
) AS fixture(slug, display_name, stack_key, publication_config, active)
WHERE control.projects.slug = 'publication-repair-fixture';

\ir ../sql/025_workstream_publication_policy_repair.sql

DO $do$
DECLARE
  fixture_project_id uuid;
  conservative_policy constant jsonb :=
    '{"merge_authorized":false,"deployment_authorized":false,"hosted_database_changes_authorized":false,"review_required_before_integration":true}'::jsonb;
  complete_policy constant jsonb :=
    '{"merge_authorized":true,"deployment_authorized":true,"hosted_database_changes_authorized":true,"review_required_before_integration":false,"retained_extension":{"exact":true}}'::jsonb;
BEGIN
  SELECT project_id INTO fixture_project_id
  FROM control.projects
  WHERE slug = 'publication-repair-fixture';

  IF EXISTS (
    SELECT 1
    FROM control.workstreams
    WHERE project_id = fixture_project_id
      AND slug IN ('empty', 'partial', 'explicit-null', 'wrong-type', 'array', 'scalar-null')
      AND publication_config IS DISTINCT FROM conservative_policy
  ) THEN
    RAISE EXCEPTION 'an incomplete active publication policy was not repaired';
  END IF;

  IF (SELECT publication_config FROM control.workstreams
      WHERE project_id = fixture_project_id AND slug = 'complete')
      IS DISTINCT FROM complete_policy THEN
    RAISE EXCEPTION 'the complete publication policy was rewritten';
  END IF;

  IF (SELECT publication_config FROM control.workstreams
      WHERE project_id = fixture_project_id AND slug = 'inactive-empty')
      IS DISTINCT FROM '{}'::jsonb THEN
    RAISE EXCEPTION 'an inactive workstream was repaired';
  END IF;

  IF (SELECT count(*) FROM control.audit_events
      WHERE project_id = fixture_project_id
        AND action = 'workstream_publication_policy_backfilled'
        AND metadata->>'migration' = '025_workstream_publication_policy_repair') <> 6 THEN
    RAISE EXCEPTION 'expected one migration 025 audit event per repaired workstream';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM control.audit_events
    WHERE project_id = fixture_project_id
      AND action = 'workstream_publication_policy_backfilled'
      AND metadata->>'migration' = '025_workstream_publication_policy_repair'
      AND (old_value IS NULL OR new_value IS DISTINCT FROM conservative_policy)
  ) THEN
    RAISE EXCEPTION 'repair audit evidence does not contain the old and new policies';
  END IF;
END
$do$;

/* A replay must neither rewrite rows nor emit additional audit events. */
\ir ../sql/025_workstream_publication_policy_repair.sql

DO $do$
DECLARE fixture_project_id uuid;
BEGIN
  SELECT project_id INTO fixture_project_id
  FROM control.projects
  WHERE slug = 'publication-repair-fixture';

  IF (SELECT count(*) FROM control.audit_events
      WHERE project_id = fixture_project_id
        AND action = 'workstream_publication_policy_backfilled'
        AND metadata->>'migration' = '025_workstream_publication_policy_repair') <> 6 THEN
    RAISE EXCEPTION 'migration 025 replay was not idempotent';
  END IF;
END
$do$;

DELETE FROM control.audit_events
WHERE project_id = (
  SELECT project_id FROM control.projects WHERE slug = 'publication-repair-fixture'
);
DELETE FROM control.projects WHERE slug = 'publication-repair-fixture';

SELECT 'WORKSTREAM_PUBLICATION_POLICY_REPAIR_SMOKE_PASS' AS result;

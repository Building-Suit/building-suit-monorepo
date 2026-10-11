\set ON_ERROR_STOP on

BEGIN;

INSERT INTO control.tasks(
  task_id,suit_slug,project_id,workstream_slug,title,description,status,
  acceptance_criteria,verification_plan,metadata
)
SELECT
  'CONTROL-PUBLICATION-READINESS-001',workstream.suit_slug,project.project_id,
  workstream.slug,'Publication readiness smoke','Exercise exact pre-execution authority.',
  'in_progress','["Readiness is authoritative."]','["smoke"]',
  '{
    "allowed_paths":["apps/shop-suit/","package.json"],
    "source_allowed_paths":["package.json"],
    "publication_exact_paths":["apps/shop-suit/.env.example","package.json"],
    "publication_requirement_evidence":{"source":"smoke-approved-contract","worker_output_used":false}
  }'::jsonb
FROM control.projects project
JOIN control.workstreams workstream USING(project_id)
WHERE project.slug='building-suit' AND workstream.slug='shop-suit';

DO $do$
DECLARE contract jsonb;
DECLARE ordinary jsonb;
DECLARE protected_result jsonb;
DECLARE packet jsonb;
BEGIN
  contract:=control.refresh_publication_readiness_contract(
    'CONTROL-PUBLICATION-READINESS-001','smoke'
  );
  IF contract->'required_paths' <> '["apps/shop-suit/.env.example","apps/shop-suit/","package.json"]'::jsonb THEN
    RAISE EXCEPTION 'Unexpected required paths: %',contract->'required_paths';
  END IF;

  ordinary:=control.authorize_preexecution_publication_paths(
    'CONTROL-PUBLICATION-READINESS-001','["package.json"]','ordinary-smoke-key',
    'human-approved structural registration','human'
  );
  protected_result:=control.authorize_protected_publication_paths(
    'CONTROL-PUBLICATION-READINESS-001','["apps/shop-suit/.env.example"]',
    'protected-smoke-key','human-approved secret-safe template',
    '{"apps/shop-suit/.env.example":{"status":"passed","checks":["no-secrets-review"]}}',
    'human'
  );
  packet:=control.generic_task_packet('CONTROL-PUBLICATION-READINESS-001');

  IF ordinary->>'authorization_kind'<>'ordinary' OR protected_result->>'authorization_kind'<>'protected' THEN
    RAISE EXCEPTION 'Authorization kinds were not preserved';
  END IF;
  IF jsonb_array_length(packet#>'{publication_authorizations,ordinary}')<>1
    OR jsonb_array_length(packet#>'{publication_authorizations,protected}')<>1 THEN
    RAISE EXCEPTION 'Task packet did not expose exact authorizations';
  END IF;
  IF EXISTS (SELECT 1 FROM control.executions WHERE task_id='CONTROL-PUBLICATION-READINESS-001') THEN
    RAISE EXCEPTION 'Publication readiness consumed an implementation execution';
  END IF;
END
$do$;

ROLLBACK;

SELECT 'PUBLICATION_READINESS_SMOKE_PASS' AS result;

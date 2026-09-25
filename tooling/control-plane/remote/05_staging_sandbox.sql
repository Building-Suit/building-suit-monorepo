\set ON_ERROR_STOP on

BEGIN;

INSERT INTO control.suits (
  slug,
  display_name,
  stack_key,
  app_path,
  status,
  metadata
)
VALUES (
  'control-sandbox',
  'Control Sandbox',
  'control-sandbox',
  NULL,
  'active',
  '{"synthetic":true,"staging_only":true}'::jsonb
)
ON CONFLICT (slug)
DO NOTHING;

INSERT INTO control.tasks (
  task_id,
  suit_slug,
  sequence,
  priority,
  title,
  description,
  task_type,
  risk_level,
  model_profile,
  status,
  acceptance_criteria,
  verification_plan,
  metadata
)
VALUES (
  'CONTROL-STG-SANDBOX-001',
  'control-sandbox',
  1,
  1,
  'Staging database dispatch smoke',
  'Synthetic database-only task. Do not run Codex for this task.',
  'maintenance',
  'low',
  'no_ai',
  'planned',
  '[]'::jsonb,
  '[]'::jsonb,
  '{"synthetic":true,"staging_only":true}'::jsonb
)
ON CONFLICT (task_id)
DO NOTHING;

COMMIT;

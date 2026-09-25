BEGIN;

UPDATE control.tasks
SET metadata =
  jsonb_set(
    metadata,
    '{allowed_paths}',
    '["apps/ledger-suit/"]'::jsonb,
    true
  )
WHERE suit_slug = 'ledger-suit'
  AND task_id IN (
    'V2-IMP-009',
    'V2-IMP-010',
    'V2-IMP-011',
    'V2-IMP-012',
    'V2-IMP-013',
    'V2-IMP-014',
    'V2-IMP-015'
  );

COMMIT;

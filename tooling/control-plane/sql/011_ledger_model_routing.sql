BEGIN;

UPDATE control.tasks
SET model_profile = 'standard'
WHERE suit_slug = 'ledger-suit'
  AND task_id IN (
    'V2-IMP-009',
    'V2-IMP-010',
    'V2-IMP-011',
    'V2-IMP-012'
  );

UPDATE control.tasks
SET model_profile = 'deep'
WHERE suit_slug = 'ledger-suit'
  AND task_id IN (
    'V2-IMP-013',
    'V2-IMP-014'
  );

UPDATE control.tasks
SET model_profile = 'review'
WHERE suit_slug = 'ledger-suit'
  AND task_id = 'V2-IMP-015';

COMMIT;
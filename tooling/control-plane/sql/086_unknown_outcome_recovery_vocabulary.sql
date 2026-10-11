BEGIN;
-- Unknown evidence is investigated without asserting a product defect or
-- granting another product execution. Preserve every historical classification.
INSERT INTO control.failure_classes(failure_class,description,default_action,default_recoverable)
VALUES('unknown-outcome','The exact operation outcome requires bounded evidence reconciliation; no product retry authority is implied.','wait-external',true)
ON CONFLICT(failure_class) DO NOTHING;
COMMIT;

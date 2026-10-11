BEGIN;
-- Future attempt routing only. Never update recorded execution/model history
-- or any product attempt limit.
UPDATE control.retry_policies SET attempt_profiles='["standard","deep","deep","review","review"]'::jsonb
 WHERE policy_id IN('standard-five','critical-five') AND max_attempts=5;
UPDATE control.retry_policies SET attempt_profiles='["fast","standard","deep"]'::jsonb
 WHERE policy_id='cheap-three' AND max_attempts=3;
UPDATE control.retry_policies SET attempt_profiles='["deep","review","review"]'::jsonb
 WHERE policy_id='deep-only' AND max_attempts=3;
COMMIT;

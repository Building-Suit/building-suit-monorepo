BEGIN;
ALTER TABLE control.dot_health_observations DROP CONSTRAINT dot_health_observations_state_check;
ALTER TABLE control.dot_health_observations ADD CONSTRAINT dot_health_observations_state_check
 CHECK(state IN('RUNNING','VERIFYING','REPAIRING','PUBLISHING','WAITING_TIMER','WAITING_OPERATOR','WAITING_DEPENDENCY','WAITING_ADMISSION','RECONCILING','STUCK','FAILED','COMPLETE'));
COMMIT;

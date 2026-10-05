// Two statements after BEGIN matter: contenders take a fresh READ COMMITTED
// snapshot after waiting for the advisory lock, before inspecting lease state.
export function initialSupervisorLeaseSql(recordExpression) {
  return `
    BEGIN;
    SELECT pg_advisory_xact_lock(hashtextextended('control-recovery:' || :'resume_identity', 0));
    WITH held AS (
      SELECT to_jsonb(r) AS recovery FROM control.recovery_states r
      WHERE r.resume_identity = :'resume_identity' AND r.status = 'active'
        AND r.heartbeat_at IS NOT NULL AND r.lease_token IS NOT NULL
        AND r.lease_expires_at > now() AND r.heartbeat_at <= now()
        AND r.heartbeat_at < r.lease_expires_at
        AND r.lease_token IS DISTINCT FROM :'lease_token'
    )
    SELECT CASE WHEN EXISTS(SELECT 1 FROM held)
      THEN jsonb_build_object('acquired', false, 'recovery', (SELECT recovery FROM held))
      ELSE jsonb_build_object('acquired', true, 'recorded', ${recordExpression}) END;
    COMMIT;
  `
}

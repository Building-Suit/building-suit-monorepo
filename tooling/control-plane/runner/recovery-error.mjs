import { classifyControlDatabaseFailure, isControlDatabaseConnectivityError } from '../lib/control-database.mjs'
import { redactText } from '../lib/redaction.mjs'

export function recoveryErrorEnvelope(error, component) {
  const code = error?.code ?? error?.error_code ?? 'RECOVERY_UNCLASSIFIED_ERROR'
  const sqlstate = error?.sqlstate ?? (/^[0-9A-Z]{5}$/.test(code) ? code : null)
  const message = redactText(error?.message ?? String(error)).slice(0, 2000)
  const transient = isControlDatabaseConnectivityError(error) || classifyControlDatabaseFailure({ code, error: message }).transient
  return {
    ok: false, component, error: message, error_code: code, sqlstate,
    reason: transient ? 'control_database_connectivity_unavailable' : 'recovery_non_transient_failure',
    retry_after_ms: transient ? 30_000 : null,
    classification: { failure_class: transient ? 'transient-infrastructure' : 'unknown-outcome',
      recovery_action: transient ? 'wait-external' : 'reconcile', recoverable: transient },
  }
}

export async function isolateRecoveryCandidates(candidates, work, onError) {
  for (const candidate of candidates) {
    try { await work(candidate) }
    catch (error) { onError(candidate, recoveryErrorEnvelope(error, 'watchdog-candidate')) }
  }
}

export function controlQueryError(result) {
  const error = new Error(redactText(result.stderr || result.error || 'Control database query failed.'))
  error.component = 'control-database'
  error.sqlstate = String(result.stderr ?? '').match(/(?:ERROR|FATAL):\s+([0-9A-Z]{5}):/)?.[1] ?? null
  error.code = error.sqlstate ?? result.error?.code ?? 'CONTROL_DATABASE_QUERY_FAILED'
  return error
}

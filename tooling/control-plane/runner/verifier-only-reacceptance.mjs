import { publicationStateFingerprint } from './publication-preflight.mjs'

// Operator-only recovery of a failed implementation execution whose verifier
// was defective. It never changes that execution or reserves another attempt.
export function validateVerifierOnlyReacceptance({ execution, probe, currentState, verifierPaths = [], requiredChecks = [] }) {
  if (execution?.status !== 'failed') throw new Error('failed_execution_required')
  const original = execution.metadata?.verification_probe_verified_state
  if (!original?.files?.length || original.base_sha !== currentState?.base_sha) throw new Error('original_source_lineage_required')
  if (!probe?.ok || probe.passed !== true || !probe.checks?.length) throw new Error('complete_passing_probe_required')
  if (probe.checks.some(check => check.required !== false && check.status !== 'pass')) throw new Error('mandatory_check_not_passed')
  if (probe.checks.some(check => !['pass','skipped'].includes(check.status))) throw new Error('blocking_check_present')
  if (!requiredChecks.length || requiredChecks.some(name => !probe.checks.some(check => check.name === name && check.status === 'pass' && check.required !== false))) throw new Error('complete_required_check_set_missing')
  const requiredNames = execution.metadata?.verification_probe_failures?.map(check => check.name) ?? []
  if (!requiredNames.length || requiredNames.some(name => !probe.checks.some(check => check.name === name && check.status === 'pass' && check.required !== false))) throw new Error('original_failed_checks_not_reverified')
  if (publicationStateFingerprint(currentState) !== probe.verified_state?.fingerprint) throw new Error('probe_source_changed')
  const allowed = new Set(verifierPaths)
  if ([...allowed].some(file => !/\/tests\//.test(file) || /(^|\/)supabase\/migrations\//.test(file))) throw new Error('verifier_paths_only')
  const oldFiles = new Map(original.files.map(file => [file.file, file.object]))
  const newFiles = new Map(currentState.files.map(file => [file.file, file.object]))
  for (const file of new Set([...oldFiles.keys(), ...newFiles.keys()])) {
    if (oldFiles.get(file) !== newFiles.get(file) && !allowed.has(file)) throw new Error(`product_source_changed:${file}`)
  }
  return { preserved_execution_id: execution.execution_id, preserved_attempt: execution.attempt, verified_fingerprint: probe.verified_state.fingerprint }
}

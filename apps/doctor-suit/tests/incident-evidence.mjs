// Test-only C03 evidence. No runtime sink, recipient, severity or incident authority.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

export const incidentChecks = Object.freeze([
  'known.timeout_unknown', 'known.alert_captured', 'known.no_resend',
  'known.reconcile_sent', 'known.not_delivered',
  'missing.timeout_unknown', 'missing.alert_captured', 'missing.no_resend',
  'missing.reconcile_stays_unknown',
  'denied.rejected', 'denied.alert_captured', 'denied.owner_unchanged',
  'capture.bounded_redacted',
])
const signals = Object.freeze(['outbox.unknown_observed', 'outbox.sent_observed', 'outbox.access_rejected'])
export const incidentInputs = Object.freeze([
  'apps/doctor-suit/tests/incident-actual-provider.mjs',
  'apps/doctor-suit/tests/incident-evidence.mjs',
  'apps/doctor-suit/tests/disposable-provider.mjs',
  'apps/doctor-suit/app/utils/messageOutbox.ts',
  'apps/doctor-suit/supabase/functions/_shared/operational-signals.ts',
  'apps/doctor-suit/supabase/migrations/20261020161202_patient_contact_consent.sql',
  'apps/doctor-suit/supabase/migrations/20261020174121_neutral_outbox.sql',
])
export function createDoctorIncidentTrace() {
  const outcomes = new Map(), alerts = []
  let rejected = false
  return Object.freeze({
    record(signal) {
      // This is a bounded captured-alert fixture, not a production alert threshold.
      if (typeof signal !== 'string' || !signals.includes(signal) || alerts.length >= 64) { rejected = true; return false }
      alerts.push(signal); return true
    },
    check(id, passed) {
      if (!incidentChecks.includes(id) || outcomes.has(id) || typeof passed !== 'boolean') throw new Error('Incident evidence assertion contract rejected')
      outcomes.set(id, passed)
      if (!passed) throw new Error(`Synthetic incident assertion failed: ${id}`)
    },
    snapshot: () => Object.freeze({
      checks: Object.freeze(incidentChecks.map(id => Object.freeze({ id, status: !outcomes.has(id) ? 'unrun' : outcomes.get(id) ? 'passed' : 'failed' }))),
      alerts: Object.freeze([...alerts]), rejected,
    }),
  })
}

export function doctorIncidentReceipt(binding, snapshot, exitCode) {
  const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value)
  const hashes = incidentInputs.map(file => ({ file, sha256: binding.inputHashes?.[file] }))
  if (!sha(binding.head) || !sha(binding.base) || !/^\d+:\d+:doctor-browser$/.test(binding.executionId)
    || hashes.some(row => typeof row.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(row.sha256))
    || snapshot.checks.length !== incidentChecks.length
    || snapshot.checks.some((row, i) => row.id !== incidentChecks[i] || !['passed', 'failed', 'unrun'].includes(row.status))
    || snapshot.alerts.length > 64 || snapshot.alerts.some(signal => !signals.includes(signal))
    || typeof snapshot.rejected !== 'boolean' || !Number.isInteger(exitCode) || exitCode < 0) throw new Error('Incident receipt contract rejected')
  const accepted = binding.sourceVerified === true && exitCode === 0 && !snapshot.rejected
    && snapshot.checks.every(row => row.status === 'passed') && signals.every(signal => snapshot.alerts.includes(signal))
  // Project fields explicitly: never serialize caller objects, exceptions or fixtures.
  return {
    caseId: 'DOS-M7-007-C03', executionId: binding.executionId, sourceHead: binding.head, baseSha: binding.base,
    inputHashes: hashes, sourceVerified: binding.sourceVerified === true,
    commandArgv: ['node', 'apps/doctor-suit/tests/disposable-provider.mjs'], nodeVersion: process.version,
    exitCode, accepted, checks: snapshot.checks.map(row => ({ id: row.id, status: row.status })),
    capturedAlerts: snapshot.alerts.map(signal => ({ signal, destination: 'in_process_fixture' })),
    captureRejected: snapshot.rejected, externalDelivery: false, hostedOperations: false,
    accountableIncidentReview: 'unavailable', fullTaskAccepted: false,
  }
}

export async function beginDoctorIncidentEvidence(root, environment = process.env) {
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REPOSITORY !== 'Building-Suit/building-suit-monorepo'
    || environment.GITHUB_JOB !== 'doctor-browser' || !/^\d+$/.test(environment.GITHUB_RUN_ID ?? '')
    || !/^\d+$/.test(environment.GITHUB_RUN_ATTEMPT ?? '') || !environment.GITHUB_EVENT_PATH) throw new Error('Incident evidence requires the owned GitHub job')
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
    if (result.status !== 0) throw new Error('Incident source binding unavailable')
    return result.stdout.trim()
  }
  const event = JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, 'utf8'))
  const head = git(['rev-parse', 'HEAD'])
  const expectedHead = environment.GITHUB_EVENT_NAME === 'pull_request' ? event.pull_request?.head?.sha : environment.GITHUB_EVENT_NAME === 'push' ? event.after : null
  const base = environment.GITHUB_EVENT_NAME === 'pull_request' ? event.pull_request?.base?.sha : event.before
  if (head !== expectedHead || !/^[0-9a-f]{40}$/.test(base ?? '') || /^0+$/.test(base) || git(['status', '--porcelain']) !== '') throw new Error('Incident candidate or base mismatch')
  git(['merge-base', '--is-ancestor', base, head])
  const hashInputs = async () => Object.fromEntries(await Promise.all(incidentInputs.map(async file => [file, createHash('sha256').update(await readFile(path.join(root, file))).digest('hex')])))
  const inputHashes = await hashInputs()
  const executionId = `${environment.GITHUB_RUN_ID}:${environment.GITHUB_RUN_ATTEMPT}:${environment.GITHUB_JOB}`
  return Object.freeze({
    async finish(trace, exitCode) {
      const sourceVerified = git(['rev-parse', 'HEAD']) === head && git(['status', '--porcelain']) === '' && JSON.stringify(await hashInputs()) === JSON.stringify(inputHashes)
      return doctorIncidentReceipt({ head, base, inputHashes, executionId, sourceVerified }, trace.snapshot(), exitCode)
    },
  })
}

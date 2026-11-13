// Supplemental document/current-intake comparison, never canonical C01-C03 fulfillment acceptance.
// No network, Auth, database, browser, provider or policy activation.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const started = new Date().toISOString(), args = process.argv.slice(2)
assert.equal(args.length, 4); assert.equal(args[0], '--base'); assert.equal(args[2], '--head')
const [base, head] = [args[1], args[3]]
assert.match(base, /^[a-f0-9]{40}$/); assert.match(head, /^[a-f0-9]{40}$/)
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const root = git('rev-parse', '--show-toplevel'), folder = 'docs/work-packages/doctor-suit/implementation/', checks = [], inputs = {}
const hash = value => createHash('sha256').update(value).digest('hex')
const source = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], { stdio: ['ignore', 'pipe', 'pipe'] })
const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item)
function check(id, condition) { checks.push({ id, status: condition ? 'passed' : 'failed' }) }
function bound(file) { const bytes = source(head, file); inputs[file] = hash(bytes); check('working-source:' + file, hash(readFileSync(path.join(root, file))) === inputs[file]); return bytes }
function rejects(action) { try { action(); return false } catch { return true } }
try {
  check('exact-committed-candidate', git('rev-parse', 'HEAD') === head)
  check('parent-ancestry', git('merge-base', base, head) === base)
  bound(folder + 'dos-m7-004-verify.mjs'); bound(folder + 'dos-m7-004.md')
  const p = JSON.parse(bound(folder + 'dos-m7-004-packet.json'))
  check('canonical-task-and-exact-parent', p.task_id === 'DOS-M7-004' && p.parent_pr === 502 && p.parent_head === base && p.candidate_binding === 'evaluated-committed-head')
  check('scope-is-proposal-only', p.scope === 'proposed-policy-and-case-contract-only' && !p.actual_fulfillment_implemented && p.full_task_acceptance === false)
  check('qualified-decisions-absent', ['qualified_policy_approval', 'qualified_identity_policy', 'approved_retention_schedule', 'approved_hold_resolution', 'approved_refusal_partial_policy', 'accountable_review_receipt'].every(k => p[k] === null) && p.actual_outcome_receipts.length === 0)
  const ids = ['account-profile', 'practice-administration', 'patient-administration', 'guardian-relationship', 'clinical-draft', 'signed-clinical-version', 'private-documents', 'released-clinical-material', 'practice-money', 'saas-money', 'communication-outbox', 'audit-security', 'backup-recovery']
  check('record-class-coverage', p.policy_matrix.length === ids.length && ids.every(id => p.policy_matrix.filter(row => row.record_class === id).length === 1))
  for (const row of p.policy_matrix) check('unapproved-record-policy:' + row.record_class, row.policy_state === 'unapproved' && row.scope.length > 0 && row.known_constraint.length > 0 && ['retention_period', 'retention_trigger', 'legal_basis', 'legal_hold_rule', 'identity_evidence_rule', 'access_rule', 'correction_rule', 'export_rule', 'erasure_rule', 'refusal_partial_rule', 'accountable_owner', 'qualified_approval'].every(k => row[k] === null))
  const c = p.proposed_case_contract
  check('scoped-case-and-history-proposed-only', c.status === 'proposal-not-deployed' && c.scope_binding.length === 10 && new Set(c.scope_binding).size === 10 && c.minimum_case_history.length === 12 && c.decision_requirements.length === 9)
  check('no-invented-period-or-outcome', Object.values(c.unavailable_fields).every(value => value === null) && c.proposed_states.length === 7 && c.proposed_outcomes.join(',') === 'fulfilled,refused,partial')
  check('proposal-integrity', hash(canonical({ matrix: p.policy_matrix, contract: c, scenarios: p.proposed_scenarios })) === p.proposal_sha256)
  const cases = ['own-account-intake', 'shared-contact-impersonation', 'cross-practice-scope', 'revoked-guardian', 'signed-record-correction', 'legal-hold-erasure', 'financial-retention-conflict', 'partial-outcome', 'refused-outcome', 'uncertain-execution', 'repeat-request', 'restore-after-outcome']
  check('concrete-scenarios-not-executed-or-approved', p.proposed_scenarios.length === cases.length && cases.every(id => p.proposed_scenarios.filter(s => s.id === id).length === 1) && p.proposed_scenarios.every(s => s.execution === 'unrun-policy-dependent' && s.approved_expected_outcome === null && s.trigger.length > 0 && s.required_behavior.length > 0))
  check('canonical-acceptance-still-held', p.canonical_cases['DOS-M7-004-C01'].startsWith('unavailable-') && p.canonical_cases['DOS-M7-004-C02'].startsWith('unavailable-') && p.canonical_cases['DOS-M7-004-C03'].startsWith('unrun-'))
  check('actionable-review-requests', p.next_required_evidence.length === 5 && p.next_required_evidence.every(e => e.missing.length > 0 && e.blocks.length > 0))
  check('existing-behavior-not-upgraded', p.existing_behavior.own_account_intake_state === 'awaiting_review' && p.existing_behavior.policy_configured === false && p.existing_behavior.fulfillment_available === false && p.existing_behavior.clinical_export_retention === 'unapproved_no_erasure' && p.existing_behavior.clinical_export_storage_bytes_included === false && p.existing_behavior.clinical_export_is_rights_fulfillment === false)
  for (const task of ['001', '002', '003']) { const prior = JSON.parse(bound(folder + `dos-m7-${task}-packet.json`)); check('upstream-domain-gate-open:' + task, prior.gate_state === 'OPEN' && prior.full_task_acceptance === false) }
  const decoder = 'apps/doctor-suit/app/utils/privacyRequests.ts'
  for (const file of [decoder, 'apps/doctor-suit/app/utils/locationContext.ts', 'packages/contracts/src/doctorClinical.ts', 'apps/doctor-suit/supabase/migrations/20261020003704_clinical_m2_013.sql']) { const bytes = bound(file); check('existing-runtime-parent-identical:' + file, hash(bytes) === hash(source(base, file))) }
  const { doctorPrivacySnapshot } = await import(pathToFileURL(path.join(root, decoder)).href)
  const id = n => `d2070004-0000-4000-8000-${String(n).padStart(12, '0')}`, actor = { userId: id(1) }
  const item = { id: id(2), kind: 'access_review', state: 'awaiting_review', created_at: '2026-10-29T00:00:00Z' }
  const safe = { user_id: actor.userId, scope: 'own_account', data_mode: 'synthetic', policy_configured: false, fulfillment_available: false, items: [item] }
  check('actual-current-intake-contract', doctorPrivacySnapshot(safe, actor)[0].state === 'awaiting_review')
  for (const [label, patch] of Object.entries({ cross_account: { user_id: id(3) }, patient_scope: { scope: 'patient' }, real_data: { data_mode: 'real' }, fabricated_policy: { policy_configured: true }, fabricated_fulfillment: { fulfillment_available: true } })) check('actual-intake-rejects:' + label, rejects(() => doctorPrivacySnapshot({ ...safe, ...patch }, actor)))
  for (const state of ['approved', 'fulfilled', 'refused', 'partial']) check('actual-intake-rejects-outcome:' + state, rejects(() => doctorPrivacySnapshot({ ...safe, items: [{ ...item, state }] }, actor)))
  check('actual-intake-rejects-duplicate-kind', rejects(() => doctorPrivacySnapshot({ ...safe, items: [item, { ...item, id: id(4) }] }, actor)))
  check('actual-intake-drops-unapproved-payload', !Object.hasOwn(doctorPrivacySnapshot({ ...safe, items: [{ ...item, unauthorized_payload: 'SYNTHETIC_PROBE' }] }, actor)[0], 'unauthorized_payload'))
  let tasks = 0
  for (let n = 1; n <= 9; n++) { const file = `docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`, bytes = bound(file); tasks += JSON.parse(bytes).tasks.length; check('canonical-packet-unchanged:' + n, hash(bytes) === hash(source(base, file))) }
  check('canonical-nine-packets-104-tasks', tasks === 104)
  const allowed = new Set(['dos-m7-004.md', 'dos-m7-004-packet.json', 'dos-m7-004-verify.mjs', 'dos-m7-004-verification.json', 'dos-m7-004-reconciliation-20261029.json', 'dos-m7-004-ledger514-verification.json', 'dos-m7-004-shop515-verification.json', 'm7-continuation.md'].map(f => folder + f).concat('release-fragments/dos-m7-004.json', 'release-fragments/dos-m7-004-consolidation-hold-20261029.json', 'release-fragments/dos-m7-004-queued-reconciliation-20261029.json', 'release-fragments/dos-m7-004-ledger514-binding-20261029.json', 'release-fragments/dos-m7-004-shop515-binding-20261029.json'))
  check('no-runtime-or-foreign-task-implementation', git('diff', '--name-only', base, head).split('\n').filter(Boolean).every(file => allowed.has(file)))
} catch { check('input-or-contract-evaluation', false) }
const failed = checks.filter(c => c.status === 'failed').length, code = failed ? 1 : 2
console.log(JSON.stringify({ schema: 'doctor-privacy-policy-comparison/v1', execution_id: randomUUID(), task_id: 'DOS-M7-004', comparison_kind: 'supplemental-policy-packet-and-existing-intake', exact_base: base, exact_candidate: head, started_at_utc: started, ended_at_utc: new Date().toISOString(), node: process.versions.node, evaluated_input_sha256: inputs, checks, controls_passed: checks.length - failed, controls_failed: failed, exit_code: code, result: failed ? 'failed' : 'UNAVAILABLE-domain-policy-and-fulfillment-acceptance', canonical_case_acceptance: false, runtime_execution: false, authority_granted: false, full_task_acceptance: false }, null, 2))
process.exitCode = code

// Supplemental source/review-handoff comparison. Not an independent security assessment.
// Executes no supplied finding command, runtime, provider call or security approval.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
const started = new Date().toISOString(), args = process.argv.slice(2)
assert.equal(args.length, 4); assert.equal(args[0], '--base'); assert.equal(args[2], '--head')
const [base, head] = [args[1], args[3]]
assert.match(base, /^[a-f0-9]{40}$/); assert.match(head, /^[a-f0-9]{40}$/)
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const source = (revision, file) => execFileSync('git', ['show', `${revision}:${file}`], { stdio: ['ignore', 'pipe', 'pipe'] })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const folder = 'docs/work-packages/doctor-suit/implementation/', checks = [], inputs = {}
function check(id, ok) { checks.push({ id, status: ok ? 'passed' : 'failed' }) }
function bound(file) { const bytes = source(head, file); inputs[file] = hash(bytes); check('working-source:' + file, hash(readFileSync(file)) === inputs[file]); return bytes }
try {
  check('exact-committed-source', git('rev-parse', 'HEAD') === head)
  check('parent-is-ancestor', git('merge-base', base, head) === base)
  bound(folder + 'dos-m7-005-verify.mjs'); bound(folder + 'dos-m7-005.md')
  const packet = JSON.parse(bound(folder + 'dos-m7-005-packet.json'))
  check('canonical-task-and-parent', packet.task_id === 'DOS-M7-005' && packet.parent_pr === 505 && packet.parent_head === base)
  check('preparation-only', packet.scope === 'source-inventory-and-independent-review-handoff' && packet.full_task_acceptance === false && packet.runtime_execution === false)
  check('no-self-issued-assessment', packet.assessment_receipt === null && packet.accountable_assessor === null && packet.findings === null && packet.residual_risk_decisions === null)
  check('canonical-criteria-unavailable', ['C01', 'C02', 'C03'].every(id => packet.canonical_cases[id].startsWith('unavailable-')))
  const expected = ['tenant-location', 'auth-recovery', 'email-abuse', 'private-documents', 'realtime', 'audit', 'privacy-clinical', 'android-vault', 'android-online', 'dependencies']
  check('complete-proposed-review-scope', packet.surfaces.length === expected.length && expected.every(id => packet.surfaces.filter(row => row.surface_id === id).length === 1))
  const seen = new Set()
  for (const row of packet.surfaces) {
    check('unassessed-surface:' + row.surface_id, row.independent_assessment === 'unavailable' && row.execution_in_this_task === 'not-executed' && row.source_observation.length > 0 && row.required_independent_review.length > 0 && row.source_paths.length > 0 && row.existing_test_paths.length > 0)
    for (const file of [...row.source_paths, ...row.existing_test_paths]) {
      if (seen.has(file)) continue
      seen.add(file)
      const bytes = bound(file)
      check('exact-parent-input:' + file, hash(bytes) === hash(source(base, file)) && hash(bytes) === packet.input_sha256[file])
    }
  }
  check('hash-map-has-no-extra-inputs', Object.keys(packet.input_sha256).length === seen.size)
  check('finding-contract-is-not-a-finding', packet.proposed_finding_fields.includes('assessor_reference') && packet.proposed_finding_fields.includes('severity') && packet.proposed_finding_fields.includes('exact_candidate_sha') && packet.proposed_finding_fields.includes('retest_receipt') && packet.proposed_finding_fields.includes('launch_blocking'))
  check('no-developer-waiver', packet.launch_rule.developer_waiver_allowed === false && packet.launch_rule.empty_findings_means_pass === false && packet.launch_rule.accountable_review_required === true)
  check('no-commands-from-evidence', packet.finding_command_policy === 'record-reviewed-argv-only-never-execute-from-packet')
  let count = 0
  for (let n = 1; n <= 9; n++) {
    const file = `docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`, bytes = bound(file)
    count += JSON.parse(bytes).tasks.length
    check('canonical-packet-preserved:' + n, hash(bytes) === hash(source(base, file)))
  }
  check('nine-packets-104-tasks', count === 104)
  const prior = JSON.parse(bound(folder + 'dos-m7-004-packet.json'))
  check('privacy-dependency-not-accepted', prior.full_task_acceptance === false && prior.qualified_policy_approval === null)
  const allowed = new Set(['dos-m7-005.md', 'dos-m7-005-packet.json', 'dos-m7-005-verify.mjs', 'dos-m7-005-verification.json'].map(file => folder + file).concat('release-fragments/dos-m7-005.json'))
  const changed = git('diff', '--name-only', base, head).split('\n').filter(Boolean)
  check('only-owned-evidence-changed', changed.length > 0 && changed.every(file => allowed.has(file)))
} catch { check('input-or-contract-evaluation', false) }
const failed = checks.filter(row => row.status === 'failed').length, code = failed ? 1 : 2
console.log(JSON.stringify({ schema: 'doctor-security-review-handoff-comparison/v1', task_id: 'DOS-M7-005', execution_id: randomUUID(), exact_base: base, exact_candidate: head, argv: ['node', folder + 'dos-m7-005-verify.mjs', ...args], started_at_utc: started, ended_at_utc: new Date().toISOString(), node: process.versions.node, evaluated_input_sha256: inputs, checks, controls_passed: checks.length - failed, controls_failed: failed, exit_code: code, result: failed ? 'failed' : 'UNAVAILABLE-independent-assessment-findings-and-accountable-review', independent_assessment_performed: false, canonical_case_acceptance: false, runtime_execution: false, authority_granted: false, full_task_acceptance: false }, null, 2))
process.exitCode = code

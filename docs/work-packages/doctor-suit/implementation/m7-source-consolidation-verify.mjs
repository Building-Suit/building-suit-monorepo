// Source-containment verification only; no qualified legal/privacy/security decision.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
const args = process.argv.slice(2)
assert.deepEqual([args[0], args[2]], ['--base', '--head'])
assert.equal(args.length, 4)
const [base, head] = [args[1], args[3]]
for (const ref of [base, head]) assert.match(ref, /^[a-f0-9]{40}$/)
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const source = (ref, file) => execFileSync('git', ['show', `${ref}:${file}`], { stdio: ['ignore', 'pipe', 'pipe'] })
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const folder = 'docs/work-packages/doctor-suit/implementation/'
const checks = []
const check = (id, condition) => checks.push({ id, status: condition ? 'passed' : 'failed' })
try {
  check('exact-committed-head', git('rev-parse', 'HEAD') === head)
  check('exact-verifier-bytes', hash(readFileSync(folder + 'm7-source-consolidation-verify.mjs')) === hash(source(head, folder + 'm7-source-consolidation-verify.mjs')))
  const binding = JSON.parse(source(head, folder + 'm7-source-consolidation-2026-10-29.json'))
  check('recorded-staging-base', binding.exact_staging_base === base)
  for (const ref of [base, binding.evaluated_committed_merge, binding.preserved_preparation_leaf]) check('preserved-ancestor:' + ref, git('merge-base', ref, head) === ref)
  check('three-canonical-task-bindings', binding.tasks.length === 3 && ['DOS-M7-001', 'DOS-M7-004', 'DOS-M7-005'].every(id => binding.tasks.filter(task => task.task_id === id).length === 1))
  for (const task of binding.tasks) {
    const bytes = source(head, task.historical_receipt), receipt = JSON.parse(bytes)
    check('historical-receipt-unchanged:' + task.task_id, hash(bytes) === task.historical_receipt_sha256)
    check('historical-candidate-retained:' + task.task_id, git('merge-base', receipt.exact_candidate, head) === receipt.exact_candidate)
    const controls = receipt.checks || receipt.assertions
    check('original-controls-retained:' + task.task_id, controls.length === task.preserved_control_count && controls.every(row => row.status === 'passed'))
    check('unavailable-is-not-acceptance:' + task.task_id, receipt.exit_code === 2 && receipt.full_task_acceptance === false && task.full_task_acceptance === false)
    for (const [file, digest] of Object.entries(receipt.evaluated_input_sha256)) check('same-evaluated-input:' + task.task_id + ':' + file, hash(source(head, file)) === digest)
  }
  const additions = ['m7-source-consolidation-2026-10-29.json', 'm7-source-consolidation-2026-10-29.md', 'm7-source-consolidation-verify.mjs'].map(file => folder + file)
  const allowed = new Set([...binding.changed_source_files, ...additions, 'release-fragments/doctor-m7-source-consolidation-20261029.json'])
  check('only-declared-evidence-changes', git('diff', '--name-only', base, head).split('\n').filter(Boolean).every(file => allowed.has(file)))
  check('runtime-tooling-and-dependencies-unchanged', git('diff', '--name-only', base, head, '--', 'apps', 'packages', 'tooling', '.github', 'package.json', 'pnpm-lock.yaml') === '')
  let taskCount = 0
  for (let n = 1; n <= 9; n++) {
    const file = `docs/work-packages/doctor-suit/planning-v0.4/DOS-M${n}.json`, bytes = source(head, file)
    taskCount += JSON.parse(bytes).tasks.length
    check('canonical-packet-unchanged:' + n, hash(bytes) === hash(source(base, file)))
  }
  check('104-canonical-tasks', taskCount === 104)
} catch { check('input-binding', false) }
const failed = checks.filter(row => row.status === 'failed').length
const code = failed ? 1 : 2
console.log(JSON.stringify({ schema: 'doctor-m7-integration-source-check/v1', exact_base: base, exact_candidate: head, checks, controls_passed: checks.length - failed, controls_failed: failed, exit_code: code, result: failed ? 'FAILED-source-binding' : 'source-controls-verified-domain-acceptance-UNAVAILABLE', historical_controls_reexecuted: false, runtime_execution: false, qualified_approval_supplied: false, full_task_acceptance: false }, null, 2))
process.exitCode = code

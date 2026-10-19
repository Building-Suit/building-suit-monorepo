import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
const reviewIf = workflow.match(/ {2}review:[\s\S]*? {4}if: >-\n([\s\S]*?) {4}runs-on:/)[1].trim()
const verifyIf = workflow.match(/ {2}verify:[\s\S]*? {4}if: >-\n([\s\S]*?) {4}concurrency:/)[1].trim()
const reviewName = workflow.match(/ {2}review:[\s\S]*? {4}name: \$\{\{ (.*?) \}\}/)[1]
const verifyName = workflow.match(/ {2}verify:[\s\S]*? {4}name: \$\{\{ (.*?) \}\}/)[1]
const concurrency = workflow.match(/ {2}group: verify-\$\{\{ github.ref \}\}-\$\{\{ (.*?) \}\}/)[1]
// Evaluate the actual workflow expressions for representative GitHub payloads.
// Missing context properties evaluate to null in Actions; optional reads model it.
function evaluate(expression, github, { cancelled = false, steps = {}, success = true, needs = {} } = {}) {
  const source = expression.replace(/(?:github|steps|needs)(?:\.[A-Za-z_][A-Za-z_0-9-]*)+/g, path => {
    const [root, ...keys] = path.split('.')
    return root + keys.map(key => `?.[${JSON.stringify(key)}]`).join('')
  })
  return Function('github', 'steps', 'needs', 'cancelled', 'success', `return (${source})`)(github, steps, needs, () => cancelled, () => success)
}
function event(action, changes, event_name = 'pull_request') {
  return { event_name, event: { action, changes } }
}
test('title/body edits do not rerun code validation or cancel a code run', () => {
  for (const changes of [{ title: { from: 'Old title' } }, { body: { from: 'Old body' } }]) {
    const payload = event('edited', changes)
    assert.equal(evaluate(reviewIf, payload), false)
    assert.equal(evaluate(concurrency, payload), 'metadata')
    assert.equal(evaluate(reviewName, payload), 'metadata-review')
    assert.equal(evaluate(verifyName, payload), 'metadata-verify')
  }
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited\]/)
  assert.match(workflow, / {2}branch-policy:\n {4}if: github.event_name == 'pull_request'/)
  assert.match(workflow, /!cancelled\(\) && needs.review.result == 'success'/)
})
test('code, retarget, ambiguous edit and protected push events retain complete validation', () => {
  for (const payload of [
    event('synchronize'), event('opened'), event('reopened'),
    event('edited', { base: { ref: { from: 'old-parent' } } }),
    event('edited', { title: {}, base: { ref: { from: 'old-parent' } } }),
    event('edited'), event(undefined, undefined, 'push'),
  ]) {
    assert.equal(evaluate(reviewIf, payload), true)
    assert.equal(evaluate(concurrency, payload), 'code')
    assert.equal(evaluate(reviewName, payload), 'review')
    assert.equal(evaluate(verifyName, payload), 'verify')
  }
  assert.match(workflow, /push:\n {4}branches: \[stg, main\]/)
  assert.match(workflow, /group: workspace-full-validation\n {6}cancel-in-progress: false/)
})


test('cancelled full validation stops heavy steps and cannot produce successful readiness', () => {
  const needs = { review: { result: 'success' }, 'branch-policy': { result: 'success' } }
  const root = { ...event('synchronize'), base_ref: 'stg' }
  assert.equal(evaluate(verifyIf, root, { needs }), true)
  assert.equal(evaluate(verifyIf, root, { needs, cancelled: true }), false)
  assert.equal(evaluate(verifyIf, root, { needs: { ...needs, review: { result: 'failure' } } }), false)
  assert.equal(evaluate(verifyIf, root, { needs: { ...needs, 'branch-policy': { result: 'failure' } } }), false)
  assert.equal(evaluate(verifyIf, { ...root, base_ref: 'feature-parent' }, { needs }), false)
  assert.equal(evaluate(verifyIf, event(undefined, undefined, 'push'), { needs: { ...needs, 'branch-policy': { result: 'skipped' } } }), true)

  const verify = workflow.slice(workflow.indexOf('  verify:'), workflow.indexOf('  doctor-m1-shop-backend:'))
  const conditions = [...verify.matchAll(/^ {8}if: (.+)$/gm)].map(match => match[1])
  const heavy = conditions.filter(condition => condition.startsWith('${{ success() && !cancelled()'))
  assert.ok(heavy.length >= 12, 'checkout, setup, build and all browser/test commands must stop')
  const stepBlocks = verify.split(/^ {6}- /m).slice(1)
  for (const step of stepBlocks) {
    const condition = step.match(/^ {8}if: (.+)$/m)?.[1]
    assert.ok(condition, 'every verify step declares its cancellation/cleanup policy')
    assert.ok(condition.startsWith('${{ success() && !cancelled()') || condition.startsWith('always()') || condition === 'failure()' || condition === 'cancelled()')
  }
  const shopSuites = stepBlocks.filter(step => /run: pnpm test:e2e(?::shared-regressions)?\n/.test(step))
  assert.equal(shopSuites.length, 2)
  for (const active of ['true', 'false']) {
    const steps = { 'doctor-m1-scope': { outputs: { active } } }
    const enabled = shopSuites.filter(step => evaluate(step.match(/^ {8}if: (.+)$/m)[1].slice(3, -2).trim(), event('synchronize'), { steps }))
    assert.equal(enabled.length, 1, 'one Shop regression path remains active on every valid scope')
  }

  for (const condition of heavy) {
    const expression = condition.slice(3, -2).trim()
    assert.equal(evaluate(expression, event('synchronize'), { cancelled: true }), false)
    assert.equal(evaluate(expression, event('synchronize'), { success: false }), false)
  }
  assert.match(verify, /name: Reject cancelled validation as readiness evidence\n {8}if: cancelled\(\)\n {8}run: exit 1/)
  assert.match(verify, /if: always\(\) && steps.doctor-m1-scope.outputs.active == 'true'/)
  assert.match(workflow, /group: release-catalog/)
})

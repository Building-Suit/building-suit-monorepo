import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
const reviewIf = workflow.match(/  review:[\s\S]*?    if: >-\n([\s\S]*?)    runs-on:/)[1].trim()
const reviewName = workflow.match(/  review:[\s\S]*?    name: \$\{\{ (.*?) \}\}/)[1]
const verifyName = workflow.match(/  verify:[\s\S]*?    name: \$\{\{ (.*?) \}\}/)[1]
const concurrency = workflow.match(/  group: verify-\$\{\{ github.ref \}\}-\$\{\{ (.*?) \}\}/)[1]
// Evaluate the actual workflow expressions for representative GitHub payloads.
// Missing context properties evaluate to null in Actions; optional reads model it.
function evaluate(expression, github) {
  const source = expression.replace(/github(?:\.[A-Za-z_]+)+/g, path => path.split('.').join('?.'))
  return Function('github', `return (${source})`)(github)
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
  assert.match(workflow, /  branch-policy:\n    if: github.event_name == 'pull_request'/)
  assert.match(workflow, /always\(\) && needs.review.result == 'success'/)
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
  assert.match(workflow, /push:\n    branches: \[stg, main\]/)
  assert.match(workflow, /group: workspace-full-validation\n      cancel-in-progress: false/)
})

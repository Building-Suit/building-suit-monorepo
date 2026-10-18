import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Lock the actual YAML trigger block, including its indentation. An exact allowlist
// fails closed on additional events, aliases, duplicate keys or changed filters.
const allowedTriggers = `on:
  push:
    branches: [stg, main]
  workflow_run:
    workflows: [Verify workspace]
    types: [completed]
    branches: [stg, main]
  schedule:
    - cron: '37 * * * *'
  workflow_dispatch:
`
function assertSafeTriggers(source) {
  const block = source.match(/^on:\n[\s\S]*?(?=^[^\s#])/m)?.[0]
  assert.equal(block, allowedTriggers)
  assert.equal((source.match(/^on:/gm) ?? []).length, 1)
}
const workflow = readFileSync(new URL('../../.github/workflows/releases.yml', import.meta.url), 'utf8')

test('actual release workflow allows only non-recursive protected-ref wake-ups', () => {
  assertSafeTriggers(workflow)
  assert.match(workflow, /needs: plan/ )
  assert.match(workflow, /if: needs\.plan\.outputs\.enabled == 'true'/)
  assert.match(workflow, /matrix: \$\{\{ fromJSON\(needs\.plan\.outputs\.matrix\) \}\}/)
  assert.match(workflow, /run: node tooling\/releases\/reconcile-targets\.mjs/)
  assert.doesNotMatch(workflow, /include:\n/)
  assert.match(workflow, /^ {4}environment: \$\{\{ matrix.environment \}\}$/m)
  assert.match(workflow, /^ {6}group: release-catalog-\$\{\{ matrix.environment \}\}$/m)
  assert.match(workflow, /^ {6}cancel-in-progress: false$/m)
  assert.match(workflow, /^ {8}run: node tooling\/releases\/publisher.mjs$/m)
})

test('deployment events emitted by environment jobs cannot be reintroduced as wake-ups', () => {
  for (const event of ['deployment_status', 'deployment', 'check_run', 'status']) {
    assert.throws(() => assertSafeTriggers(workflow.replace('  schedule:', `  ${event}:\n  schedule:`)))
  }
  assert.throws(() => assertSafeTriggers(workflow.replace('branches: [stg, main]', 'branches: ["**"]')))
  assert.throws(() => assertSafeTriggers(`${workflow}\non:\n  deployment_status:\n`))
})

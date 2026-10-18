import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import assert from 'node:assert/strict'
import test from 'node:test'
import { reconciliationTargets } from './reconcile-targets.mjs'
const repository = 'Building-Suit/building-suit-monorepo'
const target = (branch, eventName = 'push', event = {}) => reconciliationTargets({ repository, ref: `refs/heads/${branch}`, eventName, event })
const upstream = (branch, overrides = {}) => ({ workflow_run: { event: 'push', conclusion: 'success', head_branch: branch, head_repository: { full_name: repository }, ...overrides } })

test('protected push and explicit dispatch select only their admitted environment', () => {
  for (const event of ['push', 'workflow_dispatch', 'schedule']) {
    assert.deepEqual(target('stg', event), [{ environment: 'staging', branch: 'stg' }])
    assert.deepEqual(target('main', event), [{ environment: 'production', branch: 'main' }])
    assert.deepEqual(target('feature', event), [])
  }
})
test('default-main completion cannot request staging or use PR proof as release authority', () => {
  assert.deepEqual(target('main', 'workflow_run', upstream('main')), [{ environment: 'production', branch: 'main' }])
  assert.deepEqual(target('main', 'workflow_run', upstream('stg')), [])
  for (const overrides of [{ event: 'pull_request' }, { conclusion: 'failure' }, { conclusion: 'cancelled' }, { head_repository: { full_name: 'other/repository' } }]) {
    assert.deepEqual(target('main', 'workflow_run', upstream('main', overrides)), [])
  }
  assert.deepEqual(target('main', 'workflow_run'), [])
})
test('unsupported events, refs and repositories cannot select catalog credentials', () => {
  for (const eventName of ['deployment_status', 'deployment', 'pull_request', 'unknown']) assert.deepEqual(target('main', eventName), [])
  assert.deepEqual(reconciliationTargets({ repository, ref: 'toString', eventName: 'push' }), [])
  assert.deepEqual(reconciliationTargets({ repository: 'other/repository', ref: 'refs/heads/main', eventName: 'push' }), [])
})


test('Actions planner emits a bounded matrix and no environment for a PR completion', () => {
  const directory = mkdtempSync(join(tmpdir(), 'reconcile-plan-'))
  try {
    const eventPath = join(directory, 'event.json')
    const outputPath = join(directory, 'output')
    writeFileSync(eventPath, JSON.stringify(upstream('main', { event: 'pull_request' })))
    const result = execFileSync(process.execPath, [new URL('./reconcile-targets.mjs', import.meta.url).pathname], {
      encoding: 'utf8', env: { ...process.env, GITHUB_REPOSITORY: repository,
        GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_run',
        GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath },
    })
    assert.equal(readFileSync(outputPath, 'utf8'), 'enabled=false\nmatrix={"include":[]}\n')
    assert.match(result, /No authoritative, admissible/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

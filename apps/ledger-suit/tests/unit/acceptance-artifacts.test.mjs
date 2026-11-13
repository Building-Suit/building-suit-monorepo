import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

test('the maintained 138-requirement register and independent accounting worksheet pass acceptance validation', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('../../scripts/verify-v2-acceptance-artifacts.mjs', import.meta.url))], {
    encoding: 'utf8',
    timeout: 30_000,
  })
  assert.equal(result.status, 0, result.stderr || result.error?.message)
  assert.match(result.stdout, /138 distinct requirement states/)
  assert.match(result.stdout, /138 distinct requirement states and current dispositions/)
  assert.match(result.stdout, /certifies no deployment or accountant acceptance/)
})

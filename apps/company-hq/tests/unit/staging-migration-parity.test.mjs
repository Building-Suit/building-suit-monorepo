import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

test('HQ staging migration sources match the reviewed applied set and preserve the unapplied archive', () => {
  const result = spawnSync(process.execPath, ['apps/company-hq/supabase/verify-staging-migration-parity.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /17 applied baseline migrations; 1 pending forward migration/)
})

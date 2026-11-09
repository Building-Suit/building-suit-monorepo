import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
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
  assert.match(result.stdout, /17 applied baseline migrations; 23 pending forward migration/)
})


test('repository compatibility pending inventory rejects altered bindings and source bytes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hq-parity-'))
  try {
    const manifestPath = 'apps/company-hq/supabase/staging-migration-parity.json'
    const validator = 'apps/company-hq/supabase/verify-staging-migration-parity.mjs'
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8'))
    const compatibilityIndex = manifest.pendingMigrations.findIndex(row => row.phase === 'repository-worker-compatibility-review-only')
    assert.ok(compatibilityIndex >= 0)
    const paths = new Set([manifestPath, validator,
      'supabase/legacy/company-hq/migrations/' + manifest.archivedUnapplied.file,
      'tooling/hq-agent-host/bootstrap/initial-staging-pause.sql'])
    for (const row of [...manifest.appliedMigrations, ...manifest.pendingMigrations]) {
      paths.add('apps/company-hq/supabase/migrations/' + row.file)
      if (row.proposal) paths.add(row.proposal)
    }
    for (const file of paths) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
      copyFileSync(path.join(root, file), path.join(directory, file))
    }
    const run = () => spawnSync(process.execPath, [validator], { cwd: directory, encoding: 'utf8' })
    assert.equal(run().status, 0)
    for (const mutate of [
      row => { row.phase = 'unknown-phase' },
      row => { row.status = 'applied' },
      row => { row.proposal = validator },
      row => { row.sha256 = '0'.repeat(64) },
    ]) {
      const changed = structuredClone(manifest)
      mutate(changed.pendingMigrations[compatibilityIndex])
      writeFileSync(path.join(directory, manifestPath), JSON.stringify(changed))
      assert.notEqual(run().status, 0)
    }
    writeFileSync(path.join(directory, manifestPath), JSON.stringify(manifest))
    const row = manifest.pendingMigrations[compatibilityIndex]
    const proposal = path.join(directory, row.proposal)
    writeFileSync(proposal, readFileSync(proposal, 'utf8') + '\n')
    assert.notEqual(run().status, 0, 'canonical must match exact reviewed proposal')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

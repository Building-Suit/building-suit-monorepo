import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

test('HQ staging migration sources match the reviewed applied set and preserve the unapplied archive', () => {
  const result = spawnSync(process.execPath, ['apps/company-hq/supabase/verify-staging-migration-parity.mjs'], {
    cwd: root,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, result.stderr || result.stdout)
  assert.match(result.stdout, /17 applied baseline migrations; 36 pending forward migration/)
  assert.match(result.stdout, /1 recovered applied migration/)
})


test('compatibility and review-plan inventories reject altered bindings and source bytes', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hq-parity-'))
  try {
    const manifestPath = 'apps/company-hq/supabase/staging-migration-parity.json'
    const validator = 'apps/company-hq/supabase/verify-staging-migration-parity.mjs'
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8'))
    const indices = ['bounded-employee-parallelism', 'shop-suit-staff-snapshot', 'shop-suit-worker-compatibility', 'retail-assignment-context', 'repository-worker-compatibility-v2-review-only', 'repository-worker-compatibility-review-only', 'trial-review-plan-cache-review-only', 'skill-evidence-plan-reuse-review-only', 'trial-status-projection', 'trial-review-planning', 'repository-review-planning', 'founder-shared-authorization', 'live-dispatch-activation', 'live-dispatch-adaptive-activation'].map(phase => manifest.pendingMigrations.findIndex(row => row.phase === phase))
    assert.ok(indices.every(index => index >= 0))
    const paths = new Set([manifestPath, validator,
      'supabase/legacy/company-hq/migrations/' + manifest.archivedUnapplied.file,
      'tooling/hq-agent-host/bootstrap/initial-staging-pause.sql',
      'tooling/hq-agent-host/proposed-migrations/hq_live_dispatch_adaptive.sql'])
    for (const row of [...manifest.appliedMigrations, ...manifest.pendingMigrations, ...manifest.recoveredAppliedMigrations]) {
      paths.add('apps/company-hq/supabase/migrations/' + row.file)
      if (row.proposal) paths.add(row.proposal)
      if (row.provenance) paths.add(row.provenance)
    }
    for (const file of paths) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
      copyFileSync(path.join(root, file), path.join(directory, file))
    }
    const run = () => spawnSync(process.execPath, [validator], { cwd: directory, encoding: 'utf8' })
    assert.equal(run().status, 0)
    for (const index of indices) for (const mutate of [
      row => { row.phase = 'unknown-phase' },
      row => { row.status = 'applied' },
      row => { row.proposal = validator },
      row => { row.sha256 = '0'.repeat(64) },
    ]) {
      const changed = structuredClone(manifest)
      mutate(changed.pendingMigrations[index])
      writeFileSync(path.join(directory, manifestPath), JSON.stringify(changed))
      assert.notEqual(run().status, 0)
    }
    writeFileSync(path.join(directory, manifestPath), JSON.stringify(manifest))
    const row = manifest.pendingMigrations[indices[0]]
    const proposal = path.join(directory, row.proposal)
    writeFileSync(proposal, readFileSync(proposal, 'utf8') + '\n')
    assert.notEqual(run().status, 0, 'canonical must match exact reviewed proposal')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test('recovered history rejects changed bytes, matching edited hashes, false provenance and missing inventory', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hq-recovered-parity-'))
  try {
    const manifestPath = 'apps/company-hq/supabase/staging-migration-parity.json'
    const validator = 'apps/company-hq/supabase/verify-staging-migration-parity.mjs'
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), 'utf8'))
    const recovery = manifest.recoveredAppliedMigrations[0]
    const sourcePath = 'apps/company-hq/supabase/migrations/' + recovery.file
    const source = readFileSync(path.join(root, sourcePath))
    const provenance = JSON.parse(readFileSync(path.join(root, recovery.provenance), 'utf8'))
    const paths = new Set([manifestPath, validator,
      'supabase/legacy/company-hq/migrations/' + manifest.archivedUnapplied.file,
      'tooling/hq-agent-host/bootstrap/initial-staging-pause.sql',
      'tooling/hq-agent-host/proposed-migrations/hq_live_dispatch_adaptive.sql'])
    for (const row of [...manifest.appliedMigrations, ...manifest.pendingMigrations, ...manifest.recoveredAppliedMigrations]) {
      paths.add('apps/company-hq/supabase/migrations/' + row.file)
      if (row.proposal) paths.add(row.proposal)
      if (row.provenance) paths.add(row.provenance)
    }
    for (const file of paths) {
      mkdirSync(path.dirname(path.join(directory, file)), { recursive: true })
      copyFileSync(path.join(root, file), path.join(directory, file))
    }
    const run = () => spawnSync(process.execPath, [validator], { cwd: directory, encoding: 'utf8' })
    const reset = () => {
      writeFileSync(path.join(directory, manifestPath), JSON.stringify(manifest))
      writeFileSync(path.join(directory, recovery.provenance), JSON.stringify(provenance))
      writeFileSync(path.join(directory, sourcePath), source)
    }
    assert.equal(run().status, 0)
    for (const mutate of [
      value => { delete value.recoveredAppliedMigrations },
      value => { value.recoveredAppliedMigrations = [] },
      value => { value.recoveredAppliedMigrations.push(structuredClone(recovery)) },
      value => { value.recoveredAppliedMigrations[0].file = '20261111033000_hq_retail_assignment_context.sql' },
      value => { value.recoveredAppliedMigrations[0].provenance = validator },
      value => { value.projectRef = 'wrong-project' },
    ]) {
      reset(); const changed = structuredClone(manifest); mutate(changed)
      writeFileSync(path.join(directory, manifestPath), JSON.stringify(changed))
      assert.notEqual(run().status, 0)
    }
    for (const mutate of [
      value => { value.projectRef = 'wrong-project' },
      value => { value.migrationVersion = '20261111033000' },
      value => { value.source.type = 'git' },
      value => { value.source.statementCount = 2 },
      value => { value.verification.sha256 = '0'.repeat(64) },
      value => { value.verification.matchingLiveFunctionBodies = 0 },
      value => { value.gitOrigin.commit = 'a'.repeat(40) },
    ]) {
      reset(); const changed = structuredClone(provenance); mutate(changed)
      writeFileSync(path.join(directory, recovery.provenance), JSON.stringify(changed))
      assert.notEqual(run().status, 0)
    }
    for (const bytes of [Buffer.from('-- placeholder\n'), Buffer.concat([source, Buffer.from('\n')]), Buffer.from(source.toString().replaceAll('\n', '\r\n'))]) {
      reset(); writeFileSync(path.join(directory, sourcePath), bytes)
      assert.notEqual(run().status, 0, 'changed source must fail')
      const changed = structuredClone(manifest)
      Object.assign(changed.recoveredAppliedMigrations[0], { bytes: bytes.length,
        md5: createHash('md5').update(bytes).digest('hex'), sha256: createHash('sha256').update(bytes).digest('hex') })
      writeFileSync(path.join(directory, manifestPath), JSON.stringify(changed))
      assert.notEqual(run().status, 0, 'editing inventory hashes cannot bless new historical bytes')
    }
    reset(); rmSync(path.join(directory, recovery.provenance)); assert.notEqual(run().status, 0)
    reset(); rmSync(path.join(directory, sourcePath)); assert.notEqual(run().status, 0)
    reset(); assert.equal(run().status, 0, 'restoring the exact evidence passes')
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

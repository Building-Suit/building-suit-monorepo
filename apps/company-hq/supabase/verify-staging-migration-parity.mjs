import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const manifestPath = path.join(root, 'apps/company-hq/supabase/staging-migration-parity.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const migrationsDir = path.join(root, 'apps/company-hq/supabase/migrations')
const activeNames = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
const pending = manifest.pendingMigrations || []
const expectedNames = [...manifest.appliedMigrations, ...pending].map(row => row.file).sort()
const failures = []

if (pending.length > 1 || pending.some(row => row.status !== 'approved-source-not-deployed' || row.phase !== 'admission-fence' || !/^\d{14}_hq_worker_admission_fence\.sql$/.test(row.file))) failures.push('only the approved pending phase-1 admission fence is permitted')
if (new Set(expectedNames).size !== expectedNames.length) failures.push('duplicate migration inventory')
if (manifest.schemaVersion !== 1 || manifest.environment !== 'staging') failures.push('manifest identity is invalid')
if (activeNames.length !== expectedNames.length || activeNames.some((name, index) => name !== expectedNames[index])) {
  failures.push(`active migration set differs from reviewed staging baseline (expected ${expectedNames.length}, found ${activeNames.length})`)
}
for (const expected of [...manifest.appliedMigrations, ...pending]) {
  const bytes = readFileSync(path.join(migrationsDir, expected.file))
  if (bytes.length !== expected.bytes || digest('md5', bytes) !== expected.md5 || digest('sha256', bytes) !== expected.sha256) {
    failures.push(`migration differs from its reviewed source: ${expected.file}`)
  }
}
for (const expected of pending) {
  const proposal = readFileSync(path.join(root, expected.proposal))
  const canonical = readFileSync(path.join(migrationsDir, expected.file))
  const header = Buffer.from('-- Canonical phase-1 forward migration: fence and exact staging-worker initial pause.\n')
  const pause = readFileSync(path.join(root, 'tooling/hq-agent-host/bootstrap/initial-staging-pause.sql'))
  const body = proposal.subarray(0, proposal.length - Buffer.byteLength('commit;\n'))
  if (!proposal.toString().endsWith('commit;\n') || !canonical.equals(Buffer.concat([header, body, pause, Buffer.from('commit;\n')]))) failures.push('pending fence differs from tested proposal')
}
const archivePath = path.join(root, 'supabase/legacy/company-hq/migrations', manifest.archivedUnapplied.file)
const archived = readFileSync(archivePath)
if (archived.length !== manifest.archivedUnapplied.bytes
  || digest('md5', archived) !== manifest.archivedUnapplied.md5
  || digest('sha256', archived) !== manifest.archivedUnapplied.sha256) {
  failures.push(`archived unapplied migration changed: ${manifest.archivedUnapplied.file}`)
}
if (activeNames.includes(manifest.archivedUnapplied.file)) failures.push('unapplied migration is present in the active migration directory')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Staging source parity verified: ${manifest.appliedMigrations.length} applied baseline migrations; ${pending.length} pending forward migration(s); archived unapplied SQL preserved.`)
}

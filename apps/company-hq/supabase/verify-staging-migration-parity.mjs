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
const expectedNames = manifest.appliedMigrations.map(row => row.file).sort()
const failures = []

if (manifest.schemaVersion !== 1 || manifest.environment !== 'staging') failures.push('manifest identity is invalid')
if (activeNames.length !== expectedNames.length || activeNames.some((name, index) => name !== expectedNames[index])) {
  failures.push(`active migration set differs from reviewed staging baseline (expected ${expectedNames.length}, found ${activeNames.length})`)
}
for (const expected of manifest.appliedMigrations) {
  const bytes = readFileSync(path.join(migrationsDir, expected.file))
  if (bytes.length !== expected.bytes || digest('md5', bytes) !== expected.md5 || digest('sha256', bytes) !== expected.sha256) {
    failures.push(`applied migration differs from reviewed staging SQL: ${expected.file}`)
  }
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
  console.log(`Staging source parity verified: ${expectedNames.length} active migrations; archived unapplied SQL preserved.`)
}

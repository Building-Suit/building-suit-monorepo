// Compare all backed-up application/Auth/Storage table values without logging rows.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { artifact, digest, readJson, recoveryContext, root, writePrivate } from './native-recovery-context.mjs'

const target = recoveryContext('target')
const sourceDirectory = path.join(root, '.local/verification/recovery/source')
const backup = readJson(path.join(sourceDirectory, 'backup.json'))
assert.equal(readJson(path.join(target.directory, 'restore.json')).result, 'pass')
const sourceArtifact = backup.operations.find(operation => operation.operation === 'data.sql').artifact
assert.deepEqual(artifact(path.join(root, sourceArtifact.path)), sourceArtifact)
const targetFile = path.join(target.directory, `copy-audit-${Date.now()}.sql`)
const started = Date.now()
target.cli(['db', 'dump', '--local', '--data-only', '--use-copy', '--schema', 'public,app,auth,storage', '--file', targetFile],
  path.join(target.directory, 'copy-audit.log'))
function fingerprints(sql) {
  const tables = []
  const lines = sql.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const header = lines[index]
    const match = /^COPY "(public|app|auth|storage)"\."([^"]+)" .* FROM stdin;$/.exec(header)
    if (!match) continue
    const rows = []
    for (index++; index < lines.length && lines[index] !== '\\.'; index++) rows.push(lines[index])
    assert.ok(index < lines.length, 'Unterminated official COPY block')
    tables.push({ table: `${match[1]}.${match[2]}`, columns_sha256: digest(header), rows: rows.length, values_sha256: digest(JSON.stringify(rows.sort())) })
  }
  return tables.sort((a, b) => a.table.localeCompare(b.table))
}
const source = fingerprints(readFileSync(path.join(root, sourceArtifact.path), 'utf8'))
const restored = fingerprints(readFileSync(targetFile, 'utf8'))
assert.equal(source.filter(table => table.table.startsWith('public.') || table.table.startsWith('app.')).length, 122)
const names = new Set(source.map(table => table.table))
const managedHistory = new Set(['auth.schema_migrations', 'storage.migrations'])
for (const table of restored) assert.ok(names.has(table.table) || managedHistory.has(table.table), `Unclassified target table: ${table.table}`)
assert.deepEqual(restored.filter(table => names.has(table.table)), source, 'Restored table values/column contracts differ from the official source backup')
const evidence = { result: 'pass', tables: source.length, public_app_tables: 122,
  rows: source.reduce((sum, table) => sum + table.rows, 0), table_fingerprints: source,
  digest_sha256: digest(JSON.stringify(source)), elapsed_ms: Date.now() - started,
  source_artifact: sourceArtifact, target_artifact: artifact(targetFile),
  boundary: 'Canonical raw COPY values and column contracts; no raw Auth/session/password data is emitted. Provider migration tables remain managed separately.' }
writePrivate(path.join(target.directory, 'copy-audit.json'), evidence)
console.log(JSON.stringify({ result: 'pass', restored_tables: source.length, public_app_tables: 122, rows: evidence.rows,
  app_auth_storage_values: 'exact', digest_sha256: evidence.digest_sha256, elapsed_ms: evidence.elapsed_ms }))

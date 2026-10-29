// Freeze only the owned source APIs; take official SQL and file-backend backups.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdirSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { artifact, readJson, recoveryContext, root, writePrivate } from './native-recovery-context.mjs'

const source = recoveryContext('source')
const capture = readJson(path.join(source.directory, 'capture.json'))
assert.equal(capture.result, 'pass')
assert.equal(capture.source_database_container, source.info.Id)
assert.equal(capture.project, source.owner.project)
for (const item of [capture.database_snapshot, capture.manifest]) assert.deepEqual(artifact(path.join(root, item.path)), item)
const started = Date.now()
const directory = path.join(source.directory, `backup-${started}`)
mkdirSync(directory, { mode: 0o700 })
const names = ['kong', 'auth', 'rest', 'storage', 'inbucket'].map(service => `supabase_${service}_${source.owner.project}`)
for (const name of names) {
  const container = JSON.parse(source.docker(['inspect', name]))[0]
  assert.equal(realpathSync(container.Config.Labels['com.supabase.cli.workdir']), realpathSync(source.directory))
}
source.docker(['stop', ...names])
const frozenAt = new Date().toISOString()
writePrivate(path.join(directory, 'freeze.json'), { project: source.owner.project, containers: names, frozen_at: frozenAt,
  boundary: 'All owned gateway/Auth/REST/Storage/SMTP services stopped; native DB remains online for official dumps.' })
const inventory = JSON.parse(source.sql(`select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]') from storage.objects o`))
assert.deepEqual(inventory, readJson(path.join(source.directory, 'storage-inventory.json')), 'Provider object metadata changed since capture; investigate before backup')
const operations = []
for (const [name, flags] of [
  ['roles.sql', ['--role-only']],
  ['schema.sql', []],
  ['data.sql', ['--data-only', '--use-copy']],
  ['history-schema.sql', ['--schema', 'supabase_migrations']],
  ['history-data.sql', ['--schema', 'supabase_migrations', '--data-only', '--use-copy']],
]) {
  const file = path.join(directory, name)
  const result = source.cli(['db', 'dump', '--local', ...flags, '--file', file], path.join(directory, `${name}.log`))
  chmodSync(file, 0o600)
  assert.ok(readFileSync(file).length > 0, `Missing official dump: ${name}`)
  operations.push({ operation: name, ...result, artifact: artifact(file) })
}
// Local file backend only. Preserve versions/owners/IDs through SQL metadata and
// the separate complete named-volume archive, including other synthetic tenants.
assert.equal(capture.storage.backend, 'file')
assert.equal(capture.storage.volume, `supabase_storage_${source.owner.project}`)
assert.equal(capture.storage.path, '/mnt')
const storageStarted = Date.now()
const archive = path.join(directory, 'storage.tar')
writePrivate(archive, source.docker(['cp', `supabase_storage_${source.owner.project}:/mnt/.`, '-'], { encoding: null, maxBuffer: 64 * 1024 * 1024 }))
const listing = execFileSync('tar', ['-tf', archive], { encoding: 'utf8' }).trim().split('\n')
for (const name of listing) assert.ok(!path.posix.isAbsolute(name) && !name.split('/').includes('..'), 'Unsafe archive member')
operations.push({ operation: 'storage.tar', elapsed_ms: Date.now() - storageStarted, exit_code: 0, artifact: artifact(archive) })
const evidence = { result: 'pass', project: source.owner.project, source_database_container: source.info.Id,
  capture: artifact(path.join(source.directory, 'capture.json')), started_at: new Date(started).toISOString(), frozen_at: frozenAt,
  completed_at: new Date().toISOString(), elapsed_ms: Date.now() - started, operations,
  storage: capture.storage, source_data_volume_preserved: true,
  boundary: 'Native file-backend rehearsal; provider DB schemas and migration histories preserved separately; no hosted S3 or off-site operation claimed.' }
writePrivate(path.join(source.directory, 'backup.json'), evidence)
console.log(JSON.stringify({ result: 'pass', official_SQL_artifacts: 5, storage_archive_bytes: artifact(archive).bytes,
  storage_objects: inventory.length, storage_bytes: capture.storage.bytes, elapsed_ms: evidence.elapsed_ms,
  source_apis: 'frozen', source_database_and_volumes: 'preserved' }))

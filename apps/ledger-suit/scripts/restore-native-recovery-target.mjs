// Restore only the fresh owned target. Never clean/truncate/reset a source.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { artifact, digest, readJson, recoveryContext, root, writePrivate } from './native-recovery-context.mjs'

const target = recoveryContext('target')
const sourceDirectory = path.join(root, '.local/verification/recovery/source')
const backup = readJson(path.join(sourceDirectory, 'backup.json'))
const capture = readJson(path.join(sourceDirectory, 'capture.json'))
assert.equal(backup.result, 'pass')
assert.equal(backup.project, 'ledger-recovery-source-20261023')
assert.notEqual(target.owner.project, backup.project)
assert.notEqual(target.info.Id, backup.source_database_container)
assert.deepEqual(artifact(path.join(sourceDirectory, 'capture.json')), backup.capture)
for (const operation of backup.operations) {
  const file = path.resolve(root, operation.artifact.path)
  assert.ok(file.startsWith(`${sourceDirectory}${path.sep}`))
  assert.deepEqual(artifact(file), operation.artifact)
}
assert.equal(target.sql("select to_regclass('public.transactions') is null"), 't', 'Target already has a financial schema; inspect before any restore')
assert.equal(target.sql("select to_regnamespace('app') is null"), 't', 'Target already has application helpers; inspect before any restore')
assert.equal(target.sql('select count(*) from auth.users'), '0', 'Target must have no existing Auth users')
assert.equal(target.sql('select count(*) from storage.objects'), '0', 'Target must have no existing Storage objects')
const targetCredentials = target.credentials
const sourceCredentials = readJson(path.join(sourceDirectory, 'test-credentials.json'))
for (const key of ['jwt', 'anon', 'service']) assert.notEqual(targetCredentials[key], sourceCredentials[key], 'Recovery projects must have distinct signing/client/service keys')
const names = ['kong', 'auth', 'rest', 'storage', 'inbucket'].map(service => `supabase_${service}_${target.owner.project}`)
for (const name of names) {
  const container = JSON.parse(target.docker(['inspect', name]))[0]
  assert.equal(realpathSync(container.Config.Labels['com.supabase.cli.workdir']), realpathSync(target.directory))
}
const storageName = `supabase_storage_${target.owner.project}`
const storage = JSON.parse(target.docker(['inspect', storageName]))[0]
const storageEnv = Object.fromEntries(storage.Config.Env.map(value => [value.slice(0, value.indexOf('=')), value.slice(value.indexOf('=') + 1)]))
assert.equal(storageEnv.STORAGE_BACKEND, capture.storage.backend)
assert.equal(storageEnv.TENANT_ID, capture.storage.tenant_id)
assert.equal(storageEnv.FILE_STORAGE_BACKEND_PATH, capture.storage.path)
assert.ok(storage.Mounts.some(item => item.Type === 'volume' && item.Name === `supabase_storage_${target.owner.project}` && item.Destination === '/mnt'))
assert.notEqual(`supabase_storage_${target.owner.project}`, capture.storage.volume)
const started = Date.now()
target.docker(['stop', ...names])
const sqlFile = name => path.join(root, backup.operations.find(operation => operation.operation === name).artifact.path)
const customizationFile = path.join(sourceDirectory, 'application-provider-customizations.sql')
const pieces = ['begin;\n', readFileSync(sqlFile('roles.sql'), 'utf8'), readFileSync(sqlFile('schema.sql'), 'utf8'),
  // pg_policies deparses public relations using the capture's visible schema.
  // Pin that binding explicitly after pg_dump has emptied search_path.
  '\nset local search_path=public,storage,extensions;\n', readFileSync(customizationFile, 'utf8'),
  "\nset local search_path=''; set session_replication_role=replica;\n", readFileSync(sqlFile('data.sql'), 'utf8'),
  '\nset session_replication_role=origin;\n', readFileSync(sqlFile('history-schema.sql'), 'utf8'), readFileSync(sqlFile('history-data.sql'), 'utf8'), '\ncommit;\n']
const input = pieces.join('\n')
writePrivate(path.join(target.directory, 'restore-input-sha256.json'), { sha256: digest(input),
  boundary: 'One SQL transaction; no clean/drop/truncate/reset; app-owned Auth trigger and Storage policies recreated explicitly.' })
const databaseStarted = Date.now()
// Native roles.sql includes provider parameter grants requiring the existing
// local provider administrator. No application role is elevated or weakened.
try { target.psql(input, {}, 'supabase_admin') }
catch (error) {
  writePrivate(path.join(target.directory, 'restore-error.log'), error.stderr || 'Restore failed without server diagnostics')
  throw new Error('Owned target SQL restore failed and rolled back; inspect private SQLSTATE diagnostics', { cause: error })
}
const databaseElapsed = Date.now() - databaseStarted
assert.equal(target.sql('select count(*) from supabase_migrations.schema_migrations'), '107')
const expectedInventory = readJson(path.join(sourceDirectory, 'storage-inventory.json'))
const inventory = () => JSON.parse(target.sql(`select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]') from storage.objects o`))
assert.deepEqual(inventory(), expectedInventory, 'Restored provider metadata/UUIDs must match before copying bytes')
const storageStarted = Date.now()
const archive = sqlFile('storage.tar')
target.docker(['cp', '-a', '-', `${storageName}:/mnt`], { input: readFileSync(archive), maxBuffer: 64 * 1024 * 1024 })
const targetArchive = path.join(target.directory, 'restored-storage.tar')
writePrivate(targetArchive, target.docker(['cp', `${storageName}:/mnt/.`, '-'], { encoding: null, maxBuffer: 64 * 1024 * 1024 }))
// Python's standard tar reader handles Docker's PAX paths without extracting
// arbitrary members. Only regular files and directories are accepted.
const inspectArchive = file => JSON.parse(execFileSync('python3', ['-c', `import hashlib,json,pathlib,sys,tarfile
with tarfile.open(sys.argv[1]) as archive:
 result=[]
 for member in archive.getmembers():
  path=pathlib.PurePosixPath(member.name)
  assert not path.is_absolute() and '..' not in path.parts
  assert member.isfile() or member.isdir()
  if member.isfile(): result.append({'path':str(path),'bytes':member.size,'sha256':hashlib.sha256(archive.extractfile(member).read()).hexdigest(),'uid':member.uid,'gid':member.gid,'mode':member.mode})
 print(json.dumps(sorted(result,key=lambda item:item['path'])))`, file], { encoding: 'utf8' }))
const sourceFiles = inspectArchive(archive), targetFiles = inspectArchive(targetArchive)
assert.deepEqual(targetFiles, sourceFiles)
assert.equal(sourceFiles.length, 5)
assert.equal(sourceFiles.reduce((sum, file) => sum + file.bytes, 0), 262)
assert.deepEqual(inventory(), expectedInventory, 'Copying provider file bytes must not rewrite object metadata')
const storageElapsed = Date.now() - storageStarted
const restoredExtensions = JSON.parse(target.sql(`select jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',nspname) order by extname)
 from pg_extension join pg_namespace on extnamespace=pg_namespace.oid`))
assert.deepEqual(restoredExtensions, readJson(path.join(sourceDirectory, 'extensions.json')))
const restartStarted = Date.now()
target.docker(['start', ...names])
let ready = false
for (let attempt = 0; attempt < 150 && !ready; attempt++) {
  try {
    ready = (await Promise.all(['/auth/v1/health', '/storage/v1/status', '/rest-admin/v1/ready'].map(async route =>
      (await fetch(`${target.url}${route}`, { headers: { apikey: target.credentials.anon } })).status === 200))).every(Boolean)
  } catch { ready = false }
  if (!ready) await new Promise(resolve => setTimeout(resolve, 200))
}
assert.equal(ready, true, 'Restored target providers failed actual HTTP readiness')
const evidence = { result: 'pass', source_project: backup.project, target_project: target.owner.project,
  source_database_container: backup.source_database_container, target_database_container: target.info.Id,
  source_volume_preserved: true, target_pristine_before_restore: true, keys_distinct: true, database_restore_ms: databaseElapsed,
  database_restore_role: 'Existing supabase_admin in the owned disposable local container only',
  storage_restore_ms: storageElapsed, provider_restart_ms: Date.now() - restartStarted, elapsed_ms: Date.now() - started,
  started_at: new Date(started).toISOString(), completed_at: new Date().toISOString(),
  physical_storage_files: sourceFiles, physical_storage_bytes: 262, provider_metadata: 'exact including UUIDs/versions/owners',
  archive: artifact(targetArchive), provider_endpoints: 'actual HTTP200', application_migrations: 107 }
writePrivate(path.join(target.directory, 'restore.json'), evidence)
console.log(JSON.stringify({ result: 'pass', application_migrations: 107, physical_files: 5, physical_bytes: 262,
  provider_metadata: 'exact', keys_distinct: true, database_restore_ms: databaseElapsed, storage_restore_ms: storageElapsed,
  provider_restart_ms: evidence.provider_restart_ms, elapsed_ms: evidence.elapsed_ms }))

// Apply one published access migration only to this task's owned cloud-local fixture.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.argv.length, 2, 'This verifier accepts no URL, project or other argument')
assert.equal(process.env.LEDGER_ACCESS_HISTORY_DISPOSABLE_TEST, '1', 'Explicit disposable-test opt-in required')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const directory = path.join(root, '.local/verification/access-history')
const owner = JSON.parse(readFileSync(path.join(directory, 'owned-test-project.json'), 'utf8'))
assert.equal(owner.task, 'LEDGER-HISTORY-20261029')
assert.equal(owner.project, 'ledger-access-history-20261029')
assert.equal(realpathSync(owner.workdir), realpathSync(directory))
assert.equal(owner.database_port, 60922)
const config = readFileSync(path.join(directory, 'supabase/config.toml'), 'utf8')
assert.match(config, /^project_id = "ledger-access-history-20261029"$/m)
const environment = { ...process.env, SUPABASE_INTERNAL_IMAGE_REGISTRY: 'ledger.local', SUPABASE_HOME: path.join(directory, 'cli-home') }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete environment[key]
const docker = (args, options = {}) => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], {
  cwd: root, env: environment, encoding: 'utf8', timeout: 60_000, maxBuffer: 8 * 1024 * 1024, ...options,
})
const container = `supabase_db_${owner.project}`
const info = JSON.parse(docker(['inspect', container]))[0]
assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(port => port.HostPort === '60922'))
const sql = input => docker(['exec', '-i', container, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-f', '-', '-v', 'ON_ERROR_STOP=1', '-v', 'VERBOSITY=sqlstate'], { input }).trim()
assert.equal(sql('SHOW server_version_num').slice(0, 2), '17')
const migration = '20261022182716_explicit_data_api_access.sql'
const sourceDirectory = path.join(root, 'apps/ledger-suit/supabase/migrations')
const files = readdirSync(sourceDirectory).filter(file => file.endsWith('.sql')).sort()
assert.equal(files.length, 109, 'Reverify this bounded restoration against any changed migration set')
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const bytes = readFileSync(path.join(sourceDirectory, migration))
assert.equal(digest(bytes), '42e9922712a955ea509df6a409c84d2946c9d18e25d5a43131c5fc118b13f04f')
const beforeFiles = files.filter(file => file !== migration)
assert.deepEqual(readdirSync(path.join(directory, 'supabase/migrations')).filter(file => file.endsWith('.sql')).sort(), beforeFiles)
for (const file of beforeFiles) assert.deepEqual(readFileSync(path.join(directory, 'supabase/migrations', file)), readFileSync(path.join(sourceDirectory, file)))
const history = () => JSON.parse(sql("SELECT jsonb_object_agg(version, md5(to_jsonb(m)::text)) FROM supabase_migrations.schema_migrations m"))
const beforeHistory = history()
assert.deepEqual(Object.keys(beforeHistory).sort(), beforeFiles.map(file => file.split('_')[0]).sort())
const fingerprints = () => JSON.parse(sql(`
  CREATE TEMP TABLE ledger_history_fingerprints(schema_name text, table_name text, rows bigint, digest text);
  DO $capture$ DECLARE item record; total bigint; fingerprint text; BEGIN
    FOR item IN SELECT n.nspname,c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname IN ('public','app') AND c.relkind IN ('r','p') ORDER BY n.nspname,c.relname
    LOOP
      EXECUTE format('SELECT count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),%L ORDER BY to_jsonb(t)::text),%L)) FROM %I.%I t','','',item.nspname,item.relname) INTO total,fingerprint;
      INSERT INTO ledger_history_fingerprints VALUES(item.nspname,item.relname,total,fingerprint);
    END LOOP;
  END $capture$;
  SELECT jsonb_agg(jsonb_build_object('schema',schema_name,'table',table_name,'rows',rows::text,'digest',digest) ORDER BY schema_name,table_name) FROM ledger_history_fingerprints;
`))
const permissions = () => JSON.parse(sql(`
  SELECT jsonb_build_object(
    'tables',(SELECT jsonb_agg(jsonb_build_array(n.nspname,c.relname,r,v,has_table_privilege(r,c.oid,v)) ORDER BY n.nspname,c.relname,r,v)
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
      CROSS JOIN unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE']) v
      WHERE n.nspname IN ('public','app') AND c.relkind IN ('r','p','v','m')),
    'routines',(SELECT jsonb_agg(jsonb_build_array(n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),r,has_function_privilege(r,p.oid,'EXECUTE')) ORDER BY n.nspname,p.proname,pg_get_function_identity_arguments(p.oid),r)
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      CROSS JOIN unnest(ARRAY['anon','authenticated','service_role']) r
      WHERE n.nspname IN ('public','app') AND p.prorettype NOT IN ('trigger'::regtype,'event_trigger'::regtype))
  );
`))
const beforeRows = fingerprints()
assert.ok(beforeRows.length >= 100)
assert.ok(beforeRows.some(row => Number(row.rows) > 0), 'Require populated synthetic preservation evidence')
const beforePermissions = permissions()
copyFileSync(path.join(sourceDirectory, migration), path.join(directory, 'supabase/migrations', migration))
const cliLog = execFileSync(path.join(root, 'node_modules/.bin/supabase'), ['--workdir', directory, 'migration', 'up', '--local', '--include-all'], {
  cwd: root, env: environment, encoding: 'utf8', timeout: 120_000, stdio: ['ignore', 'pipe', 'pipe'],
})
const evidenceDirectory = path.join(directory, 'access-restoration-evidence')
mkdirSync(evidenceDirectory, { recursive: true, mode: 0o700 })
writeFileSync(path.join(evidenceDirectory, 'local-cli.log'), cliLog, { mode: 0o600 })
const afterRows = fingerprints()
const afterPermissions = permissions()
const afterHistory = history()
assert.deepEqual(afterRows, beforeRows, 'Every business table row/count fingerprint must be preserved')
assert.deepEqual(afterPermissions, beforePermissions, 'Existing CRUD and non-trigger execution contracts must be preserved')
assert.deepEqual(Object.keys(afterHistory).sort(), files.map(file => file.split('_')[0]).sort())
for (const [version, fingerprint] of Object.entries(beforeHistory)) assert.equal(afterHistory[version], fingerprint, `Existing migration record changed: ${version}`)
const result = {
  task: owner.task, project: owner.project, container, migration, migration_sha256: digest(bytes),
  before_migrations: Object.keys(beforeHistory).length, after_migrations: Object.keys(afterHistory).length,
  business_tables_preserved: beforeRows.length, business_rows: beforeRows.reduce((sum, row) => sum + Number(row.rows), 0),
  business_fingerprint_sha256: digest(JSON.stringify(beforeRows)),
  table_crud_permission_comparisons: beforePermissions.tables.length,
  non_trigger_execution_comparisons: beforePermissions.routines.length,
  permission_contract_sha256: digest(JSON.stringify(beforePermissions)),
  existing_migration_records_preserved: Object.keys(beforeHistory).length,
  result: 'pass', hosted_access: false,
}
writeFileSync(path.join(evidenceDirectory, 'result.json'), JSON.stringify(result, null, 2) + '\n', { mode: 0o600 })
console.log(JSON.stringify(result, null, 2))

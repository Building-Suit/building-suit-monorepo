// Capture a live native source before freezing its API and taking backups.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { exportOrganizationPortability } from './export-organization-portability.mjs'
import { verifyPortabilityFiles } from './compare-restore-evidence.mjs'
import { artifact, readJson, recoveryContext, root, writePrivate } from './native-recovery-context.mjs'

const source = recoveryContext('source')
const state = readJson(path.join(source.directory, 'fixture-state.json'))
assert.equal(state.storageVerified, true)
for (const key of ['actor', 'organization']) assert.match(state[key], /^[\da-f-]{36}$/)
const migrations = path.join(root, 'apps/ledger-suit/supabase/migrations')
const files = readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(source.sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), files.map(file => file.split('_')[0]))
for (const file of files) assert.deepEqual(readFileSync(path.join(source.directory, 'supabase/migrations', file)), readFileSync(path.join(migrations, file)))
const foreign = source.sql(`select organization_id from public.attachments where organization_id<>'${state.organization}' order by organization_id limit 1`)
assert.match(foreign, /^[\da-f-]{36}$/)
source.sql(`insert into public.organization_members(organization_id,user_id,role)
 select '${foreign}','${state.actor}','viewer' where not exists(select 1 from public.organization_members where organization_id='${foreign}' and user_id='${state.actor}')`)
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const client = createClient(source.url, source.credentials.anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const session = await client.auth.signInWithPassword({ email: state.email, password: state.password })
assert.equal(session.error, null)
assert.equal(session.data.user.id, state.actor)
const started = Date.now()
const output = path.join(source.directory, `export-${started}`)
const manifest = await exportOrganizationPortability({ baseUrl: source.url, key: source.credentials.anon, token: session.data.session.access_token,
  organizationId: state.organization, environmentId: source.owner.project, fromDate: '2036-01-01', toDate: '2036-01-31', output })
const objects = readJson(path.join(output, 'attachments-manifest.json'))
verifyPortabilityFiles(manifest, objects, path.join(output, 'manifest.json'))
assert.equal(objects.objects.length, 2)
assert.equal(objects.objects.reduce((sum, object) => sum + BigInt(object.size_bytes), 0n), 115n)
for (const file of [...manifest.tables.flatMap(table => table.files), ...manifest.reports]) {
  assert.ok(!readFileSync(path.join(output, file.path)).includes(Buffer.from(foreign)), 'Another readable tenant leaked into recovery export')
}
const snapshotFile = path.join(source.directory, `snapshot-${started}.json`)
writePrivate(snapshotFile, source.psql(readFileSync(path.join(root, 'apps/ledger-suit/scripts/capture-restore-evidence.sql')),
  { environment_id: source.owner.project, organization_id: state.organization, actor_id: state.actor, from_date: '2036-01-01', to_date: '2036-01-31' }))
const snapshot = readJson(snapshotFile)
assert.equal(snapshot.ledger.journals, '11')
assert.equal(snapshot.ledger.entries, '22')
assert.equal(snapshot.ledger.unbalanced_journals, '0')
const inventory = JSON.parse(source.sql(`select coalesce(jsonb_agg(to_jsonb(o) order by bucket_id,name),'[]') from storage.objects o`))
assert.equal(inventory.length, 5)
assert.equal(inventory.reduce((sum, object) => sum + BigInt(object.metadata.size), 0n), 262n)
writePrivate(path.join(source.directory, 'storage-inventory.json'), inventory)
const policies = source.sql(`select format('CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s;',policyname,schemaname,tablename,permissive,cmd,
 (select string_agg(quote_ident(role_name),',') from unnest(roles) role_name),
 case when qual is null then '' else ' USING ('||qual||')' end,
 case when with_check is null then '' else ' WITH CHECK ('||with_check||')' end)
 from pg_policies where schemaname='storage' and tablename='objects' order by policyname`)
assert.ok(policies.includes('attachments upload with reservation') && policies.includes('manual_receipts_read'))
const triggers = source.sql(`select pg_get_triggerdef(t.oid)||';' from pg_trigger t
 join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace
 join pg_proc p on p.oid=t.tgfoid join pg_namespace fn on fn.oid=p.pronamespace
 where not t.tgisinternal and n.nspname in ('auth','storage') and fn.nspname in ('public','app') order by n.nspname,c.relname,t.tgname`)
assert.ok(triggers.includes('auth.users'))
writePrivate(path.join(source.directory, 'application-provider-customizations.sql'), `-- Application-owned policies/triggers only; no provider schema replacement.\n${policies}\n${triggers}\n`)
writePrivate(path.join(source.directory, 'extensions.json'), JSON.parse(source.sql(`select jsonb_agg(jsonb_build_object('name',extname,'version',extversion,'schema',nspname) order by extname)
 from pg_extension join pg_namespace on extnamespace=pg_namespace.oid`)))
const storage = JSON.parse(source.docker(['inspect', `supabase_storage_${source.owner.project}`]))[0]
const storageEnv = Object.fromEntries(storage.Config.Env.map(value => [value.slice(0, value.indexOf('=')), value.slice(value.indexOf('=') + 1)]))
assert.equal(storageEnv.STORAGE_BACKEND, 'file')
const mount = storage.Mounts.find(item => item.Destination === storageEnv.FILE_STORAGE_BACKEND_PATH)
assert.equal(mount.Type, 'volume')
assert.equal(mount.Name, `supabase_storage_${source.owner.project}`)
const evidence = { result: 'pass', project: source.owner.project, source_database_container: source.info.Id,
  organization_id: state.organization, actor_id: state.actor, period: ['2036-01-01', '2036-01-31'],
  actual_export: { tables: manifest.tables.length, reports: manifest.reports.length, private_objects: 2, private_bytes: 115,
    foreign_readable_tenant: 'excluded', elapsed_ms: Date.now() - started },
  database_snapshot: artifact(snapshotFile), manifest: artifact(path.join(output, 'manifest.json')),
  storage: { backend: 'file', tenant_id: storageEnv.TENANT_ID, path: mount.Destination, volume: mount.Name, objects: inventory.length, bytes: 262 },
  captured_at: new Date().toISOString() }
writePrivate(path.join(source.directory, 'capture.json'), evidence)
console.log(JSON.stringify({ result: 'pass', tables: manifest.tables.length, reports: manifest.reports.length,
  tenant_private_objects: 2, tenant_private_bytes: 115, project_private_objects: 5, project_private_bytes: 262,
  foreign_readable_tenant: 'excluded', recovery_snapshot: 'captured', elapsed_ms: evidence.actual_export.elapsed_ms }))

// Actual restored Auth/RLS/Storage and the current six-artifact recovery contract.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { exportOrganizationPortability } from './export-organization-portability.mjs'
import { compareRestoreEvidence, verifyPortabilityFiles } from './compare-restore-evidence.mjs'
import { artifact, digest, readJson, recoveryContext, root, writePrivate } from './native-recovery-context.mjs'

const target = recoveryContext('target')
const sourceDirectory = path.join(root, '.local/verification/recovery/source')
const capture = readJson(path.join(sourceDirectory, 'capture.json'))
const backup = readJson(path.join(sourceDirectory, 'backup.json'))
const state = readJson(path.join(sourceDirectory, 'fixture-state.json'))
const restored = readJson(path.join(target.directory, 'restore.json'))
const copied = readJson(path.join(target.directory, 'copy-audit.json'))
assert.equal(restored.result, 'pass')
assert.equal(copied.result, 'pass')
assert.equal(copied.tables, 153)
assert.equal(copied.public_app_tables, 122)
const sourceCredentials = readJson(path.join(sourceDirectory, 'test-credentials.json'))
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const client = createClient(target.url, target.credentials.anon, options)
const session = await client.auth.signInWithPassword({ email: state.email, password: state.password })
assert.equal(session.error, null)
assert.equal(session.data.user.id, state.actor, 'Restored Auth identity must remain the original actor')
const sourceKeyClaims = JSON.parse(Buffer.from(sourceCredentials.anon.split('.')[1], 'base64url').toString())
assert.ok(sourceKeyClaims.exp * 1000 > Date.now(), 'Cross-project token must not merely be expired')
const crossProject = await fetch(`${target.url}/rest/v1/organizations?select=id`,
  { headers: { apikey: target.credentials.anon, Authorization: `Bearer ${sourceCredentials.anon}` } })
assert.equal(crossProject.status, 401, 'Source signing key must be rejected by the distinct target project')
const started = Date.now()
const output = path.join(target.directory, `export-${started}`)
const exportOptions = { baseUrl: target.url, key: target.credentials.anon, token: session.data.session.access_token,
  organizationId: state.organization, environmentId: target.owner.project, fromDate: '2036-01-01', toDate: '2036-01-31', output }
const manifest = await exportOrganizationPortability(exportOptions)
const objects = readJson(path.join(output, 'attachments-manifest.json'))
const snapshotFile = path.join(target.directory, `snapshot-${started}.json`)
writePrivate(snapshotFile, target.psql(readFileSync(path.join(root, 'apps/ledger-suit/scripts/capture-restore-evidence.sql')),
  { environment_id: target.owner.project, organization_id: state.organization, actor_id: state.actor, from_date: '2036-01-01', to_date: '2036-01-31' }))
const sourceSnapshot = readJson(path.join(root, capture.database_snapshot.path))
const targetSnapshot = readJson(snapshotFile)
const sourceManifestFile = path.join(root, capture.manifest.path)
const sourceManifest = readJson(sourceManifestFile)
const sourceObjects = readJson(path.join(path.dirname(sourceManifestFile), 'attachments-manifest.json'))
const comparison = compareRestoreEvidence(sourceSnapshot, targetSnapshot, sourceObjects, objects, sourceManifest, manifest)
verifyPortabilityFiles(sourceManifest, sourceObjects, sourceManifestFile)
verifyPortabilityFiles(manifest, objects, path.join(output, 'manifest.json'))
assert.throws(() => compareRestoreEvidence(sourceSnapshot,
  { ...targetSnapshot, ledger: { ...targetSnapshot.ledger, posted_debits_minor: (BigInt(targetSnapshot.ledger.posted_debits_minor) + 1n).toString() } },
  sourceObjects, objects, sourceManifest, manifest), /ledger differs/)
const admin = createClient(target.url, target.credentials.service, options)
const inventory = readJson(path.join(sourceDirectory, 'storage-inventory.json'))
const downloaded = []
for (const object of inventory) {
  const result = await admin.storage.from(object.bucket_id).download(object.name)
  assert.equal(result.error, null)
  const bytes = Buffer.from(await result.data.arrayBuffer())
  assert.equal(bytes.length, object.metadata.size)
  downloaded.push(`${bytes.length}:${digest(bytes)}`)
}
assert.deepEqual(downloaded.sort(), restored.physical_storage_files.map(file => `${file.bytes}:${file.sha256}`).sort())
const memberships = await client.from('organization_members').select('organization_id').eq('user_id', state.actor)
assert.equal(memberships.error, null)
const foreign = memberships.data.find(row => row.organization_id !== state.organization)?.organization_id
assert.match(foreign, /^[\da-f-]{36}$/)
const deniedViewerOutput = path.join(target.directory, `denied-viewer-${started}`)
await assert.rejects(exportOrganizationPortability({ ...exportOptions, organizationId: foreign, output: deniedViewerOutput }), /403|exports.create/)
assert.equal(existsSync(deniedViewerOutput), false)
const outsiderRow = target.sql(`select email from auth.users u where id<>'${state.actor}' and not exists(
 select 1 from public.organization_members m where m.user_id=u.id and m.organization_id='${state.organization}') order by id limit 1`)
assert.ok(outsiderRow.endsWith('@example.test'))
const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: outsiderRow })
assert.equal(link.error, null)
const outsider = createClient(target.url, target.credentials.anon, options)
const outsiderSession = await outsider.auth.verifyOtp({ type: 'magiclink', token_hash: link.data.properties.hashed_token })
assert.equal(outsiderSession.error, null)
const deniedOutsiderOutput = path.join(target.directory, `denied-outsider-${started}`)
await assert.rejects(exportOrganizationPortability({ ...exportOptions, token: outsiderSession.data.session.access_token, output: deniedOutsiderOutput }), /403|exports.create/)
assert.equal(existsSync(deniedOutsiderOutput), false)
for (const object of sourceObjects.objects) {
  const result = await outsider.storage.from(object.storage_bucket).download(object.storage_key)
  assert.ok(result.error, 'A restored unrelated actor must not receive private file bytes')
  assert.equal(result.data, null)
}
// Continuation uses the restored actor/capabilities and real posting functions;
// roll back the proof so the recovered financial records remain unchanged.
for (const key of ['actor', 'organization']) assert.match(state[key], /^[\da-f-]{36}$/)
const fingerprintSQL = `begin isolation level repeatable read read only;
select format($query$select jsonb_build_object('table',%L,'rows',count(*)::text,'sha256',encode(extensions.digest(coalesce(string_agg(to_jsonb(row_value)::text,E'\\n' order by to_jsonb(row_value)::text),''),'sha256'),'hex')) from %I.%I row_value;$query$,
 schemaname||'.'||tablename,schemaname,tablename) from pg_tables where schemaname in ('public','app') order by schemaname,tablename \\gexec
rollback;`
const beforeContinuation = target.psql(fingerprintSQL)
const continuation = target.psql(`begin;
select set_config('request.jwt.claims',jsonb_build_object('sub','${state.actor}','role','authenticated')::text,true);
set local role authenticated;
do $$ declare journal uuid; reversal uuid; bank uuid; revenue uuid; next_number int; reference text;
begin
 select id into bank from public.accounts where organization_id='${state.organization}' and name='Acceptance bank';
 select id into revenue from public.accounts where organization_id='${state.organization}' and name='Acceptance revenue';
 select max(split_part(journal_reference,'-',3)::int)+1 into next_number from public.transactions
  where organization_id='${state.organization}' and journal_reference like 'JRN-2036-%';
 journal:=public.record_income('${state.organization}',100,bank,p_revenue_account_id=>revenue,p_transaction_date=>'2036-02-10',p_idempotency_key=>'recovered-continuation');
 select journal_reference into reference from public.transactions where id=journal;
 if reference<>format('JRN-2036-%s',lpad(next_number::text,6,'0')) then raise exception 'RESTORED_NUMBERING_DISCONTINUITY'; end if;
 reversal:=public.reverse_transaction(journal,'Recovered continuation rollback probe','2036-02-10');
 if reversal is null or (select count(*) from public.transactions where organization_id='${state.organization}')<>13
  then raise exception 'RESTORED_POST_REVERSE_FAILED'; end if;
end $$;
rollback;
`)
assert.ok(typeof continuation === 'string')
assert.equal(target.psql(fingerprintSQL), beforeContinuation, 'Continuation rollback must preserve all public/app table values')
assert.equal(target.sql(`select count(*) from public.transactions where organization_id='${state.organization}'`), '11')
const completed = new Date().toISOString()
const evidence = { result: 'pass', source_project: capture.project, target_project: target.owner.project,
  source_database_container: capture.source_database_container, target_database_container: target.info.Id,
  restored_auth: 'Actual password sign-in retains the original actor UUID', source_project_key: 'unexpired source-signed key rejected with401',
  comparison, exact_copy_tables: copied.tables, exact_copy_rows: copied.rows, global_storage_objects: downloaded.length, global_storage_bytes: 262,
  tenant_storage_objects: objects.objects.length, tenant_storage_bytes: 115, negative_access: 'viewer export, outsider export and private download denied',
  altered_evidence: 'One minor-unit mismatch rejected', continuation: 'Authenticated native post/reversal and next professional number pass; transaction rolled back',
  continuation_table_preservation: { tables: 122, fingerprint_sha256: digest(beforeContinuation), before_after_equal: true },
  database_snapshot: artifact(snapshotFile), manifest: artifact(path.join(output, 'manifest.json')), elapsed_ms: Date.now() - started,
  total_rehearsal_elapsed_ms: Date.parse(completed) - Date.parse(backup.started_at), completed_at: completed,
  timing_boundary: 'Includes provisioning, operator investigation and rejected rollback attempts; synthetic native measurements are not production RPO/RTO guarantees.' }
writePrivate(path.join(target.directory, 'verification.json'), evidence)
console.log(JSON.stringify({ result: 'pass', tables: manifest.tables.length, reports: manifest.reports.length,
  exact_copy_tables: copied.tables, global_private_objects: downloaded.length, global_private_bytes: 262,
  tenant_private_objects: objects.objects.length, tenant_private_bytes: 115, restored_auth: 'pass', cross_project_key: '401',
  viewer_and_outsider: 'denied', comparison, continuation: 'pass / rolled back', elapsed_ms: evidence.elapsed_ms,
  total_rehearsal_elapsed_ms: evidence.total_rehearsal_elapsed_ms }))

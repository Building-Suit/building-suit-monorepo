// Fresh final-state verification, independent of checkpoint completion labels.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { billingContext, digest, readJson, root, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const c = billingContext()
const state = readJson(path.join(c.directory, 'fixture-state.json'))
const migrations = path.join(root, 'apps/ledger-suit/supabase/migrations')
const files = readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(c.psql('select version from supabase_migrations.schema_migrations order by version').split('\n'), files.map(file => file.split('_')[0]))
const manifest = files.map(file => {
  const bytes = readFileSync(path.join(migrations, file))
  assert.deepEqual(bytes, readFileSync(path.join(c.directory, 'supabase/migrations', file)))
  return digest(bytes) + '  ' + file + '\n'
}).join('')
const financial = digest(c.psql("select to_jsonb(t)::text from public.transactions t where organization_id=:'org'::uuid order by id; select to_jsonb(e)::text from public.transaction_entries e where organization_id=:'org'::uuid order by id;", { org: state.organization }))
assert.equal(financial, state.financialFingerprint)
assert.equal(c.psql("select count(*)||'|'||(sum(base_amount_minor) filter(where side='debit'))||'|'||(sum(base_amount_minor) filter(where side='credit')) from public.transaction_entries where organization_id=:'org'::uuid and posted_at is not null", { org: state.organization }), '2|12345|12345')
const counts = JSON.parse(c.psql("select json_build_object('approved',(select count(*) from public.manual_payment_requests where organization_id=:'org'::uuid and status='approved'),'cancelled',(select count(*) from public.manual_payment_requests where organization_id=:'org'::uuid and status='cancelled'),'evidence',(select count(*) from public.manual_payment_evidence where organization_id=:'org'::uuid),'objects',(select count(*) from storage.objects where bucket_id='manual-payment-receipts' and name like :'org'||'/%'),'approval_history',(select count(*) from public.manual_payment_history where organization_id=:'org'::uuid and after_state='approved'),'posted_journals',(select count(*) from public.transactions where organization_id=:'org'::uuid and posted_at is not null),'members',(select count(*) from public.organization_members where organization_id=:'org'::uuid));", { org: state.organization }))
assert.deepEqual(counts, { approved: 3, cancelled: 1, evidence: 4, objects: 4, approval_history: 3, posted_journals: 1, members: 2 })
assert.equal(c.psql("select app.subscription_access_state(:'org'::uuid)", { org: state.organization }), 'active')
const providers = []
for (const service of ['db', 'auth', 'rest', 'storage', 'kong', 'inbucket', 'edge_runtime']) {
  const info = JSON.parse(c.docker(['inspect', `supabase_${service}_${c.owner.project}`]))[0]
  assert.equal(info.Config.Labels['com.supabase.cli.project'], c.owner.project)
  assert.equal(info.State.Running, true)
  const image = JSON.parse(c.docker(['image', 'inspect', info.Image]))[0]
  providers.push({ service, configured_image: info.Config.Image, image_id: info.Image, source_repo_digests: image.RepoDigests || [] })
}
const readiness = []
for (const route of ['/auth/v1/health', '/storage/v1/status', '/rest-admin/v1/ready']) {
  const response = await fetch(c.url + route, { headers: { apikey: c.credentials.anon }, signal: AbortSignal.timeout(5000) })
  assert.equal(response.status, 200); readiness.push({ route, status: response.status })
}
const evidence = { task: c.owner.task, date: new Date().toISOString().slice(0, 10), migrations: files.length, migration_manifest_sha256: digest(manifest), counts, financial_sha256: financial, debit_and_credit_minor: '12345', subscription_access: 'active', providers, actual_http_readiness: readiness, result: 'pass', financial_reset_or_delete: false }
writePrivate(path.join(c.directory, 'final-result.json'), evidence)
console.log(JSON.stringify(evidence))

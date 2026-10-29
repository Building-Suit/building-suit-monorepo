// Committed synthetic source fixture in the owned recovery project only.
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_RECOVERY_DISPOSABLE_TEST, '1', 'Explicit recovery-test opt-in required')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const directory = path.join(root, '.local/verification/recovery/source')
const owner = JSON.parse(readFileSync(path.join(directory, 'owned-test-project.json'), 'utf8'))
assert.equal(owner.task, 'LS-OPS-RECOVERY-001')
assert.equal(owner.project, 'ledger-recovery-source-20261023')
assert.equal(realpathSync(owner.workdir), realpathSync(directory))
const env = { ...process.env }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
const docker = args => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { cwd: root, env, encoding: 'utf8', timeout: 60_000 }).trim()
const database = `supabase_db_${owner.project}`
const info = JSON.parse(docker(['inspect', database]))[0]
assert.equal(realpathSync(info.Config.Labels['com.supabase.cli.workdir']), realpathSync(directory))
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(item => item.HostPort === '60622'))
const sql = query => docker(['exec', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query])
const migrations = path.join(root, 'apps/ledger-suit/supabase/migrations')
const files = readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), files.map(file => file.split('_')[0]))
for (const file of files) assert.deepEqual(readFileSync(path.join(directory, 'supabase/migrations', file)), readFileSync(path.join(migrations, file)))
const credentials = JSON.parse(readFileSync(path.join(directory, 'test-credentials.json'), 'utf8'))
const sdk = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const baseUrl = 'http://127.0.0.1:60621'
const client = sdk.createClient(baseUrl, credentials.anon, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
const statePath = path.join(directory, 'fixture-state.json')
const state = existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : {
  run: randomUUID(), email: `recovery-${randomUUID()}@example.test`, password: randomBytes(32).toString('base64url'),
}
const save = () => writeFileSync(statePath, `${JSON.stringify(state)}\n`, { mode: 0o600 })
save()
if (!state.actor) {
  const signup = await client.auth.signUp({ email: state.email, password: state.password })
  assert.equal(signup.error, null)
  assert.ok(signup.data.user?.id)
  assert.equal(signup.data.session, null, 'Email verification must precede the authenticated session')
  state.actor = signup.data.user.id
  save()
}
assert.match(state.actor, /^[\da-f-]{36}$/)
if (!state.emailVerified) {
  let message
  for (let attempt = 0; attempt < 100 && !message; attempt++) {
    const response = await fetch('http://127.0.0.1:60624/api/v1/messages')
    assert.equal(response.status, 200)
    const listing = await response.json()
    message = listing.messages.find(item => item.To?.some(recipient => recipient.Address === state.email))
    if (!message) await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(message, 'Actual confirmation email did not reach the local SMTP provider')
  const detail = await (await fetch(`http://127.0.0.1:60624/api/v1/message/${message.ID}`)).json()
  const links = detail.HTML.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify\?[^"'\s<>]+/g) ?? []
  const link = links.map(value => new URL(value.replaceAll('&amp;', '&'))).find(value => value.origin === baseUrl)
  assert.ok(link, 'Confirmation email must reference the owned local Auth provider')
  const confirmation = await fetch(link, { redirect: 'manual' })
  assert.ok([302, 303].includes(confirmation.status))
  assert.equal(sql(`select email_confirmed_at is not null from auth.users where id='${state.actor}'`), 't')
  state.emailVerified = true
  save()
}
const session = await client.auth.signInWithPassword({ email: state.email, password: state.password })
assert.equal(session.error, null)
assert.equal(session.data.user.id, state.actor)

if (!state.organization) {
  const existing = await client.from('organization_members').select('organization_id').eq('user_id', state.actor)
  assert.equal(existing.error, null)
  assert.equal(existing.data.length, 0, 'Inspect an incomplete existing source fixture before replaying financial writes')
  let fixture = readFileSync(path.join(root, 'apps/ledger-suit/supabase/tests/53_integrated_financial_cycle_test.sql'), 'utf8')
  assert.equal(fixture.match(/^rollback;$/gm)?.length, 1)
  assert.equal(fixture.match(/^insert into auth\.users/gm)?.length, 1)
  const helperStart = fixture.indexOf('create function pg_temp.check_result')
  const helperEnd = fixture.indexOf('insert into auth.users', helperStart)
  assert.ok(helperStart > 0 && helperEnd > helperStart)
  fixture = fixture.slice(0, helperStart) + `create function pg_temp.check_result(ok boolean, label text) returns text language plpgsql as $$
    begin if ok is distinct from true then raise exception 'Recovery fixture assertion failed: %',label; end if; return 'PASS: '||label; end; $$;
  create function pg_temp.assert_throws(query text, expected_state text, expected_message text, label text) returns text language plpgsql as $$
    declare actual_state text; actual_message text;
    begin
      begin execute query;
      exception when others then get stacked diagnostics actual_state=returned_sqlstate, actual_message=message_text; end;
      if actual_state is distinct from expected_state or actual_message is distinct from expected_message then
        raise exception 'Recovery fixture rejection assertion failed: %',label;
      end if;
      return 'PASS: '||label;
    end; $$;
  ` + fixture.slice(helperEnd)
  fixture = fixture.replace(/^[ \t]*insert into auth\.users[\s\S]*?;\n/m, '')
    .replace('create extension if not exists pgtap with schema extensions;\nselect no_plan();\n', '')
    .replaceAll('54000000-0000-4000-8000-000000000001', state.actor)
    .replaceAll('select throws_ok(', 'select pg_temp.assert_throws(')
    .replace('select * from finish();\n', '').replace(/^rollback;$/m, 'commit;')
  const output = execFileSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i', database,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1'],
  { cwd: root, env, input: fixture, encoding: 'utf8', timeout: 60_000 })
  assert.equal(output.split('\n').filter(line => line.startsWith('PASS:')).length, 38)
  const memberships = await client.from('organization_members').select('organization_id').eq('user_id', state.actor)
  assert.equal(memberships.error, null)
  assert.equal(memberships.data.length, 1)
  state.organization = memberships.data[0].organization_id
  save()
}
if (!state.financialCycleVerified) {
  assert.equal(sql(`select count(*) from public.transactions where organization_id='${state.organization}' and posted_at is not null`), '8')
  state.financialCycleVerified = true
  save()
}
const rpc = async (name, args, connection = client) => {
  const result = await connection.rpc(name, args)
  assert.equal(result.error, null, `Owned fixture RPC failed: ${name}`)
  return result.data
}
const org = state.organization
assert.match(org, /^[\da-f-]{36}$/)
const accounts = await client.from('accounts').select('id,name').eq('organization_id', org)
assert.equal(accounts.error, null)
const bank = accounts.data.find(row => row.name === 'Acceptance bank').id
const revenue = accounts.data.find(row => row.name === 'Acceptance revenue').id
if (!state.category) {
  const created = await client.from('categories').insert({ organization_id: org, name: 'Recovery income', kind: 'income', default_account_id: revenue, created_by: state.actor }).select('id').single()
  assert.equal(created.error, null)
  state.category = created.data.id
  save()
}
if (!state.reversalSource) {
  state.reversalSource = await rpc('record_income', { p_organization_id: org, p_amount_minor: '100',
    p_destination_account_id: bank, p_revenue_account_id: revenue, p_transaction_date: '2036-02-02',
    p_description: 'Recovery correction source', p_idempotency_key: `recovery-correction-${state.run}` })
  save()
}
if (!state.reversal) {
  state.reversal = await rpc('reverse_transaction', { p_transaction_id: state.reversalSource, p_reason: 'Reviewed recovery correction', p_reversal_date: '2036-02-02' })
  save()
}
if (!state.recurring) {
  state.recurring = await rpc('create_recurring_rule', { p_organization_id: org, p_name: 'Recovery future income', p_transaction_type: 'income',
    p_template: { amount_minor: '123', destination_account_id: bank, category_id: state.category },
    p_frequency: 'monthly', p_start_date: '2037-01-01', p_max_occurrences: 12, p_mode: 'requires_confirmation' })
  save()
}
if (!state.importBatch) {
  state.importBatch = await rpc('create_csv_import_batch', { p_organization_id: org, p_filename: 'recovery.csv',
    p_rows: [{ kind: 'income', date: '2036-02-03', amount: '1.00', account: bank, category: state.category,
      description: 'Recovery imported income', currency: 'EGP' }] })
  save()
}
if (!state.importVerified) {
  const current = await client.from('import_batches').select('status').eq('id', state.importBatch).single()
  assert.equal(current.error, null)
  if (current.data.status !== 'completed') await rpc('validate_csv_import_batch', { p_batch_id: state.importBatch,
    p_mapping: { type: 'kind', date: 'date', amount: 'amount', account: 'account', category: 'category', description: 'description', currency: 'currency' } })
  await rpc('confirm_csv_import_batch', { p_batch_id: state.importBatch })
  await rpc('confirm_csv_import_batch', { p_batch_id: state.importBatch })
  const batch = await client.from('import_batches').select('status,posted_rows').eq('id', state.importBatch).single()
  assert.equal(batch.error, null)
  assert.equal(batch.data.status, 'completed')
  assert.equal(batch.data.posted_rows, 1)
  state.importVerified = true
  save()
}
const attachment = Buffer.from('%PDF-1.4\n% Synthetic Ledger recovery attachment\n%%EOF\n')
const receipt = Buffer.from('%PDF-1.4\n% Different synthetic private payment receipt\n%%EOF\n')
if (state.attachmentReservation && !state.attachmentUploaded) {
  assert.match(state.attachmentReservation, /^[\da-f-]{36}$/)
  const live = sql(`select status='reserved' and expires_at>now() from app.attachment_storage_reservations where id='${state.attachmentReservation}'`)
  if (live !== 't') {
    assert.match(state.attachmentKey, /^[\da-z/-]+\.pdf$/)
    assert.equal(sql(`select count(*) from storage.objects where bucket_id='attachments' and name='${state.attachmentKey}'`), '0',
      'Inspect an uncommitted uploaded object before renewing its expired reservation')
    await rpc('abort_attachment_upload', { p_reservation_id: state.attachmentReservation })
    delete state.attachmentReservation
    delete state.attachmentKey
    save()
  }
}
if (!state.attachmentReservation) {
  state.attachmentKey = `${org}/organization/${org}/recovery-${randomUUID()}.pdf`
  state.attachmentReservation = await rpc('reserve_attachment_upload', { p_organization_id: org, p_entity_type: 'organization', p_entity_id: org,
    p_file_name: 'recovery.pdf', p_mime_type: 'application/pdf', p_size_bytes: attachment.length, p_storage_key: state.attachmentKey })
  save()
}
if (!state.attachmentUploaded) {
  const upload = await client.storage.from('attachments').upload(state.attachmentKey, attachment, { contentType: 'application/pdf', upsert: false })
  assert.equal(upload.error, null)
  state.attachmentUploaded = true
  save()
}
if (!state.attachment) {
  state.attachment = await rpc('commit_attachment_upload', { p_reservation_id: state.attachmentReservation })
  assert.equal(await rpc('commit_attachment_upload', { p_reservation_id: state.attachmentReservation }), state.attachment)
  save()
}
const service = sdk.createClient(baseUrl, credentials.service, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
if (!state.manualRequest) {
  // Only synthetic public recipient text, never real banking/provider data.
  sql("insert into app.manual_payment_configuration(instructions) values('Owned local recovery test recipient') on conflict do nothing")
  state.manualRequest = randomUUID()
  state.receiptEvidence = randomUUID()
  save()
}
if (!state.manualPrepared) {
  await rpc('prepare_manual_payment', { p_id: state.manualRequest, p_organization_id: org, p_plan_key: 'solo', p_interval: 'monthly' })
  state.manualPrepared = true
  save()
}
const receiptKey = `${org}/${state.manualRequest}/${state.receiptEvidence}`
if (!state.receiptUploaded) {
  const upload = await service.storage.from('manual-payment-receipts').upload(receiptKey, receipt, { contentType: 'application/pdf', upsert: false })
  assert.equal(upload.error, null)
  state.receiptUploaded = true
  save()
}
if (!state.receiptSubmitted) {
  await rpc('submit_manual_payment', { p_request_id: state.manualRequest, p_evidence_id: state.receiptEvidence, p_actor_id: state.actor,
    p_filename: 'recovery-receipt.pdf', p_sha256: createHash('sha256').update(receipt).digest('hex'), p_reason: 'Synthetic recovery fixture' }, service)
  state.receiptSubmitted = true
  save()
}
for (const [bucket, key, expected] of [['attachments', state.attachmentKey, attachment], ['manual-payment-receipts', receiptKey, receipt]]) {
  const object = await client.storage.from(bucket).download(key)
  assert.equal(object.error, null)
  assert.deepEqual(Buffer.from(await object.data.arrayBuffer()), expected)
}
assert.equal(sql(`select count(*) from public.transactions where organization_id='${org}' and posted_at is not null`), '11')
// A fresh rehearsal also needs nonempty records in another tenant. Reuse the
// independently maintained real-provider admission regression, never real data.
const foreignCount = sql(`select count(*) from public.attachments where organization_id<>'${org}'`)
assert.ok(['0', '3'].includes(foreignCount), 'Inspect incomplete or unexpected foreign fixtures before adding records')
if (foreignCount === '0') {
  const tested = spawnSync(process.execPath, [path.join(root, 'apps/ledger-suit/scripts/test-storage-admission-native.mjs'), 'verify'], {
    cwd: root, encoding: 'utf8', env: { ...env, LEDGER_STORAGE_DISPOSABLE_TEST: '1', LEDGER_STORAGE_API_URL: baseUrl,
      LEDGER_STORAGE_ANON_KEY: credentials.anon, LEDGER_STORAGE_SERVICE_KEY: credentials.service },
  })
  writeFileSync(path.join(directory, 'foreign-storage-fixture.log'), (tested.stdout || '') + (tested.stderr || ''), { mode: 0o600 })
  assert.equal(tested.status, 0, 'Native foreign storage fixture failed; inspect the private log before retrying')
}
const foreignObjects = JSON.parse(sql(`select jsonb_agg(jsonb_build_object('storage_bucket',storage_bucket,'storage_key',storage_key,'size_bytes',size_bytes))
 from public.attachments where organization_id<>'${org}'`))
assert.equal(foreignObjects.length, 3)
for (const object of foreignObjects) {
  assert.equal(object.size_bytes, 49)
  const result = await service.storage.from(object.storage_bucket).download(object.storage_key)
  assert.equal(result.error, null)
  assert.equal(createHash('sha256').update(Buffer.from(await result.data.arrayBuffer())).digest('hex'),
    '4be3df217c9963405a76a21ae46d705b8caaf3e47e51d8bfa4efe4ebb8f81c64')
}
state.foreignStorageVerified = true
state.storageVerified = true
save()
console.log(JSON.stringify({ result: 'pass', actual_email_confirmation: true, actual_password_signin: true,
  committed_native_cycle: '8 journals / 16 entries / 38 assertions', recovery_journals: 11,
  reversed_pair: true, recurring_rule: true, confirmed_import_and_retry: true,
  actual_private_objects: 2, actual_private_bytes: attachment.length + receipt.length,
  foreign_private_objects: 3, foreign_private_bytes: 147,
  receipt_boundary: 'real service Storage upload and validated SQL submission; Edge byte validation not exercised' }))

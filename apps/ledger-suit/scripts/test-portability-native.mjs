// Committed synthetic fixtures only, in the explicitly disposable local Ledger DB.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash, createHmac, randomBytes, randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync, existsSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { exportOrganizationPortability, tenantTables, excludedTenantTables } from './export-organization-portability.mjs'
import { verifyPortabilityFiles } from './compare-restore-evidence.mjs'

assert.equal(process.env.LEDGER_PORTABILITY_DISPOSABLE_TEST, '1', 'Explicit disposable test opt-in required')
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const env = { ...process.env }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
const run = (file, args) => execFileSync(file, args, { cwd: root, env, encoding: 'utf8', stdio: 'pipe', timeout: 30_000 }).trim()
const docker = (...args) => run('docker', ['--host=unix:///var/run/docker.sock', ...args])
const database = 'supabase_db_building-suit-ledger'
const info = JSON.parse(docker('inspect', database))[0]
const workdir = realpathSync(info.Config.Labels['com.supabase.cli.workdir'])
const worktrees = run('git', ['worktree', 'list', '--porcelain']).split('\n')
  .filter(line => line.startsWith('worktree ')).map(line => realpathSync(line.slice(9)))
assert.ok(worktrees.some(tree => path.join(tree, 'apps/ledger-suit') === workdir), 'DB owner must be a registered Ledger worktree')
assert.match(readFileSync(path.join(workdir, 'supabase/config.toml'), 'utf8'), /^project_id = "building-suit-ledger"$/m)
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(binding => binding.HostPort === '60322'))
const network = 'supabase_network_building-suit-ledger'
assert.ok(Object.hasOwn(info.NetworkSettings.Networks, network))
const sql = query => docker('exec', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query)
const migrations = path.join(root, 'apps/ledger-suit/supabase/migrations')
const files = readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(sql('select version from supabase_migrations.schema_migrations order by version').split('\n'), files.map(file => file.split('_')[0]))
for (const file of files) assert.deepEqual(readFileSync(path.join(workdir, 'supabase/migrations', file)), readFileSync(path.join(migrations, file)))
const tenantRelations = sql(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and exists(select 1 from pg_attribute a
    where a.attrelid=c.oid and a.attname='organization_id' and not a.attisdropped) order by c.relname`).split('\n')
const declared = new Set(tenantTables.map(([table]) => table))
for (const table of tenantRelations) assert.ok(declared.has(table) || Object.hasOwn(excludedTenantTables, table), `Unclassified current tenant table: ${table}`)
for (const table of Object.keys(excludedTenantTables)) assert.ok(tenantRelations.includes(table) && !declared.has(table), `Invalid excluded table: ${table}`)

// Official PostgREST v16.1 amd64 config digest. Pull its pinned index first:
// docker pull postgrest/postgrest@sha256:5922bde07147b82b1c9d8f749e48c1e5b99ebb233f3888bb7ab65f07cf4ac82d
const image = 'sha256:eb4951a2f9ac02288100937995af3cb7fb64c296b1228405de5d77ca4dd3410d'
assert.equal(docker('image', 'inspect', image, '--format', '{{.Id}}'), image)
const id = randomUUID()
const directory = path.join(root, '.local/verification/portability-api', id)
mkdirSync(directory, { recursive: true, mode: 0o700 })
const secret = randomBytes(48).toString('base64url')
const config = path.join(directory, 'postgrest.conf')
writeFileSync(config, [
  `db-uri = "postgres://authenticator:postgres@${database}:5432/postgres"`,
  'db-schemas = "public"', 'db-extra-search-path = "public, extensions"', 'db-anon-role = "anon"',
  `jwt-secret = ${JSON.stringify(secret)}`, 'server-host = "0.0.0.0"', 'server-port = 3000', '',
].join('\n'), { mode: 0o600 })
const container = `ledger-portability-test-${id}`
let started = false
let proxy
const digest = bytes => createHash('sha256').update(bytes).digest('hex')
function token(actor) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const payload = Buffer.from(JSON.stringify({ sub: actor, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url')
  return `${header}.${payload}.${createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`
}
try {
  docker('run', '-d', '--name', container, '--label', 'com.building-suit.task=LS-OPS-PORT-001',
    '--network', network, '--publish', '127.0.0.1::3000', '--mount', `type=bind,src=${config},dst=/etc/postgrest.conf,readonly`,
    image, '/bin/postgrest', '/etc/postgrest.conf')
  started = true
  const apiInfo = JSON.parse(docker('inspect', container))[0]
  const api = `http://127.0.0.1:${apiInfo.NetworkSettings.Ports['3000/tcp'][0].HostPort}`
  let ready = false
  for (let attempt = 0; attempt < 150 && !ready; attempt++) {
    try { ready = (await fetch(api)).ok } catch { /* Wait for the real schema cache. */ }
    if (!ready) await new Promise(resolve => setTimeout(resolve, 200))
  }
  assert.ok(ready, 'PostgREST did not become ready')
  async function rpc(actor, name, body) {
    const response = await fetch(`${api}/rpc/${name}`, { method: 'POST',
      headers: { Authorization: `Bearer ${token(actor)}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    assert.ok(response.ok, `${name}: ${response.status} ${await response.clone().text()}`)
    return response.json()
  }
  const actor = randomUUID(), other = randomUUID(), outsider = randomUUID()
  for (const user of [actor, other, outsider]) sql(`insert into auth.users(id,email,raw_user_meta_data) values('${user}','${user}@portability.test','{}');`)
  const organizationId = await rpc(actor, 'create_organization', { p_name: `Portability ${id}` })
  const otherOrganization = await rpc(other, 'create_organization', { p_name: `Other portability ${id}` })
  // The exporter can read a second tenant as viewer. Its explicit query scopes
  // must still exclude that tenant; RLS alone cannot catch a missing filter here.
  sql(`insert into public.organization_members(organization_id,user_id,role) values('${otherOrganization}','${actor}','viewer');`)
  const account = async (name, type, subtype) => rpc(actor, 'create_account', {
    p_organization_id: organizationId, p_name: name, p_type: type, p_subtype: subtype,
  })
  const debit = await account('Portability bank', 'asset', 'bank')
  const credit = await account('Portability capital', 'equity', 'owner_capital')
  const date = sql('select current_date')
  await rpc(actor, 'create_adjustment', { p_organization_id: organizationId, p_transaction_date: date,
    p_lines: [{ account_id: debit, side: 'debit', amount_minor: '9007199254740993' }, { account_id: credit, side: 'credit', amount_minor: '9007199254740993' }],
    p_description: 'Exact portability fixture', p_reason: 'Owned disposable test', p_idempotency_key: id })
  const privateResponse = await fetch(`${api}/dimension_value_requests`, { headers: { Authorization: `Bearer ${token(actor)}` } })
  assert.equal(privateResponse.status, 403, 'Internal request table must stay private')

  // Route only the normal API prefix. All JWT validation, SQL, RLS, queries,
  // relationships, ranges and CSV RPCs execute in the actual PostgREST server.
  proxy = http.createServer((request, response) => {
    if (!request.url.startsWith('/rest/v1/')) { response.writeHead(404).end(); return }
    const upstream = http.request(api + request.url.slice('/rest/v1'.length), { method: request.method, headers: request.headers }, result => {
      response.writeHead(result.statusCode, result.headers); result.pipe(response)
    })
    upstream.on('error', () => response.writeHead(502).end())
    request.pipe(upstream)
  })
  await new Promise(resolve => proxy.listen(0, '127.0.0.1', resolve))
  const options = { baseUrl: `http://127.0.0.1:${proxy.address().port}`, key: 'local-test-key', token: token(actor), organizationId,
    environmentId: `native-portability-${id}`, fromDate: `${date.slice(0, 4)}-01-01`, toDate: `${date.slice(0, 4)}-12-31`, output: path.join(directory, 'export') }
  const result = await exportOrganizationPortability(options)
  for (const item of [...result.tables.flatMap(table => table.files), ...result.reports]) {
    const bytes = readFileSync(path.join(options.output, item.path))
    assert.equal(digest(bytes), item.sha256, `On-disk digest differs: ${item.path}`)
    assert.ok(!bytes.includes(Buffer.from(otherOrganization)), `Another readable tenant leaked: ${item.path}`)
  }
  assert.equal(digest(readFileSync(path.join(options.output, 'attachments-manifest.json'))), result.attachment_manifest_sha256)
  const objects = JSON.parse(readFileSync(path.join(options.output, 'attachments-manifest.json'), 'utf8'))
  verifyPortabilityFiles(result, objects, path.join(options.output, 'manifest.json'))
  const entryPage = result.tables.find(table => table.table === 'transaction_entries').files[0].path
  assert.ok(readFileSync(path.join(options.output, entryPage), 'utf8').includes('9007199254740993'), 'Large minor units were rounded')
  assert.ok(readFileSync(path.join(options.output, 'reports/trial-balance.csv'), 'utf8').includes('90071992547409.93'), 'CSV amount was rounded')
  const capture = () => execFileSync('docker', ['--host=unix:///var/run/docker.sock', 'exec', '-i', database,
    'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1',
    '-v', `environment_id=${options.environmentId}`, '-v', `organization_id=${organizationId}`,
    '-v', `actor_id=${actor}`, '-v', `from_date=${options.fromDate}`, '-v', `to_date=${options.toDate}`],
  { cwd: root, env, encoding: 'utf8', stdio: 'pipe', timeout: 30_000,
    input: readFileSync(path.join(root, 'apps/ledger-suit/scripts/capture-restore-evidence.sql')) })
  const snapshotText = capture()
  const snapshot = JSON.parse(snapshotText)
  assert.equal(snapshot.schema_version, 'ls-ops-001-v2')
  assert.match(snapshot.migration_history_digest, /^[a-f0-9]{32}$/)
  assert.equal(snapshot.ledger.posted_debits_minor, '9007199254740993')
  assert.equal(snapshot.attachments.metadata_conflicts, '0')
  writeFileSync(path.join(directory, 'snapshot.json'), snapshotText, { mode: 0o600 })
  // A separate metadata-only phase checks both SQL sources. No Storage object
  // bytes are fabricated or represented as a provider transfer/restore.
  sql(`insert into app.manual_payment_configuration(instructions) values('Disposable portability test recipient') on conflict do nothing;`)
  const request = randomUUID(), evidence = randomUUID(), object = randomUUID()
  await rpc(actor, 'prepare_manual_payment', { p_id: request, p_organization_id: organizationId, p_plan_key: 'solo', p_interval: 'monthly' })
  sql(`insert into public.attachments(organization_id,entity_type,entity_id,file_name,mime_type,size_bytes,storage_key,uploaded_by)
    values('${organizationId}','organization','${organizationId}','synthetic.pdf','application/pdf',3,'${organizationId}/${request}/${object}','${actor}');
    insert into public.manual_payment_evidence(id,request_id,organization_id,object_id,storage_key,filename,mime_type,size_bytes,sha256,submitted_by)
    values('${evidence}','${request}','${organizationId}','${object}','${organizationId}/${request}/${object}','synthetic.pdf','application/pdf',4,'${digest('test')}','${actor}');`)
  const metadataText = capture()
  const metadata = JSON.parse(metadataText)
  assert.equal(metadata.attachments.count, '2')
  assert.equal(metadata.attachments.metadata_count, '2')
  assert.equal(metadata.attachments.receipt_metadata_count, '1')
  assert.equal(metadata.attachments.bytes, '7')
  assert.equal(metadata.attachments.metadata_conflicts, '0')
  writeFileSync(path.join(directory, 'metadata-snapshot.json'), metadataText, { mode: 0o600 })
  for (const [label, user, org] of [['outsider', outsider, organizationId], ['viewer', actor, otherOrganization]]) {
    const output = path.join(directory, label)
    await assert.rejects(exportOrganizationPortability({ ...options, token: token(user), organizationId: org, output }), /403|exports.create/)
    assert.equal(existsSync(output), false, 'Denied export must not create an output directory')
  }
  console.log(JSON.stringify({ result: 'pass', tables: result.tables.length, reports: result.reports.length,
    actual_postgrest: '16.1', migration_files: files.length, exact_minor_units: true, file_digests: 'match',
    second_readable_tenant: 'excluded', outsider_and_viewer_export: 'denied', internal_request_table: '403',
    tenant_relations_accounted: tenantRelations.length, captured_schema: snapshot.schema_version,
    two_metadata_sources: '2 objects / 7 bytes / 1 receipt verified', storage_bytes: 'not_exercised' }))
} finally {
  if (proxy) await new Promise(resolve => proxy.close(resolve))
  if (started) {
    writeFileSync(path.join(directory, 'postgrest.log'), docker('logs', container), { mode: 0o600 })
    docker('rm', '-f', container)
  }
}
// Committed synthetic organizations, journals and memberships remain in the DB.

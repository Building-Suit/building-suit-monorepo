// Real Auth + Storage HTTP regression, against an explicitly owned local DB.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

assert.equal(process.env.LEDGER_STORAGE_DISPOSABLE_TEST, '1', 'Explicit local write-test opt-in required')
const mode = process.argv[2]
assert.ok(['baseline', 'verify'].includes(mode), 'Choose baseline or verify')
assert.equal(process.argv.length, 3)
const root = realpathSync(fileURLToPath(new URL('../../../', import.meta.url)))
const url = process.env.LEDGER_STORAGE_API_URL || 'http://127.0.0.1:60321'
const projects = { 'http://127.0.0.1:60321': ['building-suit-ledger', '60322'],
  'http://127.0.0.1:60621': ['ledger-recovery-source-20261023', '60622'] }
assert.ok(Object.hasOwn(projects, url), 'Only the two documented local test origins are allowed')
const [project, port] = projects[url]
const env = { ...process.env }
for (const key of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[key]
const docker = args => execFileSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, cwd: root, encoding: 'utf8', timeout: 30_000 }).trim()
const database = `supabase_db_${project}`
const info = JSON.parse(docker(['inspect', database]))[0]
const workdir = realpathSync(info.Config.Labels['com.supabase.cli.workdir'])
const worktrees = dockerCommandGitWorktrees()
if (project === 'building-suit-ledger') {
  assert.ok(worktrees.some(tree => path.join(tree, 'apps/ledger-suit') === workdir))
} else {
  const marker = JSON.parse(readFileSync(path.join(workdir, 'owned-test-project.json'), 'utf8'))
  assert.equal(marker.task, 'LS-OPS-RECOVERY-001')
  assert.equal(marker.project, project)
  assert.equal(realpathSync(marker.workdir), workdir)
  assert.ok(worktrees.some(tree => path.join(tree, '.local/verification/recovery/source') === workdir))
}
assert.ok(info.NetworkSettings.Ports['5432/tcp'].some(item => item.HostPort === port))
const sql = query => docker(['exec', database, 'psql', '-X', '-U', 'postgres', '-d', 'postgres', '-Atq', '-v', 'ON_ERROR_STOP=1', '-c', query])
assert.equal(sql('select max(version) from supabase_migrations.schema_migrations'),
  mode === 'baseline' ? '20261022213133' : '20261023202826')
const anon = process.env.LEDGER_STORAGE_ANON_KEY
const key = process.env.LEDGER_STORAGE_SERVICE_KEY
assert.ok(anon && key, 'Provide the designated local project keys through the environment')
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(url, key, options)
async function actor() {
  const email = `storage-native-${randomUUID()}@example.test`, password = randomBytes(32).toString('base64url')
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  assert.equal(created.error, null)
  const client = createClient(url, anon, options)
  const session = await client.auth.signInWithPassword({ email, password })
  assert.equal(session.error, null)
  return { client, id: session.data.user.id }
}
const owner = await actor()
const rpc = async (name, args, client = owner.client) => {
  const result = await client.rpc(name, args)
  assert.equal(result.error, null, `Native fixture RPC failed: ${name}`)
  return result.data
}
const org = await rpc('create_organization', { p_name: `Native storage ${randomUUID()}` })
assert.match(org, /^[\da-f-]{36}$/)
const bytes = Buffer.from('%PDF-1.4\n% Native exact-reservation upload\n%%EOF\n')
async function reserve() {
  const object = `${org}/organization/${org}/${randomUUID()}.pdf`
  const id = await rpc('reserve_attachment_upload', { p_organization_id: org, p_entity_type: 'organization', p_entity_id: org,
    p_file_name: 'native.pdf', p_mime_type: 'application/pdf', p_size_bytes: bytes.length, p_storage_key: object })
  return { object, id }
}
const upload = (reservation, body, client = owner.client, contentType = 'application/pdf', metadata) =>
  client.storage.from('attachments').upload(reservation.object, body, { contentType, upsert: false, metadata })
const denied = result => assert.equal(String(result.error?.statusCode ?? result.error?.status), '403', 'Actual provider must reject this upload')
if (mode === 'baseline') {
  denied(await upload(await reserve(), bytes))
  console.log(JSON.stringify({ result: 'expected_rejection_reproduced', provider: 'actual Auth/Storage HTTP', valid_reserved_raw_upload: '403' }))
  process.exit(0)
}
const binary = await reserve()
assert.equal((await upload(binary, bytes)).error, null)
const committed = await rpc('commit_attachment_upload', { p_reservation_id: binary.id })
assert.equal(await rpc('commit_attachment_upload', { p_reservation_id: binary.id }), committed)
const file = new File([bytes], 'native.pdf', { type: 'application/pdf' })
const browser = await reserve()
denied(await upload(browser, file)) // Multipart overhead is not the reserved file size.
assert.equal((await upload(browser, await file.arrayBuffer())).error, null)
await rpc('commit_attachment_upload', { p_reservation_id: browser.id })
for (const [body, mime, metadata] of [[Buffer.concat([bytes, Buffer.from('x')]), 'application/pdf', { size: bytes.length, contentLength: bytes.length }],
  [bytes, 'image/png', undefined]]) {
  const reservation = await reserve()
  denied(await upload(reservation, body, owner.client, mime, metadata))
  await rpc('abort_attachment_upload', { p_reservation_id: reservation.id })
}
const viewer = await actor(), outsider = await actor()
assert.match(viewer.id, /^[\da-f-]{36}$/)
sql(`insert into public.organization_members(organization_id,user_id,role) values('${org}','${viewer.id}','viewer')`)
const protectedObject = await reserve()
for (const client of [viewer.client, outsider.client, createClient(url, anon, options)]) denied(await upload(protectedObject, bytes, client))
const viewerReservation = await viewer.client.rpc('reserve_attachment_upload', { p_organization_id: org, p_entity_type: 'organization', p_entity_id: org,
  p_file_name: 'viewer.pdf', p_mime_type: 'application/pdf', p_size_bytes: bytes.length, p_storage_key: protectedObject.object })
assert.equal(viewerReservation.error?.code, '42501')
assert.equal((await upload(protectedObject, bytes)).error, null)
await rpc('commit_attachment_upload', { p_reservation_id: protectedObject.id })
for (const reservation of [binary, browser, protectedObject]) {
  const downloaded = await owner.client.storage.from('attachments').download(reservation.object)
  assert.equal(downloaded.error, null)
  assert.deepEqual(Buffer.from(await downloaded.data.arrayBuffer()), bytes)
}
assert.equal(sql(`select count(*) from storage.objects where bucket_id='attachments' and name like '${org}/%'`), '3')
assert.equal(sql(`select count(*) from public.attachments where organization_id='${org}'`), '3')
assert.equal(BigInt(await rpc('get_usage', { p_organization_id: org, p_quota_key: 'max_storage_bytes' })), BigInt(bytes.length * 3))
console.log(JSON.stringify({ result: 'pass', provider: 'actual Auth/Storage HTTP', raw_binary_and_file_bytes: 'exact', multipart_overhead: 'denied',
  committed_objects: 3, bytes: bytes.length * 3, quota_usage: 'matches actual committed bytes', commit_retry: 'same attachment',
  wrong_size_and_mime: 'denied', forged_user_metadata: 'cannot override actual length', anonymous_viewer_and_outsider_upload: 'denied' }))

function dockerCommandGitWorktrees() {
  return execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8' }).split('\n')
    .filter(line => line.startsWith('worktree ')).map(line => realpathSync(line.slice(9)))
}

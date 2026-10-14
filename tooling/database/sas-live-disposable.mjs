// Real Auth + Realtime validation. No hosted inputs, SDK tokens, or keys persist.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { setTimeout as delay } from 'node:timers/promises'
assert.equal(process.env.SAS_LIVE_DISPOSABLE, '1', 'Explicit disposable validation required')
// Reuse the application integration's locked SDK, including its binary codec.
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const container = 'supabase_db_building-suit-super-admin'
const origin = 'http://127.0.0.1:64321'
function command(program, args, input) {
 const result = spawnSync(program, args, { input, encoding: 'utf8', timeout: 120000 })
 if (result.status !== 0) throw new Error(`${program} failed (exit ${result.status}); inspect isolated logs without printing credentials`)
 return result.stdout.trim()
}
function sql(statement) { return command('docker', ['exec', '-i', container, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], statement) }
const quote = value => `'${String(value).replaceAll("'", "''")}'`
const status = JSON.parse(command('pnpm', ['exec', 'supabase', '--workdir', 'apps/super-admin-suit', 'status', '--output', 'json']))
assert.equal(status.API_URL, origin, 'Only the disposable SAS loopback project is allowed')
assert.match(sql('select version()'), /PostgreSQL 17/)
const apiKey = status.ANON_KEY, serverKey = status.SERVICE_ROLE_KEY
assert.ok(apiKey && serverKey)
async function request(path, token, body) {
 const response = await fetch(`${origin}${path}`, { method: body === undefined ? 'GET' : 'POST',
  headers: { apikey: apiKey, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
 const data = await response.json().catch(() => null)
 return { code: response.status, data }
}
async function user() {
 const email = `${randomUUID()}@sas-live-disposable.invalid`, password = `Test-${randomUUID()}-1!`
 const created = await request('/auth/v1/admin/users', serverKey, { email, password, email_confirm: true })
 assert.equal(created.code, 200)
 const login = await request('/auth/v1/token?grant_type=password', apiKey, { email, password })
 assert.equal(login.code, 200)
 const token = login.data.access_token, claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url'))
 return { id: login.data.user.id, token, session: claims.session_id }
}
async function connect(token, topic) {
 const client = createClient(origin, apiKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
 await client.realtime.setAuth(token)
 const channel = client.channel(topic, { config: { private: true } }), messages = []
 channel.on('broadcast', { event: 'invalidate' }, event => messages.push(event.payload))
 const joined = new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Realtime join timeout')), 10000)
  channel.subscribe(state => {
   if (state === 'SUBSCRIBED') { clearTimeout(timeout); resolve(true) }
   if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') { clearTimeout(timeout); resolve(false) }
  })
 })
 return { channel, joined, messages, async close() { await client.removeChannel(channel); client.realtime.disconnect() } }
}
async function until(check) { for (let n = 0; n < 50; n++) { if (check()) return; await delay(100) }; throw new Error('Expected private invalidation not delivered') }
const peers = []
try {
 const [owner, colleague, foreign, stranger] = await Promise.all([user(), user(), user(), user()])
 const environment = randomUUID(), otherEnvironment = randomUUID(), target = randomUUID(), suit = randomUUID(), binding = randomUUID()
 sql(`insert into public.admin_environments(id,stable_key,environment_kind,display_name,status) values
 (${quote(environment)},'live-test-${environment.slice(0,8)}','local','{}','active'),
 (${quote(otherEnvironment)},'live-test-${otherEnvironment.slice(0,8)}','local','{}','active'),
 (${quote(target)},'live-target-${target.slice(0,8)}','local','{}','active');
 insert into public.platform_admins(user_id,authority_environment_id,provisioned_by) values
 (${quote(owner.id)},${quote(environment)},${quote(owner.id)}),(${quote(colleague.id)},${quote(environment)},${quote(owner.id)}),
 (${quote(foreign.id)},${quote(otherEnvironment)},${quote(foreign.id)});
 insert into public.suit_registry(id,stable_key,display_name,asset_reference,adapter_contract_version,status) values
 (${quote(suit)},'live-suit-${suit.slice(0,8)}','{}','/brand/synthetic.svg','1.0','active');
 insert into public.suit_environment_bindings(id,suit_id,admin_environment_id,target_environment_id,adapter_base_url,audience,target_identity_fingerprint,egress_policy,status)
 values(${quote(binding)},${quote(suit)},${quote(environment)},${quote(target)},'https://adapter.synthetic.invalid','synthetic','synthetic-fingerprint-123','{}','active');`)
 async function topic(person) {
  const result = await request('/rest/v1/rpc/super_admin_live_topic', person.token, {})
  assert.equal(result.code, 200); return result.data
 }
 const ownerTopic = await topic(owner), colleagueTopic = await topic(colleague), foreignTopic = await topic(foreign)
 assert.equal(ownerTopic, `sas:${environment}:${owner.id}:${owner.session}`)
 const a = await connect(owner.token, ownerTopic), b = await connect(owner.token, ownerTopic), c = await connect(colleague.token, colleagueTopic), f = await connect(foreign.token, foreignTopic)
 peers.push(a, b, c, f); assert.deepEqual(await Promise.all(peers.map(peer => peer.joined)), [true, true, true, true])
 for (const [token, wrong] of [[apiKey, ownerTopic], [stranger.token, ownerTopic], [colleague.token, ownerTopic], [owner.token, foreignTopic]]) {
  const denied = await connect(token, wrong); peers.push(denied); assert.equal(await denied.joined, false); await denied.close()
 }
 const sender = await connect(owner.token, ownerTopic); peers.push(sender); assert.equal(await sender.joined, true)
 await sender.channel.send({ type: 'broadcast', event: 'invalidate', payload: { forged: true } })
 await delay(400); assert.equal(b.messages.length, 0); await sender.close()
 assert.equal((await request('/rest/v1/admin_live_invalidations?select=*', owner.token)).code, 403)
 const eventKey = `fixture:${randomUUID()}`
 const enqueue = key => sql(`select super_admin_private.live_enqueue(${quote(key)},${quote(environment)},${quote(binding)},array['activity','billing']);`)
 enqueue(eventKey); await until(() => a.messages.length === 1 && b.messages.length === 1 && c.messages.length === 1)
 assert.equal(f.messages.length, 0)
 assert.deepEqual(Object.keys(a.messages[0]).sort(), ['authorityEnvironmentId', 'id', 'kinds'])
 assert.deepEqual(a.messages[0], b.messages[0]); assert.equal(a.messages[0].authorityEnvironmentId, environment)
 enqueue(eventKey); await delay(400); assert.equal(a.messages.length, 1)
 // A binding from another authority cannot fan out to this environment.
 sql(`select super_admin_private.live_enqueue('foreign-binding:${randomUUID()}',${quote(otherEnvironment)},${quote(binding)},array['activity']);`)
 await delay(400); assert.equal(f.messages.length, 0)
 // The actual source trigger minimizes a sensitive configuration receipt.
 sql(`insert into public.control_plane_events(request_id,correlation_id,actor_user_id,actor_role,authority_environment_id,suit_id,target_environment_id,action,target_type,target_id,reason,safe_parameters,result,request_fingerprint)
 values(gen_random_uuid(),gen_random_uuid(),${quote(owner.id)},'owner',${quote(environment)},${quote(suit)},${quote(target)},'synthetic.update','synthetic',gen_random_uuid(),'synthetic source fixture','{"neverBroadcast":"secret-marker"}','{}','synthetic');`)
 await until(() => a.messages.length === 2); assert.ok(!JSON.stringify(a.messages).includes('secret-marker'))
 // Existing cached socket gets only a revocation hint; new joins/HTTP reject.
 sql(`update public.platform_admins set enabled=false,disabled_at=clock_timestamp() where user_id=${quote(colleague.id)};`)
 await until(() => c.messages.length === 3)
 const revoked = await connect(colleague.token, colleagueTopic); peers.push(revoked); assert.equal(await revoked.joined, false)
 assert.equal((await request('/rest/v1/rpc/super_admin_live_topic', colleague.token, {})).code, 403)
 enqueue(`after-revoke:${randomUUID()}`); await until(() => a.messages.length === 3); await delay(400); assert.equal(c.messages.length, 3)
 // Supported Auth logout removes the session; still-valid JWT no longer receives.
 const logout = await fetch(`${origin}/auth/v1/logout?scope=global`, { method: 'POST', headers: { apikey: apiKey, authorization: `Bearer ${owner.token}` } })
 assert.equal(logout.status, 204)
 assert.equal((await request('/rest/v1/rpc/super_admin_live_topic', owner.token, {})).code, 403)
 enqueue(`after-logout:${randomUUID()}`); await delay(400); assert.equal(a.messages.length, 3); assert.equal(b.messages.length, 3)
 // Server-only recovery is bounded and idempotent; never grants browser sends.
 assert.equal((await request('/rest/v1/rpc/super_admin_live_flush', foreign.token, { p_limit: 1 })).code, 403)
 assert.equal((await request('/rest/v1/rpc/super_admin_live_flush', serverKey, { p_limit: 101 })).code, 400)
 const queued = randomUUID()
 sql(`insert into public.admin_live_invalidations(id,source_key,authority_environment_id,kinds) values(${quote(queued)},'pending:${queued}',${quote(otherEnvironment)},array['activity']);`)
 assert.equal((await request('/rest/v1/rpc/super_admin_live_flush', serverKey, { p_limit: 100 })).data, 1)
 await until(() => f.messages.length === 1); assert.equal(f.messages[0].id, queued)
 assert.equal((await request('/rest/v1/rpc/super_admin_live_flush', serverKey, { p_limit: 100 })).data, 0)
 const provider = randomUUID(), reference = randomUUID()
 sql(`insert into public.integration_providers(id,stable_key,display_name,provider_kind,configuration_schema_version) values(${quote(provider)},'fixture-${provider.slice(0,8)}','{}','adapter','1.0');
 insert into public.integration_secret_references(id,provider_id,binding_id,purpose,key_id,key_version,vault_secret_id,valid_from)
 values(${quote(reference)},${quote(provider)},${quote(binding)},'adapter-signing','disposable-no-key',1,gen_random_uuid(),clock_timestamp());`)
 function receipt(operation) {
  const dispatch = randomUUID(), attempt = randomUUID()
  sql(`insert into public.adapter_dispatches(id,request_id,correlation_id,binding_id,actor_user_id,envelope,body,body_digest,config_versions,audience)
   values(${quote(dispatch)},gen_random_uuid(),gen_random_uuid(),${quote(binding)},${quote(owner.id)},${quote(JSON.stringify({ operation }))}::jsonb,'{}',repeat('a',64),'{}','synthetic');
   insert into public.adapter_attempts(id,dispatch_id,secret_reference_id,key_id,configuration_versions,request_timestamp,expires_at)
   values(${quote(attempt)},${quote(dispatch)},${quote(reference)},'disposable-no-key','{}',extract(epoch from now())::bigint,now()+interval '5 minutes');
   insert into public.adapter_attempt_results(attempt_id,outcome) values(${quote(attempt)},'success');`)
  return sql(`select count(*) from public.admin_live_invalidations where source_key=${quote(`adapter_attempt_results:${attempt}`)};`)
 }
 assert.equal(receipt('shop.billing.query'), '0', 'Queries must not cause feedback invalidations')
 assert.equal(receipt('shop.billing.command'), '1', 'Trusted command receipt must invalidate its bound authority')
 console.log('PASS real Auth/private Realtime: two tabs, operator/environment/session denial, minimized events, dedup, binding isolation, revocation/logout, bounded replay')
} finally { await Promise.all(peers.map(peer => peer.close())) }

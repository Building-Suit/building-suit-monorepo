import assert from 'node:assert/strict'
import test from 'node:test'
import { authorizeAdmin, AdminAccessError } from '../../server/utils/authorize.ts'

const user = { id: 'provisioned-user', user_metadata: { role: 'owner' } }
const session = { userId: user.id, role: 'owner', authorityEnvironmentId: 'database-environment' }
function client(identity, result) {
  return { auth: { getUser: async () => identity }, rpc: async name => {
    assert.equal(name, 'super_admin_session')
    return result
  } }
}
const rejects = (operation, code) => assert.rejects(operation, error => error instanceof AdminAccessError && error.statusCode === code)

test('unverified identity cannot invoke authority RPC', async () => {
  await rejects(() => authorizeAdmin({ auth: { getUser: async () => ({ data: { user }, error: new Error('expired') }) }, rpc: () => assert.fail('RPC invoked') }), 401)
})
test('authenticated metadata-bearing outsider is denied', async () => {
  await rejects(() => authorizeAdmin(client({ data: { user }, error: null }, { data: null, error: { code: '42501', message: 'private SQL' } })), 403)
})
test('authority is rechecked per request and disabling a provisioned owner takes effect', async () => {
  let enabled = true
  const c = client({ data: { user }, error: null }, null)
  c.rpc = async () => enabled ? { data: session, error: null } : { data: null, error: { code: '42501' } }
  assert.deepEqual(await authorizeAdmin(c), session)
  enabled = false
  await rejects(() => authorizeAdmin(c), 403)
})
test('malformed, cross-user and unavailable authority fail closed', async () => {
  for (const data of [null, {}, { ...session, userId: 'another-user' }, { ...session, role: 'tenant-admin' }, { ...session, authorityEnvironmentId: null }]) {
    await rejects(() => authorizeAdmin(client({ data: { user }, error: null }, { data, error: null })), 503)
  }
  await rejects(() => authorizeAdmin(client({ data: { user }, error: null }, { data: session, error: { code: 'network' } })), 503)
})
test('session projection contains only database identity fields', async () => {
  assert.deepEqual(await authorizeAdmin(client({ data: { user }, error: null }, { data: { ...session, secret: 'hidden' }, error: null })), session)
})

test('claim authority and cookie boundary source review', async () => {
  const { readFileSync } = await import('node:fs')
  const read = path => readFileSync(new URL(path, import.meta.url), 'utf8')
  const source = read('../../server/utils/authorize.ts') + read('../../server/api/session.get.ts')
  assert.doesNotMatch(source, /user_metadata|app_metadata|service_role|serviceRole|selectedSuit/)
  assert.match(source, /getUser\(\)/)
  assert.match(source, /rpc\('super_admin_session'\)/)
  assert.match(source, /private, no-store/)
  const config = read('../../nuxt.config.ts')
  assert.match(config, /expectedCookiePrefix/)
  assert.match(config, /sameSite: 'lax'/)
  assert.doesNotMatch(config, /domain:/)
})

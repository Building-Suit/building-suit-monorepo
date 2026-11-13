import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import * as contract from '../../supabase/functions/_shared/paymob-checkout-contract.ts'

const organizationId = '00000000-0000-4000-8000-000000000001'
function fixture({ authenticated = true, state = 'trialing', denied = false, missing = false } = {}) {
  const calls = [], env = []
  const client = {
    auth: { async getUser() { calls.push('auth'); return { data: { user: authenticated ? { id: 'synthetic-owner' } : null }, error: authenticated ? null : new Error('Invalid session') } } },
    async rpc(name, args) { calls.push({ name, args }); return { data: missing ? [] : [{ access_state: state }], error: denied ? new Error('TENANT_ACCESS_DENIED') : null } },
  }
  const load = (file, imports, deno = {}) => {
    const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
    const module = { exports: {} }
    new Function('require', 'module', 'exports', 'Deno', code)(name => {
      assert.ok(name in imports, `Unexpected dependency: ${name}`)
      return imports[name]
    }, module, module.exports, deno)
    return module.exports
  }
  const http = load('../../supabase/functions/_shared/http.ts', {
    'npm:@supabase/supabase-js@2': { createClient(url, key, options) { assert.equal(url, 'https://synthetic.invalid'); assert.equal(key, 'synthetic-anon'); assert.equal(options.auth.persistSession, false); assert.equal(options.global.headers.Authorization, 'Bearer synthetic-session'); return client } },
    './env.ts': { requiredEnv(name) { env.push(name); assert.ok(['SUPABASE_URL', 'SUPABASE_ANON_KEY'].includes(name), 'Checkout retirement needs no provider or service-role secret'); return name === 'SUPABASE_URL' ? 'https://synthetic.invalid' : 'synthetic-anon' } },
  })
  let handler
  load('../../supabase/functions/paymob-checkout/index.ts', { '../_shared/http.ts': http, '../_shared/paymob-checkout-contract.ts': contract }, { serve(value) { handler = value } })
  const request = (body = { organizationId, planKey: 'solo', interval: 'yearly' }, headers = { Authorization: 'Bearer synthetic-session' }) => handler(new Request('https://synthetic.invalid/functions/v1/paymob-checkout', { method: 'POST', headers, body: JSON.stringify(body) }))
  return { handler, request, calls, env }
}
for (const state of ['trialing', 'checkout_required', 'read_only']) test(`old online enrollment is closed after fresh auth/tenant admission: ${state}`, async () => {
  const f = fixture({ state }), response = await f.request(), result = await response.json()
  assert.equal(response.status, 410)
  assert.match(result.error, /InstaPay/)
  assert.equal(result.url, undefined)
  assert.deepEqual(f.calls, ['auth', { name: 'billing_checkout_context', args: { p_organization_id: organizationId, p_plan_key: 'solo', p_interval: 'yearly' } }])
  assert.deepEqual(f.env, ['SUPABASE_URL', 'SUPABASE_ANON_KEY'])
})
test('retired endpoint still rejects anonymous, revoked and cross-tenant callers', async () => {
  const anonymous = fixture(); assert.equal((await anonymous.request(undefined, {})).status, 400); assert.deepEqual(anonymous.calls, [])
  const revoked = fixture({ authenticated: false }); assert.equal((await revoked.request()).status, 400); assert.deepEqual(revoked.calls, ['auth'])
  const denied = fixture({ denied: true }); const response = await denied.request(); assert.equal(response.status, 400); assert.match((await response.json()).error, /permission/)
})
test('active/missing organizations and caller-supplied amounts cannot start enrollment', async () => {
  for (const options of [{ state: 'active' }, { missing: true }]) assert.equal((await fixture(options).request()).status, 400)
  const f = fixture(); assert.equal((await f.request({ organizationId, planKey: 'solo', interval: 'yearly', amountMinor: 1 })).status, 400); assert.deepEqual(f.calls, [])
})
test('CORS preflight does not authenticate, quote, enroll or read secrets', async () => {
  const f = fixture(), response = await f.handler(new Request('https://synthetic.invalid', { method: 'OPTIONS' }))
  assert.equal(response.status, 200); assert.deepEqual(f.calls, []); assert.deepEqual(f.env, [])
})

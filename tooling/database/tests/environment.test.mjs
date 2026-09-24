import test from 'node:test'
import assert from 'node:assert/strict'
import { validateEnvironment } from '../environment.mjs'
function fixture() {
  const registry = {
    products: {
      'ledger-suit': { organizationId: 'ledger-org', production: { projectRef: 'a'.repeat(20) }, staging: { projectRef: 'b'.repeat(20) } },
      'shop-suit': { organizationId: 'shop-org', production: { projectRef: 'c'.repeat(20), appUrl: 'https://shop.example.com' }, staging: { projectRef: 'd'.repeat(20) } },
      'inventory-suit': { organizationId: '', production: { projectRef: '', appUrl: '' }, staging: { projectRef: '', appUrl: '' } },
    },
    sources: { 'shop-suit': { projectRef: 'e'.repeat(20) } },
  }
  const app = {
    APP_ENV: 'production', APP_URL: 'https://shop.example.com',
    SUPABASE_URL: `https://${'c'.repeat(20)}.supabase.co`, SUPABASE_KEY: 'sb_publishable_fixture',
    NUXT_PUBLIC_SUPABASE_URL: `https://${'c'.repeat(20)}.supabase.co`, NUXT_PUBLIC_SUPABASE_KEY: 'sb_publishable_fixture',
    NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-shop-production-auth-token',
  }
  const secret = { SUPABASE_PROJECT_REF: 'c'.repeat(20), SUPABASE_ORGANIZATION_ID: 'shop-org', SUPABASE_ACCESS_TOKEN: 'fixture-pat', SUPABASE_DB_PASSWORD: 'fixture-database-password' }
  return { registry, app, secret }
}
const verify = ({ registry, app, secret }) => validateEnvironment(registry, 'shop-suit', 'production', app, secret)
test('accepts a correctly paired independent environment without revealing a key', () => {
  const state = fixture()
  const result = verify(state)
  assert.match(result, /No remote operation/)
  assert.ok(!result.includes(state.app.SUPABASE_KEY))
})
test('rejects crossed product refs, reused refs, shared organizations and the Shop source', () => {
  for (const mutate of [
    s => { s.secret.SUPABASE_PROJECT_REF = 'a'.repeat(20) },
    s => { s.registry.products['shop-suit'].staging.projectRef = 'c'.repeat(20) },
    s => { s.registry.products['shop-suit'].organizationId = 'ledger-org' },
    s => { s.registry.sources['shop-suit'].projectRef = 'c'.repeat(20) },
  ]) { const state = fixture(); mutate(state); assert.throws(() => verify(state)) }
})
test('rejects privileged frontend keys, placeholders, missing keys and runtime mismatches', () => {
  const serviceRole = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`
  for (const key of ['sb_secret_private', serviceRole, 'sb_publishable_REPLACE_ME', undefined]) {
    const state = fixture(); state.app.SUPABASE_KEY = key; state.app.NUXT_PUBLIC_SUPABASE_KEY = key
    assert.throws(() => verify(state), /publishable\/anon/)
  }
  const state = fixture(); state.app.NUXT_PUBLIC_SUPABASE_KEY = 'sb_publishable_different'
  assert.throws(() => verify(state), /keys differ/)
})
test('rejects environment, URL, session-cookie and application-origin mismatches', () => {
  for (const [key, value] of Object.entries({
    APP_ENV: 'staging', SUPABASE_URL: 'https://wrong.supabase.co',
    NUXT_PUBLIC_SUPABASE_URL: 'https://wrong.supabase.co',
    NUXT_PUBLIC_SUPABASE_COOKIE_PREFIX: 'bs-ledger-production-auth-token', APP_URL: 'https://staging.example.com',
  })) { const state = fixture(); state.app[key] = value; assert.throws(() => verify(state)) }
})

test('rejects missing deployment credentials without printing values', () => {
  for (const key of ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD']) {
    const state = fixture(); delete state.secret[key]; assert.throws(() => verify(state))
  }
})

test('keeps an unprovisioned Inventory product distinct and refuses hosted preflight', () => {
  const state = fixture()
  assert.equal(state.registry.products['inventory-suit'].production.projectRef, '')
  assert.throws(() => validateEnvironment(state.registry, 'inventory-suit', 'production', {}, {}), /verified project ref/)
})

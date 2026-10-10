import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test, { mock } from 'node:test'
import { ref } from 'vue'

const source = stripTypeScriptTypes(await readFile(new URL('../../app/plugins/session-loss.client.ts', import.meta.url), 'utf8'))
let fixtureId = 0
async function fixture(path = '/dashboard') {
  const user = ref({ id: 'old-account' })
  const route = { path }
  const cache = new Map([['shop-data:sales', 'secret'], ['platform-admin:dashboard', 'secret'], ['public-plans', 'public']])
  const toasts = ref(['old toast'])
  const confirmation = { current: ref({}), answer(value) { assert.equal(value, false); this.current.value = null } }
  let callback, cleanup, resets = 0, unsubscribed = false
  const navigation = [], timers = [], removed = []
  const env = {
    defineNuxtPlugin: plugin => plugin.setup,
    useSupabaseClient: () => ({ auth: { onAuthStateChange: fn => {
      callback = fn
      return { data: { subscription: { unsubscribe() { unsubscribed = true } } } }
    } } }),
    useSupabaseUser: () => user, useRoute: () => route,
    useShop: () => ({ resetSession() { resets++ } }),
    useConfirmation: () => confirmation, useToasts: () => ({ toasts }),
    clearNuxtData: predicate => { for (const key of cache.keys()) if (predicate(key)) cache.delete(key) },
    navigateTo: (...args) => navigation.push(args),
    sessionStorage: { removeItem: key => removed.push(key) },
    setTimeout: fn => timers.push(fn),
  }
  const key = `__sessionLoss${fixtureId++}`
  globalThis[key] = env
  const code = `const {${Object.keys(env).join(',')}} = globalThis['${key}'];\n${source}`
  const plugin = (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).default
  delete globalThis[key]
  plugin({ runWithContext: fn => fn(), vueApp: { onUnmount: fn => { cleanup = fn } } })
  return { user, cache, confirmation, toasts, navigation, removed, emit: event => callback(event), flush: () => timers.splice(0).forEach(fn => fn()), dispose: () => cleanup(), get resets() { return resets }, get unsubscribed() { return unsubscribed } }
}

test('SIGNED_OUT synchronously clears tenant/admin state and schedules login outside Auth lock', async () => {
  const f = await fixture()
  assert.equal(f.emit('SIGNED_OUT'), undefined, 'Auth callback must not return an awaited operation')
  assert.equal(f.user.value, null)
  assert.equal(f.resets, 1)
  assert.deepEqual([...f.cache.keys()], ['public-plans'])
  assert.equal(f.confirmation.current.value, null)
  assert.deepEqual(f.toasts.value, [])
  assert.deepEqual(f.removed, ['shop-suit.pending-onboarding'])
  assert.deepEqual(f.navigation, [])
  f.flush()
  assert.deepEqual(f.navigation, [['/auth/login', { replace: true }]])
  f.dispose()
  assert.equal(f.unsubscribed, true)
})

test('refresh and sign-in events preserve session; queued logout cannot redirect a new account', async () => {
  const f = await fixture()
  for (const event of ['INITIAL_SESSION', 'SIGNED_IN', 'TOKEN_REFRESHED', 'USER_UPDATED']) f.emit(event)
  assert.equal(f.resets, 0)
  f.emit('SIGNED_OUT')
  f.user.value = { id: 'new-account' }
  f.flush()
  assert.deepEqual(f.navigation, [])
})

test('signed-out public auth routes retain their recovery navigation', async () => {
  const f = await fixture('/auth/forgot-password')
  f.emit('SIGNED_OUT'); f.flush()
  assert.deepEqual(f.navigation, [])
})

// Existing behavioral composable tests exercise cancellation of pending reads,
// account replacement and stale location responses against the real useShop.
await import('./shop-context.test.mjs')
await import('./signup-session-transition.test.mjs')

test('installed Supabase SDK emits SIGNED_OUT and removes credentials on provider session_not_found', async () => {
  const { createRequire } = await import('node:module')
  const providerRequire = createRequire(import.meta.resolve('@nuxtjs/supabase'))
  const { createClient } = await import(providerRequire.resolve('@supabase/supabase-js'))
  const identity = { id: '00000000-0000-4000-8000-000000000101', aud: 'authenticated', role: 'authenticated', email: 'synthetic@example.test', app_metadata: {}, user_metadata: {} }
  const claims = { sub: identity.id, exp: Math.floor(Date.now() / 1000) + 3600 }
  const token = `${Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.test`
  const requests = []
  const client = createClient('http://synthetic.invalid', 'synthetic-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async url => {
      requests.push(String(url))
      if (String(url).endsWith('/user')) return new Response(JSON.stringify(identity), { status: 200, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' } })
      assert.match(String(url), /\/token\?grant_type=refresh_token$/)
      return new Response(JSON.stringify({ code: 'session_not_found', message: 'Session superseded' }), { status: 400, headers: { 'content-type': 'application/json', 'x-supabase-api-version': '2024-01-01' } })
    } },
  })
  const events = []
  const { data: { subscription } } = client.auth.onAuthStateChange(event => { events.push(event) })
  try {
    assert.equal((await client.auth.setSession({ access_token: token, refresh_token: 'synthetic-refresh' })).error, null)
    const result = await client.auth.refreshSession()
    assert.equal(result.error?.name, 'AuthSessionMissingError')
    assert.ok(!events.includes('SIGNED_OUT'), 'proactive failure retains an unexpired JWT')
    mock.timers.enable({ apis: ['Date'], now: Date.now() + 3_601_000 })
    await client.auth.refreshSession()
    assert.ok(events.includes('SIGNED_OUT'))
    assert.equal((await client.auth.getSession()).data.session, null)
    assert.equal(requests.length, 3)
  } finally { subscription.unsubscribe(); mock.timers.reset() }
})

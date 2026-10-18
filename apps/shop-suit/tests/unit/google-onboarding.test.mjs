import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { ref, reactive, computed } from 'vue'
import { verifiedGoogleIdentity } from '../../app/utils/googleIdentity.ts'
import * as onboarding from '../../app/utils/pendingOnboarding.ts'
import { BUSINESS_MODES } from '../../app/utils/businessMode.ts'

const google = (name = 'Google owner') => ({ id: 'google-owner', email: 'owner@example.test', email_confirmed_at: '2026-10-17', user_metadata: { display_name: 'Untrusted override' }, identities: [{ provider: 'google', identity_data: { email: 'owner@example.test', email_verified: true, name } }] })
const signup = await readFile(new URL('../../app/pages/auth/signup.vue', import.meta.url), 'utf8')
const callback = await readFile(new URL('../../app/pages/auth/google-callback.vue', import.meta.url), 'utf8')
function script(source) {
  return stripTypeScriptTypes(source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1])
    .replace(/^import .*$/gm, '').replaceAll('import.meta.client', 'true')
}
async function fixture(user = google(), { existing = false, storage = new Map(), lookupError = null, shopError = null } = {}) {
  const hooks = [], navigation = [], calls = []
  const currentId = ref(existing ? 'existing-shop' : null)
  const client = {
    schema: () => client,
    rpc: async (name, args) => { calls.push({ name, args }); currentId.value = 'created-shop'; return {} },
    auth: {
      getUser: async () => ({ data: { user }, error: lookupError }),
      signUp: async () => { throw Error('Google must never call password signup') },
      verifyOtp: async () => { throw Error('Google must never request email OTP') },
      updateUser: async () => ({}),
      exchangeCodeForSession: async code => { calls.push({ name: 'exchange', code }); return {} },
    },
  }
  const env = {
    ...onboarding, verifiedGoogleIdentity, BUSINESS_MODES, ref, reactive, computed,
    definePageMeta() {}, useSupabaseClient: () => client,
    useI18n: () => ({ locale: ref('en'), t: key => key }),
    useSignupWizard: () => ({ step: ref(1), advance: async validate => { if (validate()) env.state.step.value++ }, back() {}, reset() {} }),
    useVerificationTimer: () => ({ expiresAt: ref(0), resendAt: ref(0), expired: ref(false), resendIn: ref(0), expiresIn: ref(0), restore() {}, reset() {}, format() {} }),
    useShop: () => ({ currentId, loadShops: async () => {}, loadError: ref(shopError) }),
    useHead() {}, onMounted: hook => hooks.push(hook), watch() {},
    useMarketingAnalytics: () => ({ track: async () => {} }),
    navigateTo: async value => navigation.push(value), nextTick: async () => {},
    sessionStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
  }
  const state = Function(...Object.keys(env), `${script(signup)}; return { form, step, submit, signupForm, signupView, saveDraft, identityLoading };`)(...Object.values(env))
  env.state = state
  return { env, state, hooks, calls, navigation, storage }
}
test('verified Google identity rejects editable metadata, unverified and mismatched provider claims', () => {
  assert.deepEqual(verifiedGoogleIdentity(google()), { email: 'owner@example.test', name: 'Google owner' })
  for (const user of [null, { ...google(), identities: [] }, { ...google(), email_confirmed_at: null }, { ...google(), identities: [{ provider: 'google', identity_data: { email: 'other@example.test', email_verified: true } }] }, { ...google(), identities: [{ provider: 'google', identity_data: { email: 'owner@example.test', email_verified: false } }] }]) assert.equal(verifiedGoogleIdentity(user), null)
})
test('new Google account retains locked identity, needs workspace fields and creates only one shop', async () => {
  const f = await fixture()
  await f.state.submit()
  assert.equal(f.calls.length, 0, 'cannot submit before server identity restoration')
  await f.hooks[0]()
  assert.equal(f.state.step.value, 2)
  assert.equal(f.state.signupView.value.existingAccount, true)
  f.state.signupForm.value = { ...f.state.signupForm.value, name: 'Forged', email: 'other@example.test' }
  assert.equal(f.state.form.displayName, 'Google owner')
  assert.equal(f.state.form.email, 'owner@example.test')
  assert.equal(f.state.form.password, '')
  await f.state.submit()
  assert.equal(f.calls.length, 0, 'workspace requirements are mandatory')
  Object.assign(f.state.form, { shopName: 'My shop', mainLocationName: 'Main location' })
  await f.state.submit(); await f.state.submit()
  assert.equal(f.calls.filter(call => call.name === 'create_owner_shop').length, 1)
  assert.equal(f.navigation.at(-1), '/dashboard')
})
test('missing provider name remains editable through the account step without password', async () => {
  const f = await fixture(google('')); await f.hooks[0]()
  assert.equal(f.state.step.value, 1)
  assert.equal(f.state.signupView.value.nameLocked, false)
  f.state.signupForm.value = { ...f.state.signupForm.value, name: 'Completed name' }
  assert.equal(f.state.form.displayName, 'Completed name')
  assert.equal(f.state.signupView.value.nameLocked, false)
  await f.state.submit()
  assert.equal(f.state.step.value, 2)
  assert.equal(f.calls.length, 0)
})
test('existing Google account goes to its existing shop without provisioning', async () => {
  const f = await fixture(google(), { existing: true })
  await f.hooks[0]()
  assert.deepEqual(f.navigation, ['/dashboard'])
  assert.equal(f.calls.length, 0)
})
test('reload restores incomplete Google workspace but revalidates identity and never requires password or OTP', async () => {
  const f = await fixture(); await f.hooks[0]()
  Object.assign(f.state.form, { shopName: 'Saved draft', mainLocationName: 'Saved location' })
  f.state.saveDraft()
  const resumed = await fixture(google(), { storage: f.storage }); await resumed.hooks[0]()
  assert.equal(resumed.state.form.shopName, 'Saved draft')
  assert.equal(resumed.state.form.mainLocationName, 'Saved location')
  assert.equal(resumed.state.signupView.value.stage, 'workspace')
  assert.equal(resumed.state.form.password, '')
  assert.equal(resumed.calls.length, 0)
})
test('identity lookup failure blocks signup rather than creating another account', async () => {
  const f = await fixture(null, { lookupError: Error('Auth unavailable') }); await f.hooks[0]()
  assert.equal(f.state.signupView.value.submitDisabled, true)
  await f.state.submit(); assert.equal(f.calls.length, 0)
})
test('unavailable shop lookup cannot provision a duplicate account or shop', async () => {
  const f = await fixture(google(), { shopError: 'Unavailable' }); await f.hooks[0]()
  assert.equal(f.state.signupView.value.submitDisabled, true)
  Object.assign(f.state.form, { shopName: 'Duplicate', mainLocationName: 'Main' })
  await f.state.submit(); assert.equal(f.calls.length, 0)
})
test('Google callback exchanges once, and reload resumes through authenticated getUser without a code', async () => {
  for (const code of ['one-time-code', '']) {
    const f = await fixture()
    const hooks = []
    const env = { ...f.env, useRoute: () => ({ query: { code } }), onMounted: fn => hooks.push(fn), window: { history: { state: {}, replaceState() {} }, location: { pathname: '/auth/google-callback' } } }
    Function(...Object.keys(env), script(callback))(...Object.values(env))
    await hooks[0]()
    assert.equal(f.calls.filter(call => call.name === 'exchange').length, code ? 1 : 0)
    assert.equal(f.navigation.at(-1), '/auth/signup')
  }
})

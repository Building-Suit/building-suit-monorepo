import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
async function moduleAt(path, replacements = {}) {
  let source = await readFile(new URL(path, import.meta.url), 'utf8')
  for (const [from, to] of Object.entries(replacements)) source = source.replace(from, to)
  const code = ts.transpile(source, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext })
  const url = `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  return { exports: await import(url), url }
}
const { exports: seo, url: seoUrl } = await moduleAt('../../shared/publicSeo.ts')
const { exports: analytics } = await moduleAt('../../shared/marketingAnalytics.ts', { "'./publicSeo'": JSON.stringify(seoUrl) })
const { exports: consent } = await moduleAt('../../../../packages/ux/src/utils/privacyConsent.ts')
const { exports: transport } = await moduleAt('../../../../packages/ux/src/utils/basicAnalytics.ts')
test('only exact production environment and public canonical documents can index', () => {
  for (const env of ['local', 'staging', 'preview', '', 'Production']) assert.equal(seo.canIndex(env, seo.productionOrigin), false)
  for (const origin of ['https://stg.shop.building-suit.com', 'https://preview.vercel.app', 'http://shop.building-suit.com', 'https://shop.building-suit.com.evil.test']) assert.equal(seo.canIndex('production', origin), false)
  assert.equal(seo.canIndex('production', seo.productionOrigin), true)
  for (const path of ['/dashboard', '/billing', '/auth/signup', '/customers/123', '/pricing', '/changelog']) assert.equal(seo.isPublicPath(path), false)
  assert.equal((seo.publicSitemap(true).match(/<url>/g) || []).length, 7)
  assert.doesNotMatch(seo.publicSitemap(false), /<loc>/)
  for (const path of seo.publicPaths) assert.match(seo.publicSitemap(true), new RegExp(seo.productionOrigin + path))
})
test('preferences fail closed on stale version, expiry, corruption, future or malformed values', () => {
  const now = 100000000000
  const valid = consent.privacyPreference(true, now)
  assert.deepEqual(consent.readPrivacyPreference(JSON.stringify(valid), now), valid)
  for (const raw of [null, '', 'broken', '{}', JSON.stringify({ ...valid, version: 0 }), JSON.stringify({ ...valid, savedAt: now + 1 }), JSON.stringify({ ...valid, analytics: 'true' }), JSON.stringify({ ...valid, savedAt: now - consent.consentLifetime })]) assert.equal(consent.readPrivacyPreference(raw, now), null)
  assert.equal(consent.readPrivacyPreference(JSON.stringify(consent.privacyPreference(false, now)), now).analytics, false)
})
test('event allowlist never sends operational paths, queries, hashes, identifiers or payment initiation', () => {
  for (const event of ['page_view', 'pricing_cta', 'signup_complete', 'purchase', 'payment_redirect', 'arbitrary']) for (const path of ['/billing', '/customers/private', '/auth/login', '/?email=private@example.test', '/#private']) assert.equal(analytics.analyticsEnvelope(event, path), null)
  const page = analytics.analyticsEnvelope('page_view', '/')
  assert.deepEqual(page.params, { page_location: seo.productionOrigin + '/', page_title: 'Shop Suit', page_referrer: '' })
  assert.equal(analytics.analyticsEnvelope('signup_complete', '/auth/signup').name, 'sign_up')
  assert.equal(analytics.analyticsEnvelope('signup_complete', '/'), null)
  assert.equal(analytics.analyticsEnvelope('pricing_cta', '/about'), null)
  assert.equal(analytics.analyticsEnvelope('purchase', '/'), null)
})
test('GA transport hides parent content, queues only explicit events and discards on stop', async () => {
  let attached = false, removed = false, loaded
  const sent = []
  const frame = { setAttribute() {}, addEventListener(_, callback) { loaded = callback }, remove() { removed = true }, contentWindow: {} }
  const doc = { createElement() { return frame }, body: { append() { attached = true } } }
  assert.throws(() => transport.createBasicAnalytics('invalid', seo.productionOrigin, doc))
  assert.equal(attached, false)
  const client = transport.createBasicAnalytics('G-TESTONLY', seo.productionOrigin, doc)
  assert.match(frame.srcdoc, /send_page_view[^,]+false/)
  assert.match(frame.srcdoc, /allow_google_signals[^,]+false/)
  assert.doesNotMatch(frame.srcdoc, /parent\.|document\.referrer|location\.href|history\./)
  await client.send('page_view', { page_location: seo.productionOrigin + '/' })
  frame.contentWindow.dispatchAnalytics = (...args) => sent.push(args)
  loaded()
  assert.equal(sent.length, 1)
  client.stop()
  await client.send('page_view', {})
  loaded()
  assert.equal(sent.length, 1)
  assert.equal(removed, true)
})
test('cookie removal leaves authentication, locale and unrelated storage intact', () => {
  const writes = []
  const doc = { get cookie() { return '_ga=one; _ga_TESTONLY=two; bs-shop-production-auth-token=private; building-suit-locale=ar; other=value' }, set cookie(value) { writes.push(value) } }
  consent.removeAnalyticsCookies(doc, 'shop.building-suit.com')
  assert.ok(writes.length > 0)
  assert.ok(writes.every(value => /^_ga(?:_TESTONLY)?=; Max-Age=0;/.test(value)))
})
test('signup conversion follows confirmed new shop creation; failed, restored and replayed flows do not convert', async () => {
  const source = await readFile(new URL('../../app/pages/auth/signup.vue', import.meta.url), 'utf8')
  const script = source.match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const ast = ts.createSourceFile('signup.ts', script, ts.ScriptTarget.Latest, true)
  const provision = ast.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === 'provisionShop').getText(ast)
  async function scenario({ restored = false, fail = false, verified = true } = {}) {
    const events = [], navigation = [], currentId = { value: restored ? 'synthetic-shop' : null }
    let created = false
    const env = {
      supabase: { auth: { getUser: async () => ({ data: { user: { email: 'synthetic@example.test', email_confirmed_at: verified ? 'synthetic-date' : null } }, error: null }) } },
      normalizeSignupEmail: value => value.toLowerCase(), form: { email: 'synthetic@example.test', shopName: 'Synthetic', businessMode: 'mixed', mainLocationName: 'Synthetic', mainLocationCode: '', mainLocationAddress: '', mainLocationPhone: '' },
      currentId, existingAccount: { value: false }, showRecovery() {},
      loadShops: async () => { if (created) currentId.value = 'synthetic-shop' },
      shopRpc: { rpc: async () => { if (fail) return { error: new Error('synthetic response failure') }; created = true; return { error: null } } },
      marketingAnalytics: { track: async event => events.push(event) }, clearDraft() {}, navigateTo: async path => navigation.push(path),
    }
    const code = ts.transpile(`return async function run(){ const { ${Object.keys(env).join(',')} }=env; ${provision}; await provisionShop(); await provisionShop() }`, { target: ts.ScriptTarget.ES2022 })
    const run = new Function('env', code)(env)
    try { await run() } catch { /* expected simulated provisioning failure */ }
    return { events, navigation }
  }
  assert.deepEqual((await scenario()).events, ['signup_complete'])
  for (const options of [{ restored: true }, { fail: true }, { verified: false }]) assert.deepEqual((await scenario(options)).events, [])
})

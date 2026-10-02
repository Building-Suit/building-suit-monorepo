import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const read = path => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')
const routes = ['about', 'contact', 'terms', 'privacy', 'delivery-shipping', 'refund-cancellation']

test('all Shop public and legal routes use the Shop-owned landing structure', async () => {
  for (const route of routes) {
    const source = await read(`app/pages/${route}.vue`)
    assert.match(source, /layout: 'landing'/)
    assert.doesNotMatch(source, /ledger-suit|Ledger Suit/)
  }
  const page = await read('app/components/PublicLegalPage.vue')
  assert.match(page, /Shop Suit by Building Suit/)
  assert.match(page, /title: `\$\{props\.document\.title\} · Shop Suit`/)
})

test('legal copy is bilingual and describes Shop manual digital delivery accurately', async () => {
  const legal = await read('app/utils/legal.ts')
  assert.match(legal, /support@building-suit\.com/)
  assert.match(legal, /\+201500240770/)
  assert.match(legal, /Cairo, Egypt/)
  assert.match(legal, /القاهرة، مصر/)
  assert.match(legal, /We do not sell or ship physical goods/)
  assert.match(legal, /operator-configured InstaPay or instant bank transfer/)
  assert.match(legal, /no automatic refund or fixed processing time is promised/)
  assert.doesNotMatch(legal, /Paymob|card payments are processed|automatic bank verification or customer self-activation/)
  for (const key of ["about: {", "privacy: {", "delivery: {", "refund: {", "terms: {"]) assert.match(legal, new RegExp(key.replace('{', '\\{')))
})

test('contact intake and paid-plan boundary include all required protections and policies', async () => {
  const contact = await read('app/pages/contact.vue')
  const migration = await read('supabase/migrations/20260930200000_public_support_requests.sql')
  const billing = await read('app/pages/billing.vue')
  for (const field of ['category', 'subject', 'message', 'email', 'consent', 'honeypot']) assert.match(contact, new RegExp(field))
  assert.match(migration, /pg_advisory_xact_lock/)
  assert.match(migration, /interval '10 minutes'/)
  assert.match(migration, /grant execute .* to anon, authenticated/)
  assert.match(migration, /revoke all on public\.support_requests/)
  for (const href of ['/terms', '/privacy', '/refund-cancellation']) assert.match(billing, new RegExp(`to="${href}"`))
})

test('Shop logo resolves canonical light and dark marks and wordmarks', async () => {
  for (const layout of ['auth', 'default', 'landing', 'platform-admin']) {
    const source = await read(`app/layouts/${layout}.vue`)
    assert.match(source, /<BsProductLogo/)
    assert.match(source, /asset-prefix="\/brand\/shop-suit"/)
    assert.doesNotMatch(source, /<AppLogo/)
  }
  for (const asset of ['mark-light', 'mark-dark', 'wordmark-light', 'wordmark-dark']) {
    const svg = await read(`../../packages/brand/assets/shop-suit-${asset}.svg`)
    assert.match(svg, /<svg/)
    assert.match(svg, /#D89B42|#EBB45A/)
  }
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { validWebsiteSlug, suggestWebsiteSlug, websiteUrl, reservedWebsiteSlugs } from '../../shared/websiteAddress.ts'
import { classifyWebsiteHost, websiteAliasRedirect } from '../../server/utils/websiteHost.ts'
const privateOrigin = 'https://shop.building-suit.com'
test('strict lowercase ASCII slugs, lengths, reserved and unsafe names', () => {
  for (const slug of ['abc', '123', 'a-1', 'a'.repeat(50)]) assert.equal(validWebsiteSlug(slug), true)
  for (const slug of ['', 'ab', 'a'.repeat(51), 'Foo', '-foo', 'foo-', 'a--b', 'xn--abc', 'a.b', 'a_b', ' foo', 'foo\n', 'متجر', 'fóo', '<script>', 'a/b', ...reservedWebsiteSlugs]) assert.equal(validWebsiteSlug(slug), false, slug)
})
test('generated ambiguous/non-Latin names use fresh 128-bit fallback; candidates remain editable', () => {
  const entropy = '0a'.repeat(16)
  assert.equal(suggestWebsiteSlug('Nice Shop', entropy), 'nice-shop')
  for (const name of ['متجر جميل', 'Café', 'Nice & Co', 'www', 'ab', '']) assert.equal(suggestWebsiteSlug(name, entropy), `shop-${entropy}`)
  assert.notEqual(suggestWebsiteSlug('متجر', entropy), suggestWebsiteSlug('متجر', 'ab'.repeat(16)))
  assert.throws(() => suggestWebsiteSlug('abc', 'weak'), /SECURE_ENTROPY/)
  assert.equal(websiteUrl('nice-shop'), 'https://nice-shop.shops.building-suit.com')
})
test('trust only HTTP authority; private and public hosts are isolated', () => {
  assert.deepEqual(classifyWebsiteHost('abc.shops.building-suit.com', privateOrigin, 'production'), { kind: 'website', slug: 'abc' })
  assert.deepEqual(classifyWebsiteHost('ABC.SHOPS.BUILDING-SUIT.COM', privateOrigin, 'production'), { kind: 'website', slug: 'abc' })
  assert.deepEqual(classifyWebsiteHost('shop.building-suit.com', privateOrigin, 'production'), { kind: 'private' })
  for (const host of [undefined, 'evil.test', 'shops.building-suit.com', 'abc.shops.building-suit.com.evil.test', 'a.b.shops.building-suit.com', 'www.shops.building-suit.com', 'abc.shops.building-suit.com:443', 'abc.shops.building-suit.com.', 'shop.building-suit.com@evil.test', ' abc.shops.building-suit.com', 'abc.shops.building-suit.com,evil.test', 'abc%2eshops.building-suit.com']) assert.deepEqual(classifyWebsiteHost(host, privateOrigin, 'production'), { kind: 'denied' }, host)
  assert.equal(classifyWebsiteHost('localhost:3001', privateOrigin, 'local').kind, 'private')
  assert.equal(classifyWebsiteHost('evil.test', '', 'production').kind, 'denied')
  assert.equal(classifyWebsiteHost('abc.shops.building-suit.com', 'https://abc.shops.building-suit.com', 'production').kind, 'website')
})
test('alias redirect has a fixed HTTPS domain and rejects unsafe resolver results', () => {
  assert.equal(websiteAliasRedirect('old-shop', { canonicalSlug: 'new-shop', isAlias: true }), 'https://new-shop.shops.building-suit.com')
  for (const result of [null, {}, { canonicalSlug: 'old-shop', isAlias: true }, { canonicalSlug: 'new-shop', isAlias: false }, { canonicalSlug: 'evil.test', isAlias: true }, { canonicalSlug: '//evil.test', isAlias: true }]) assert.equal(websiteAliasRedirect('old-shop', result), null)
})

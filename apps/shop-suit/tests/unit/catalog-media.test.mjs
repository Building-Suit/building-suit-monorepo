import test from 'node:test'
import assert from 'node:assert/strict'
import { catalogMediaRequest, validCatalogImage } from '../../app/utils/catalogMedia.ts'
const missing = () => Promise.resolve({ data: null, error: { code: 'PGRST202', message: 'missing' } })
test('legacy catalog reads and media-free saves remain available when the optional API is absent', async () => {
  let legacyCalls = 0
  const legacy = () => { legacyCalls++; return Promise.resolve({ data: { items: [{ id: 'original', unitPrice: 5, stock: 2 }] }, error: null }) }
  for (const action of ['products', 'services', 'pos', 'save_product', 'save_service']) {
    const result = await catalogMediaRequest(action, null, missing, legacy)
    assert.equal(result.data.items[0].unitPrice, 5)
  }
  assert.equal(legacyCalls, 5)
})
test('media additions and explicit removals cannot silently downgrade to legacy writes', async () => {
  const legacy = () => { throw Error('unexpected legacy write') }
  for (const action of ['save_product', 'save_service']) {
    assert.equal((await catalogMediaRequest(action, 'https://example.test/item.png', missing, legacy)).error.code, 'CATALOG_MEDIA_UNAVAILABLE')
    assert.equal((await catalogMediaRequest(action, null, missing, legacy, true)).error.code, 'CATALOG_MEDIA_UNAVAILABLE')
  }
})
test('permission, validation and network errors do not trigger a legacy retry', async () => {
  const legacy = () => { throw Error('unexpected permission fallback') }
  for (const code of ['42501', '22023', 'NETWORK_FAILURE']) {
    const result = await catalogMediaRequest('pos', null, () => Promise.resolve({ data: null, error: { code } }), legacy)
    assert.equal(result.error.code, code)
  }
})
test('authorized media results pass through without modifying stock, price or pagination', async () => {
  const result = { data: { supportsMedia: true, total: 99, page: 2, items: [{ stock: 0, unitPrice: 7, discount: 2, imageUrl: 'https://example.test/item.png' }] }, error: null }
  assert.equal(await catalogMediaRequest('pos', null, () => Promise.resolve(result), () => { throw Error('fallback') }), result)
})
test('optional images accept HTTPS URLs and reject credential URLs, unsafe schemes and whitespace', () => {
  for (const value of ['', 'https://cdn.example.test/item.png', 'HTTPS://cdn.example.test/item.png?version=2']) assert.equal(validCatalogImage(value), true)
  for (const value of ['http://example.test/img', 'javascript:alert(1)', 'data:image/png;base64,abc', 'https://user:secret@example.test/img', 'https://example.test/a b', 'https://example.test/' + 'a'.repeat(2000)]) assert.equal(validCatalogImage(value), false)
})

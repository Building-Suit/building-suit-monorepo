import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCatalogUpload, catalogObjectName, CATALOG_IMAGE_MAX_BYTES } from '../../app/utils/catalogUpload.ts'
const shop = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
test('optional catalog upload accepts raster signatures and rejects mislabeled active content', async () => {
  for (const [type, bytes] of [['image/jpeg',[255,216,255]], ['image/png',[137,80,78,71,13,10,26,10]], ['image/webp',[82,73,70,70,0,0,0,0,87,69,66,80]]]) {
    await validateCatalogUpload(new File([new Uint8Array(bytes)], 'image', { type }))
    await assert.rejects(validateCatalogUpload(new File(['<svg onload="alert(1)"/>'], 'image', { type })))
  }
  for (const file of [new File([], 'empty', { type: 'image/png' }), new File(['svg'], 'vector.svg', { type: 'image/svg+xml' }), { type: 'image/png', size: CATALOG_IMAGE_MAX_BYTES + 1 }]) await assert.rejects(validateCatalogUpload(file))
})
test('object keys use tenant, kind, generated UUID and trusted MIME extension, never filename', () => {
  assert.equal(catalogObjectName(shop, 'products', id, 'image/png'), `${shop}/products/${id}.png`)
  assert.equal(catalogObjectName(shop, 'services', id, 'image/jpeg'), `${shop}/services/${id}.jpg`)
  assert.throws(() => catalogObjectName('../another-tenant', 'products', id, 'image/png'))
  assert.throws(() => catalogObjectName(shop, 'products', '../overwrite', 'image/png'))
  assert.throws(() => catalogObjectName(shop, 'products', id, 'image/svg+xml'))
})

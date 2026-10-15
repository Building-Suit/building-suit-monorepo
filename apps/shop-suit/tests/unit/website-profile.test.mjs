import assert from 'node:assert/strict'
import test from 'node:test'
import { emptyWebsiteProfile } from '../../shared/websiteProfile.ts'
import { readPublicLogo } from '../../../../packages/ux/src/utils/readPublicLogo.ts'

test('public drafts have independent empty contacts, locations and SEO', () => {
  const a = emptyWebsiteProfile(), b = emptyWebsiteProfile()
  assert.deepEqual(a, { publicName: '', description: '', phone: '', whatsapp: '', email: '', openingHours: '', seoTitle: '', seoDescription: '', locations: [] })
  a.locations.push({ id: 'private', visible: false, publicName: '', address: '' })
  assert.equal(b.locations.length, 0)
})
test('logo input rejects SVG, false MIME, empty and oversized bytes before decoding', async () => {
  for (const file of [new File(['<svg onload="x()"/>'], 'x.svg', { type: 'image/svg+xml' }), new File(['<svg onload="x()"/>'], 'x.png', { type: 'image/png' }), new File([], 'x.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(131073)], 'x.webp', { type: 'image/webp' })]) await assert.rejects(readPublicLogo(file))
})
test('decoded logos enforce dimensions, close bitmap and reencode with no original metadata', async () => {
  const file = new File([Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGMU07RmYGBgYmBgYGBgAAAFvQB+2cWeHgAAAABJRU5ErkJggg==', 'base64')], 'logo.png', { type: 'image/png' })
  const bitmap = { width: 4096, height: 1, close() { this.closed = true } }
  const original = globalThis.createImageBitmap, document = globalThis.document
  try {
    globalThis.createImageBitmap = async () => bitmap
    await assert.rejects(readPublicLogo(file))
    assert.equal(bitmap.closed, true)
    bitmap.width = 32; bitmap.closed = false
    let drawn = false
    globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage: () => { drawn = true } }), toDataURL: type => { assert.equal(type, 'image/png'); return 'data:image/png;base64,normalized' } }) }
    assert.equal(await readPublicLogo(file), 'data:image/png;base64,normalized')
    assert.equal(drawn, true); assert.equal(bitmap.closed, true)
  } finally { globalThis.createImageBitmap = original; globalThis.document = document }
})

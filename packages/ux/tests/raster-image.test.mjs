import assert from 'node:assert/strict'
import test from 'node:test'
import { readRasterImage } from '../src/utils/readRasterImage.ts'

test('embedded raster selection retains exact file bytes and rejects remote-capable content', async () => {
  const png = new Uint8Array([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])
  assert.equal(await readRasterImage(new File([png], 'logo.png', { type: 'image/png' })), 'data:image/png;base64,iVBORw0KGgo=')
  const jpeg = new Uint8Array([0xff,0xd8,0xff,0xe0])
  assert.equal(await readRasterImage(new File([jpeg], 'logo.jpg', { type: 'image/jpeg' })), 'data:image/jpeg;base64,/9j/4A==')
  for (const file of [new File(['<svg/>'], 'logo.svg', { type: 'image/svg+xml' }), new File(['fake'], 'logo.png', { type: 'image/png' }), new File([png], 'logo.jpg', { type: 'image/jpeg' }), new File([new Uint8Array(131073)], 'large.png', { type: 'image/png' })]) {
    await assert.rejects(() => readRasterImage(file), /INVALID_DOCUMENT_IMAGE/)
  }
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../../../', import.meta.url)
const files = ['shop-suit-email-mark.png', 'shop-suit-mark-light.svg', 'shop-suit-mark-dark.svg', 'shop-suit-wordmark-light.svg', 'shop-suit-wordmark-dark.svg', 'ledger-suit-app-icon.svg']

test('canonical public asset inputs are readable images before a production build', async () => {
  for (const file of files) {
    const bytes = await readFile(new URL(`packages/brand/assets/${file}`, root))
    assert.ok(bytes.length > 0, file)
    if (file.endsWith('.png')) assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), file)
    else assert.match(bytes.toString('utf8'), /<svg\b[^>]*>/, file)
  }
})

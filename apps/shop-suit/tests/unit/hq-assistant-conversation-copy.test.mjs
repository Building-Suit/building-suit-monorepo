import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import { shopHqAssistantCopy } from '../../app/utils/shopHqAssistantCopy.ts'

for (const arabic of [false, true]) {
  const language = arabic ? 'Arabic' : 'English'
  const copy = shopHqAssistantCopy(arabic)
  test(`${language}: payment follow-up uses actual total, not a fabricated example`, () => {
    const total = arabic ? '٧٥٠٫٥٠ ج.م.' : 'EGP 750.50'
    assert.ok(copy.paymentForTotal(total).includes(total))
    assert.ok(copy.amountMismatch(total).includes(total))
    assert.doesNotMatch(copy.paymentForTotal(total), /300|٣٠٠/)
    assert.match(copy.paymentForTotal(total), arabic ? /لسه ما دفعش/ : /haven’t paid/)
    assert.match(copy.amountMismatch(total), arabic ? /فمأكدتش البيع/ : /haven’t confirmed/)
  })
  test(`${language}: success tells the owner how to use the actual record action`, () => {
    assert.ok(copy.saleRecorded.includes(copy.openReceipt))
    assert.ok(copy.productCreated('Owner product', false).includes(copy.openProduct))
    assert.ok(copy.productCreated('Owner product', false).includes('Owner product'))
    assert.match(copy.productCreated('Owner product', true), arabic ? /من غير سعر/ : /without a price/)
    assert.match(copy.introduction, arabic ? /حدود صلاحياتك/ : /within your permissions/)
  })
}
test('success copy remains projected only from verified receipt/product entry kinds', async () => {
  const source = await readFile(new URL('../../app/composables/useShopHqAssistant.ts', import.meta.url), 'utf8')
  assert.match(source, /entry.kind === 'receipt'[\s\S]*?text: labels.value.saleRecorded/)
  assert.match(source, /entry.kind === 'product'[\s\S]*?productCreated\(entry.link.name, entry.link.pricePending\)/)
  assert.match(source, /\/products\?product=\$\{entry.link.productId\}/)
  assert.match(source, /\/sales\/\$\{entry.link.saleId\}\/receipt/)
})

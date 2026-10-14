// Combined Settings/offline qualification, fixed to the disposable local backend.
import assert from 'node:assert/strict'
import { makeFixture, login, rpc, saleArgs, sql } from './helpers/offline-fixture.mjs'
const fixture = makeFixture({ currency: 'USD' })
const token = await login(fixture)
const args = saleArgs(fixture) // Captured before settings change: immutable pending command.
async function successful(name, input) {
  const result = await rpc(token, name, input)
  assert.ok(result.ok, `${name}: ${result.data?.message}`)
  return result.data
}
const locked = await rpc(token, 'save_business_currency', { p_shop_id: fixture.shopId, p_currency: 'EUR' })
assert.ok(!locked.ok && locked.data.message.includes('SHOP_CURRENCY_LOCKED'))
const settings = await successful('receipt_settings', { p_shop_id: fixture.shopId })
const presentation = { ...settings }
delete presentation.canManage
await successful('save_document_settings', { p_shop_id: fixture.shopId, p_settings: { ...presentation, documentLabel: 'Changed before replay', documentLanguage: 'en', documentDirection: 'ltr', showDescriptions: true, notes: 'Cloud qualification' } })
const invoice = await successful('replay_offline_pos_sale', args)
const input = { p_shop_id: fixture.shopId, p_location_id: fixture.locationId, p_invoice_id: invoice }
const receipt = await successful('get_location_sale_receipt', input)
assert.equal(receipt.currency, 'USD')
assert.equal(receipt.presentation.documentLabel, 'Changed before replay')
assert.equal(receipt.presentation.language, 'en')
assert.equal(Number(receipt.total), 20)
await successful('save_document_settings', { p_shop_id: fixture.shopId, p_settings: { ...presentation, documentLabel: 'Changed after issuance', documentLanguage: 'ar', documentDirection: 'rtl', showDescriptions: false } })
assert.equal(await successful('replay_offline_pos_sale', args), invoice)
assert.deepEqual(await successful('get_location_sale_receipt', input), receipt)
assert.equal(sql(`select count(*) from public.payments where invoice_id='${invoice}' and currency='USD';`), '1')
assert.equal(sql(`select count(*) from public.inventory_movements where reference_id='${invoice}';`), '1')
assert.equal(sql(`select count(*) from public.sale_receipt_issue_snapshots where invoice_id='${invoice}';`), '1')
const precisePrice = 20.29
await successful('save_product', { p_shop_id: fixture.shopId, p_product_id: fixture.productId, p_name: 'Offline cloud product', p_sku: 'OFF-CLOUD', p_barcode: null, p_sale_price: precisePrice })
const preciseArgs = { ...saleArgs(fixture), p_amount: precisePrice }
const preciseInvoice = await successful('replay_offline_pos_sale', preciseArgs)
const preciseReceipt = await successful('get_location_sale_receipt', { ...input, p_invoice_id: preciseInvoice })
assert.equal(Number(preciseReceipt.total), precisePrice)
assert.equal(Number(preciseReceipt.payments[0].amount), precisePrice)
assert.equal(await successful('replay_offline_pos_sale', preciseArgs), preciseInvoice)
console.log('PASS: pending USD command survives rejected currency change; settings are captured at server issuance; later settings and duplicate replay preserve receipt/currency and exactly one payment/stock effect; exact 20.29 sale/payment precision survives replay. Cloud-local authenticated evidence only; fixtures retained.')

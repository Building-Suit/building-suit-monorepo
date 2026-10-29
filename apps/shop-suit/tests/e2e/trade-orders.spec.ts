import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const quoteId = '00000000-0000-4000-8000-000000000111', orderId = '00000000-0000-4000-8000-000000000112'
const snapshot = { quotationNumber: 'Q-00000001', version: 1, currency: 'EGP', customerId: 'customer-1', customerName: 'Contractor customer', projectReference: 'Site A agreement', notes: 'Collection by agreement', validUntil: '2026-12-31T10:00:00Z', orderDiscount: '0', net: '3500', tax: '0', total: '3500', lines: [{ name: 'Agreed cable', quantity: '100', unitPrice: '35', total: '3500', input: { item_type: 'product', source_id: 'product-1', quantity: '100', unit_code: 'm', measurement_revision: 1 }, pricing: null, measurement: { version: 1, productRevision: 1, baseUnitCode: 'm', baseUnitNameEn: 'Meter', baseUnitNameAr: 'متر', baseQuantity: '100', quantityIncrement: '0.001', enteredQuantity: '100', enteredUnitCode: 'm', enteredUnitPrice: '35', packageId: null, packageName: null, packageVersion: null, unitNameEn: 'Meter', unitNameAr: 'متر' } }] }
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
 test(`accepted quotation conversion and lost-response retry ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'; let created = false, loseFirst = true
  const results = new Map<string, object>()
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Contractor order shop', business_mode: 'product', status: 'active' }]
   if (name === 'trade_order_context') {
    const record = { id: orderId, order_number: 'O-00000001', status: 'open', currency: 'EGP', total_amount: '3500', revision: 1, quotation_id: quoteId, quotation_version: 1, customer_name: snapshot.customerName, project_reference: snapshot.projectReference, created_at: '2026-10-23T10:00:00Z', agreed_snapshot: snapshot }
    return { items: args.p_kind === 'quotations' ? created ? [] : [{ id: quoteId, name: 'Q-00000001', project_reference: snapshot.projectReference, currency: 'EGP', total_amount: '3500' }] : created ? [record] : [], total: args.p_kind === 'quotations' ? created ? 0 : 1 : created ? 1 : 0, page: 1, pageSize: 20, canManage: true,
     quotation: args.p_quotation_id ? { id: quoteId, number: 'Q-00000001', revision: created ? 4 : 3, version: 1, status: 'accepted', currency: 'EGP', total: '3500', customerName: snapshot.customerName, projectReference: snapshot.projectReference, orderId: created ? orderId : null } : null,
     detail: args.p_order_id && created ? { record, lines: [], events: [{ id: 'conversion-event', action: 'convert', reason: 'Customer confirms collection order', actor_name: 'Order manager', created_at: record.created_at }], eventCount: 1, historyPage: 1 } : null }
   }
   return undefined
  })
  await fixtureRoute(page, '**/rest/v1/rpc/create_trade_order', async route => {
   const args = route.request().postDataJSON() as Record<string, unknown>; calls.push({ name: 'create_trade_order', args })
   const key = String(args.p_request_id)
   if (!results.has(key)) { created = true; results.set(key, { id: orderId, revision: 1, status: 'open', alreadyConverted: false }) }
   if (loseFirst) { loseFirst = false; await route.fulfill({ status: 503, json: { message: 'Synthetic committed conversion response lost' } }) }
   else await route.fulfill({ json: results.get(key) })
  })
  await fixtureGoto(page, `/orders?quotation=${quoteId}`)
  const editor = page.getByRole('dialog', { name: ar ? 'أمر من عرض مقبول' : 'Order from accepted quotation', exact: true })
  await expect(editor).toContainText('Q-00000001')
  await expect(editor).toContainText('Contractor customer')
  const reason = editor.getByLabel(ar ? 'سبب التحويل' : 'Reason for conversion', { exact: true })
  await reason.fill('Customer confirms collection order')
  const create = editor.getByRole('button', { name: ar ? 'إنشاء الأمر' : 'Create order', exact: true })
  await create.click()
  await expect(editor.getByRole('alert')).toContainText(ar ? 'لم يتأكد التحويل' : 'Conversion is unconfirmed')
  await expect(reason).toBeDisabled()
  await create.click()
  await expect(editor).toHaveCount(0)
  const detail = page.getByRole('dialog', { name: 'O-00000001', exact: true })
  await expect(detail).toContainText('Site A agreement')
  await expect(detail).toContainText('Agreed cable')
  await expect(detail).toContainText('35 EGP')
  const conversions = calls.filter(c => c.name === 'create_trade_order')
  expect(conversions).toHaveLength(2); expect(conversions[0]!.args).toEqual(conversions[1]!.args)
  expect(conversions[0]!.args).toMatchObject({ p_quotation_id: quoteId, p_revision: 3, p_shop_id: 'shop-1', p_location_id: 'location-1', p_reason: 'Customer confirms collection order' })
  expect(results.size).toBe(1)
  expect(calls.some(c => ['save_sale_draft','save_pos_sale_draft','issue_sale','record_customer_receipt','create_supplier_purchase'].includes(c.name))).toBe(false)
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('agreed-order.png'), fullPage: true })
 })
}

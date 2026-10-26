import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

test.use({ actionTimeout: 5000, navigationTimeout: 30000 })

const gtin = '94000000000009'
const label = `(01)${gtin}(3103)000250`
const rawLabel = `]C101${gtin}3103000250`
const product = { id: 'product-weight', name: 'Copper by weight', itemType: 'product', unitPrice: 120, discount: 0, stock: 0.5, barcode: gtin, sku: 'CU-KG', measurement: { baseUnitCode: 'kg', increment: '0.001', revision: 1, saleUnits: ['kg', 'g'], baseUnitPrice: '120', packages: [] } }
const fixed = { id: 'fixed-product', name: 'Fixed barcode item', itemType: 'product', unitPrice: 5, discount: 0, stock: 10, barcode: `(01)${gtin}(3103)000100`, sku: 'FIXED' }
async function scan(page: Page, code: string) {
  await page.keyboard.press('F2')
  await expect(page.locator('#pos-catalog-search')).toBeFocused()
  // Deliver a deterministic rapid keyboard-wedge burst to the real listener.
  // Separate browser-protocol round trips can exceed its80ms scanner gap on CI.
  await page.evaluate(value => {
    const input = document.getElementById('pos-catalog-search')!
    for (const key of [...value, 'Enter']) input.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }, code)
}
for (const locale of ['en', 'ar']) test(`verified weight labels, fixed precedence and checkout retry ${locale}`, async ({ page }) => {
  test.setTimeout(120000)
  const ar = locale === 'ar'
  await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
  await page.addInitScript(dark => localStorage.setItem('building-suit.theme', dark ? 'dark' : 'light'), ar)
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shops') return [{ id: 'shop-1', name: 'Electrical weight merchant', business_mode: 'product', status: 'active' }]
    if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: [product, fixed], total: 2, page: 1, pageSize: 30, businessMode: 'product' }
    if (name === 'pos_catalog_search') return { items: args.p_barcode === fixed.barcode ? [fixed] : [], total: args.p_barcode === fixed.barcode ? 1 : 0, page: 1, pageSize: 2, businessMode: 'product', ambiguousBarcode: false }
    if (name === 'resolve_weight_barcode') return { item: product, quantity: '0.25', availableQuantity: '0.5', unitCode: 'kg', raw: args.p_barcode, gtin, netQuantity: '0.25', weightUnitCode: 'kg' }
    if (name === 'pos_checkout_context') return { staff: [{ id: 'membership-1', name: 'Counter operator' }], customers: [], appointments: [] }
    if (name === 'quote_customer_sale') return { calculationEnabled: false, tradePricingEnabled: false, tax: 0, total: (args.p_lines as { source_id: string; quantity: string }[]).reduce((sum, line) => sum + Number(line.quantity) * (line.source_id === product.id ? 120 : 5), 0), lines: [], offers: [] }
    if (name === 'get_own_pos_receipt') return { version: 1, invoiceId: 'sale-1', invoiceNumber: 'WEIGHT-SALE-1', issuedAt: '2026-10-25T12:00:00Z', currency: 'EGP', business: { name: 'Electrical weight merchant', address: null, phone: null }, location: { name: 'First branch', code: '01', address: null, phone: null }, staffName: 'Counter operator', customer: { name: null, phone: null }, lines: [{ id: 'fixed', itemType: 'product', name: fixed.name, sku: fixed.sku, quantity: 1, unitPrice: 5, discount: 0, total: 5 }, ...['capture-1', 'capture-2'].map(id => ({ id, itemType: 'product', name: product.name, sku: product.sku, quantity: 0.25, unitPrice: 120, discount: 0, total: 30 }))], payments: [{ id: 'payment-1', amount: 65, method: 'cash', reference: null, paidAt: '2026-10-25T12:00:00Z' }], subtotal: 65, discount: 0, total: 65, footer: null, paperSize: 'thermal_80' }
    if (name === 'pos_catalog_offers') return [{ id: 'weight-offer', name: 'Copper quarter-kilo offer', active: true, revision: 1, price: 25, oldPrice: 30, lines: [{ kind: 'product', sourceId: product.id, name: product.name, quantity: 0.25, available: true, stock: 0.5, unitPrice: 120, discount: 0, measurement: product.measurement }] }]
    return undefined
  })
  let attempts = 0
  await fixtureRoute(page, '**/rest/v1/rpc/checkout_pos_sale', async route => {
    calls.push({ name: 'checkout_pos_sale', args: route.request().postDataJSON() })
    attempts++
    await route.fulfill(attempts === 1 ? { status: 503, json: { message: 'Synthetic committed checkout response lost' } } : { json: 'sale-1' })
  })
  await fixtureGoto(page, '/pos')
  await scan(page, fixed.barcode)
  if (ar) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  const cart = page.locator('.bs-pos-cart')
  await expect(cart).toContainText(fixed.name)
  expect(calls.filter(c => c.name === 'resolve_weight_barcode')).toHaveLength(0)
  await scan(page, label)
  if (ar) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  await expect(cart).toContainText(product.name)
  const captured = cart.getByRole('spinbutton', { name: `${ar ? 'الكمية' : 'Quantity'}: ${product.name}`, exact: true })
  await expect(captured).toHaveValue('0.25')
  await expect(captured).toBeDisabled()
  await expect(cart.getByRole('combobox', { name: ar ? 'وحدة البيع' : 'Sale unit', exact: true })).toBeDisabled()
  await expect(cart).toContainText(ar ? 'وزن محفوظ من الملصق' : 'Weight retained from the label')
  await scan(page, rawLabel)
  if (ar) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  await expect(captured).toHaveCount(2)
  await scan(page, label)
  if (ar) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  await expect(captured).toHaveCount(2)
  await expect(page.getByRole('alert').filter({ hasText: ar ? 'مخزون المنتجات في الفرع ده لا يكفي لإصدار البيعة.' : /stock/i })).toBeVisible()
  await page.locator('.bs-offer-strip__card').filter({ has: page.getByRole('heading', { name: 'Copper quarter-kilo offer', exact: true }) }).getByRole('button').click()
  await expect(captured).toHaveCount(2)
  expect((calls.filter(c => c.name === 'quote_customer_sale').at(-1)!.args.p_lines as unknown[])).toHaveLength(3)
  await page.keyboard.press('F2')
  await page.locator('.bs-catalog-tile').filter({ hasText: product.name }).getByRole('button', { name: /Add:|إضافة:/ }).first().click()
  if (ar) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  await expect(captured).toHaveCount(2)
  await expect(page.getByRole('alert').filter({ hasText: ar ? 'مخزون المنتجات في الفرع ده لا يكفي لإصدار البيعة.' : /stock/i })).toBeVisible()
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('verified-weight-cart.png'), fullPage: true })
  await page.keyboard.press('F4')
  await page.getByRole('button', { name: ar ? 'بدون عميل — بيع كاونتر مسدد بالكامل' : 'No customer — fully paid counter sale', exact: true }).click()
  await expect(cart.getByRole('button', { name: ar ? /^حصّل / : /^Pay / })).toBeEnabled()
  await page.keyboard.press('F8')
  await expect.poll(() => attempts).toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(cart.getByRole('button', { name: ar ? /^حصّل / : /^Pay / })).toBeEnabled()
  await page.keyboard.press('F8')
  await expect(page.getByRole('dialog').locator('[data-receipt-document]')).toContainText('WEIGHT-SALE-1')
  await expect(page).toHaveURL(/\/pos$/)
  const saves = calls.filter(c => c.name === 'save_pos_sale_draft')
  expect(saves).toHaveLength(2)
  expect(saves[0]!.args).toEqual(saves[1]!.args)
  const lines = saves[0]!.args.p_lines as Array<{ quantity: string; measurement_capture?: { id: string; kind: string; raw: string } }>
  expect(lines).toHaveLength(3)
  expect(lines[0]!.measurement_capture).toBeUndefined()
  expect(lines.slice(1).map(l => l.quantity)).toEqual(['0.25', '0.25'])
  expect(lines.slice(1).map(l => l.measurement_capture?.raw)).toEqual([label, rawLabel])
  expect(lines[1]!.measurement_capture!.id).not.toBe(lines[2]!.measurement_capture!.id)
  expect(lines[1]!.measurement_capture).toMatchObject({ kind: 'gs1', id: expect.stringMatching(/^[0-9a-f-]{36}$/) })
  const checkouts = calls.filter(c => c.name === 'checkout_pos_sale')
  expect(checkouts).toHaveLength(2)
  expect(checkouts[0]!.args).toEqual(checkouts[1]!.args)
})

test('invalid, unverified and malformed weight labels cannot create a cart line', async ({ page }) => {
  test.setTimeout(60000)
  const { calls } = await pilotFixture(page, 'en', 'owner', (name, args) => {
    if (name === 'shops') return [{ id: 'shop-1', name: 'Weight merchant', business_mode: 'product', status: 'active' }]
    if (name === 'shop_catalog_media' && args.p_action === 'pos' || name === 'pos_catalog_search') return { items: [], total: 0, page: 1, pageSize: 30, businessMode: 'product' }
    if (name === 'resolve_weight_barcode') return { raw: label, item: product, quantity: '0.3', availableQuantity: '10', unitCode: 'kg', gtin, netQuantity: '0.25', weightUnitCode: 'kg' }
    if (name === 'pos_checkout_context') return { staff: [{ id: 'membership-1', name: 'Counter operator' }], customers: [], appointments: [] }
    return undefined
  })
  await fixtureGoto(page, '/pos')
  await scan(page, `(01)94000000000008(3103)000250`)
  await expect(page.getByRole('alert').filter({ hasText: 'Could not verify the label weight' })).toBeVisible()
  expect(calls.filter(c => c.name === 'resolve_weight_barcode')).toHaveLength(0)
  await scan(page, '2712345000250')
  await expect(page.locator('p').filter({ hasText: /Barcode 2712345000250 was not found/ })).toBeVisible()
  expect(calls.filter(c => c.name === 'resolve_weight_barcode')).toHaveLength(0)
  await scan(page, label)
  await expect.poll(() => calls.filter(c => c.name === 'resolve_weight_barcode').length).toBe(1)
  await expect(page.locator('.bs-pos-cart').getByRole('spinbutton')).toHaveCount(0)
  await expect(page.getByRole('alert').filter({ hasText: 'Could not verify the label weight' })).toBeVisible()
  expect(calls.some(c => c.name === 'save_pos_sale_draft')).toBe(false)
  await page.context().setOffline(true)
  await scan(page, rawLabel)
  await expect(page.locator('p').filter({ hasText: 'Connect to verify the weight label, or enter the measured quantity manually.' })).toBeVisible()
  await expect(page.locator('.bs-pos-cart').getByRole('spinbutton')).toHaveCount(0)
  expect(calls.filter(c => c.name === 'resolve_weight_barcode')).toHaveLength(1)
  await page.context().setOffline(false)
})

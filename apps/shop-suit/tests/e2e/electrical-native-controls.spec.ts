import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { addElectricalItem } from './electrical-native-controls'

// Explicit synthetic UI-driver regression, never native financial acceptance.
for (const locale of ['en', 'ar']) test(`native electrical item driver handles all three measured lines: ${locale}`, async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const products = [
    { id: 'cable', name: 'Native blue cable 2.5 mm²', unitPrice: 35, unit: 'm', increment: '0.001', units: ['m', 'cm'], stock: 200 },
    { id: 'copper', name: 'Native copper material', unitPrice: 200, unit: 'kg', increment: '0.001', units: ['kg', 'g'], stock: 5 },
    { id: 'breaker', name: 'Native breaker 20A', unitPrice: 150, unit: 'ea', increment: '1', units: ['ea'], stock: 10 },
  ]
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
    if (name === 'shops') return [{ id: 'shop-1', name: 'Synthetic control qualification', business_mode: 'mixed', status: 'active' }]
    if (name === 'shop_catalog_media' && args.p_action === 'pos') return {
      items: products.map(product => ({ ...product, itemType: 'product', discount: 0, sku: product.id, barcode: null, measurement: { baseUnitCode: product.unit, increment: product.increment, revision: 1, saleUnits: product.units, baseUnitPrice: String(product.unitPrice), packages: [] } })),
      total: 3, page: 1, pageSize: 30, businessMode: 'mixed',
    }
    if (name === 'pos_checkout_context') return { staff: [{ id: 'membership-1', name: 'Synthetic cashier' }], customers: [], appointments: [] }
    if (name === 'pos_catalog_offers') return []
    if (name === 'quote_customer_sale') return { calculationEnabled: false, tradePricingEnabled: false, tax: 0, total: 787.5, lines: [], offers: [] }
  })
  await fixtureGoto(page, '/pos')
  await addElectricalItem(page, locale, products[0]!, '12.5')
  await addElectricalItem(page, locale, products[1]!, '250', true)
  await addElectricalItem(page, locale, products[2]!, '2')
  await expect.poll(() => calls.filter(call => call.name === 'quote_customer_sale').at(-1)?.args.p_lines).toEqual([
    { item_type: 'product', source_id: 'cable', quantity: '12.5', unit_code: 'm', measurement_revision: 1 },
    { item_type: 'product', source_id: 'copper', quantity: '250', unit_code: 'g', measurement_revision: 1 },
    { item_type: 'product', source_id: 'breaker', quantity: '2', unit_code: 'ea', measurement_revision: 1 },
  ])
  await page.keyboard.press('F4')
  await page.getByRole('button', { name: locale === 'ar' ? 'بدون عميل — بيع كاونتر مسدد بالكامل' : 'No customer — fully paid counter sale', exact: true }).click()
  await expect(page.locator('.bs-pos-cart').getByRole('button', { name: locale === 'ar' ? /^حصّل / : /^Pay / })).toBeEnabled()
  await page.keyboard.press('F8')
  await expect.poll(() => calls.filter(call => call.name === 'checkout_pos_sale').map(call => call.args.p_amount)).toEqual([787.5])
  await expect(page.getByRole('dialog', { name: locale === 'ar' ? 'إيصال بيع' : 'Sales Receipt', exact: true })).toBeVisible()
  await expect.poll(() => calls.some(call => call.name === 'get_own_pos_receipt' && call.args.p_invoice_id === 'sale-1')).toBe(true)
})

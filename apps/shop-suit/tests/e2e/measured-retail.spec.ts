import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const measurement = { baseUnitCode: 'm', increment: '0.001', revision: 1, saleUnits: ['m', 'cm'], baseUnitPrice: '35', packages: [{ id: 'reel-1', code: 'R100', name: '100 m reel', unitCode: 'reel', baseQuantity: '100', containedQuantity: '100', containedUnitCode: 'm', version: 1, salePrice: 3200, barcode: 'R100', canSell: true, canPurchase: true, defaultPurchase: true }] }
const product = { id: 'product-1', name: 'Blue cable 2.5 mm²', itemType: 'product', unitPrice: 35, sale_price: 35, discount: 0, stock: 200, sku: 'BLUE-2.5', barcode: 'CABLE', measurement }
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
 test(`measured cart and immutable product settings ${locale} ${theme} ${width}`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), theme)
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Electrical shop', business_mode: 'mixed', status: 'active' }]
   if (name === 'shop_permission_access') return { 'products.manage': true }
   if (name === 'list_catalog_categories') return []
   if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: [product], total: 1, page: 1, pageSize: 30, businessMode: 'mixed' }
   if (name === 'shop_catalog_media' && args.p_action === 'products') return { supportsTechnicalDetails: true, supportsMeasurements: true, items: [product], total: 1, page: 1, pageSize: 20 }
   if (name === 'product_technical_options') return { revision: 1, familyId: 'family-1', familyName: 'Cable family', reelTracking: true, trackingLocked: true, reelReturnPolicy: { unopenedResellable: true, cutRequiresManagerApproval: true }, attributes: { cross_section_mm2: '2.5' }, definitions: [{ code: 'cross_section_mm2', nameEn: 'Cross-section', nameAr: 'مساحة المقطع', type: 'number', unit: 'mm²' }] }
   if (name === 'product_measurement_options') return { ...measurement, status: 'active', locked: true }
   if (name === 'pos_checkout_context') return { staff: [{ id: 'member-1', name: 'Cashier' }], customers: [], appointments: [] }
   if (name === 'quote_pos_sale') {
    const lines = args.p_lines as { quantity: string; unit_code?: string; package_id?: string }[]
    return { calculationEnabled: false, tax: 0, total: lines.reduce((sum, line) => sum + Number(line.quantity) * (line.package_id ? 3200 : line.unit_code === 'cm' ? .35 : 35), 0), lines: [], offers: [] }
   }
   if (name === 'pos_catalog_offers') return []
   return undefined
  })
  const ar = locale === 'ar'
  await fixtureGoto(page, '/pos')
  await page.locator('.bs-catalog-tile').click()
  if (width < 1024) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  const cart = page.locator('.bs-pos-cart')
  const quantity = cart.getByRole('spinbutton')
  await quantity.fill('12.5'); await quantity.blur()
  await expect(cart).toContainText(ar ? '12.5 متر' : '12.5 Meter')
  await expect.poll(() => calls.filter(call => call.name === 'quote_pos_sale').at(-1)?.args.p_lines).toEqual([{ item_type: 'product', source_id: 'product-1', quantity: '12.5', unit_code: 'm', measurement_revision: 1 }])
  await cart.getByRole('combobox').click()
  await page.getByRole('option', { name: ar ? 'سنتيمتر' : 'Centimeter', exact: true }).click()
  await quantity.fill('250'); await quantity.blur()
  await expect(cart).toContainText(ar ? '2.5 متر' : '2.5 Meter')
  await expect.poll(() => calls.filter(call => call.name === 'quote_pos_sale').at(-1)?.args.p_lines).toEqual([{ item_type: 'product', source_id: 'product-1', quantity: '250', unit_code: 'cm', measurement_revision: 1 }])
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('measured-cart.png'), fullPage: true })
  // Navigating away exercises the shared dirty-state controller before editing.
  await fixtureGoto(page, '/products')
  await page.getByRole('button', { name: ar ? 'تعديل' : 'Edit', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('combobox', { name: ar ? 'وحدة المخزون وسعر البيع' : 'Stock and sale-price unit', exact: true })).toBeDisabled()
  await expect(dialog.getByLabel(ar ? 'أصغر كمية مسموحة' : 'Smallest allowed quantity', { exact: true })).toHaveValue('0.001')
  await expect(dialog).toContainText('100 m reel')
  await expect(dialog.getByLabel(ar ? 'عائلة المتغيرات (اختياري)' : 'Variant family (optional)', { exact: true })).toHaveValue('Cable family')
  await expect(dialog.getByLabel(ar ? 'مساحة المقطع' : 'Cross-section', { exact: true })).toHaveValue('2.5')
  await expect(dialog.getByRole('checkbox', { name: ar ? 'تتبع البكرات المنفردة' : 'Track individual reels', exact: true })).toBeDisabled()
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('measured-settings.png'), fullPage: true })
 })
}

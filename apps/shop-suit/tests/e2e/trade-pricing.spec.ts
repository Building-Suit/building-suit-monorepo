import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const measurement = { baseUnitCode: 'm', increment: '0.001', revision: 1, saleUnits: ['m', 'cm'], baseUnitPrice: '35', packages: [] }
const product = { id: 'product-1', name: 'Trade cable 2.5 mm²', itemType: 'product', unitPrice: 35, sale_price: 35, discount: 0, stock: 1000, sku: 'TRADE-2.5', barcode: 'TRADE', measurement }
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
 test(`group retry, assignment and exact price rule ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), theme)
  const groups: { id: string; name: string; active: boolean; revision: number }[] = []
  const rules: Record<string, unknown>[] = []
  const requests = new Map<string, { id: string; revision: number }>()
  let loseFirstResponse = true
  const save = (args: Record<string, unknown>) => {
    const key = String(args.p_request_id), payload = args.p_payload as Record<string, string | number | boolean | null>
    let result = requests.get(key)
    if (!result) {
     result = { id: args.p_action === 'price' ? 'rule-1' : args.p_action === 'group' ? 'group-1' : 'customer-1', revision: 1 }
     requests.set(key, result)
     if (args.p_action === 'group') groups.push({ ...result, name: String(payload.name), active: true })
     if (args.p_action === 'price') rules.push({ ...result, product_id: product.id, product_name: product.name, customer_id: null, customer_name: null, group_id: null, group_name: null, stock_unit_code: 'm', unit_code: payload.unitCode, package_id: null, package_name: null, minimum_quantity: payload.minimumQuantity, unit_price: payload.price, starts_at: payload.startsAt, ends_at: null, priority: payload.priority, active: true })
    }
    return result
  }
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Trade shop', business_mode: 'mixed', status: 'active' }]
   if (name === 'shop_permission_access') return { 'products.manage': true }
   if (name === 'list_products') return { items: [product], total: 1, page: 1, pageSize: 20 }
   if (name === 'list_customers') return { items: [{ id: 'customer-1', name: 'Contractor customer' }], total: 1, page: 1, pageSize: 20 }
   if (name === 'product_measurement_options') return { ...measurement, status: 'active', locked: false }
   if (name === 'trade_pricing_context') {
    const items = args.p_kind === 'price' ? rules : args.p_kind === 'history' ? [] : groups
    return { items, total: items.length, page: 1, pageSize: 20, groups, assignment: null, canManageGroups: true, canManagePrices: true }
   }
   if (name === 'save_trade_configuration') return save(args)
   return undefined
  })
  await fixtureRoute(page, '**/rest/v1/rpc/save_trade_configuration', async route => {
   const args = route.request().postDataJSON() as Record<string, unknown>
   calls.push({ name: 'save_trade_configuration', args })
   const result = save(args)
   if (loseFirstResponse) { loseFirstResponse = false; await route.fulfill({ status: 503, json: { message: 'Synthetic committed response lost' } }) }
   else await route.fulfill({ json: result })
  })
  await fixtureGoto(page, '/trade-pricing')
  await page.getByRole('button', { name: ar ? 'إضافة' : 'Add', exact: true }).click()
  const dialog = page.getByRole('dialog')
  const groupName = dialog.getByLabel(ar ? 'الاسم' : 'Name', { exact: true })
  await groupName.fill('Contractors')
  await dialog.getByLabel(ar ? 'سبب التغيير' : 'Reason for change', { exact: true }).fill('Create contractor group')
  await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await expect(dialog).toContainText(ar ? 'لم يتأكد الحفظ' : 'Save is unconfirmed')
  await expect(groupName).toBeDisabled()
  const first = calls.find(call => call.name === 'save_trade_configuration')!.args
  await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.filter(call => call.name === 'save_trade_configuration').map(call => call.args)).toEqual([first, first])
  expect(groups).toHaveLength(1)
  await expect(page.getByRole('table')).toContainText('Contractors')
  await page.getByRole('button', { name: ar ? 'تعيين مجموعة عميل' : 'Assign customer group', exact: true }).click()
  await dialog.getByRole('combobox', { name: ar ? 'العميل' : 'Customer', exact: true }).click()
  await page.getByRole('option', { name: 'Contractor customer', exact: true }).click()
  await dialog.getByRole('combobox', { name: ar ? 'المجموعة' : 'Group', exact: true }).click()
  await page.getByRole('option', { name: 'Contractors', exact: true }).click()
  await dialog.getByLabel(ar ? 'سبب التغيير' : 'Reason for change', { exact: true }).fill('Assign negotiated customer group')
  await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.filter(call => call.name === 'save_trade_configuration').at(-1)!.args).toMatchObject({ p_action: 'assignment', p_payload: { customerId: 'customer-1', groupId: 'group-1', revision: 0 } })
  await page.getByRole('tab', { name: ar ? 'قواعد الأسعار' : 'Price rules', exact: true }).click()
  await page.getByRole('button', { name: ar ? 'إضافة' : 'Add', exact: true }).click()
  await dialog.getByRole('combobox', { name: ar ? 'المنتج' : 'Product', exact: true }).click()
  await page.getByRole('option', { name: product.name, exact: true }).click()
  await dialog.getByLabel(new RegExp(ar ? '^الحد الأدنى بوحدة المخزون' : '^Minimum stock quantity')).fill('100')
  await dialog.getByLabel(ar ? 'السعر' : 'Price', { exact: true }).fill('33.125')
  await dialog.getByLabel(ar ? 'سبب التغيير' : 'Reason for change', { exact: true }).fill('Approved quantity tier')
  await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  expect(calls.filter(call => call.name === 'save_trade_configuration').at(-1)!.args).toMatchObject({ p_action: 'price', p_payload: { productId: product.id, minimumQuantity: '100', price: '33.125', unitCode: 'm', revision: 0 } })
  await expect(page.getByRole('table')).toContainText('33.125')
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('trade-prices.png'), fullPage: true })
 })
 test(`POS uses quoted prices and clears unit-specific approval on a unit change ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), theme)
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Trade shop', business_mode: 'mixed', status: 'active' }]
   if (name === 'shop_permission_access') return { 'products.manage': true }
   if (name === 'list_catalog_categories') return []
   if (name === 'pos_checkout_context') return { staff: [{ id: 'membership-1', name: 'Manager' }], customers: [], appointments: [] }
   if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: [product], total: 1, page: 1, pageSize: 30, businessMode: 'mixed' }
   if (name === 'pos_catalog_offers') return []
   if (name === 'quote_customer_sale') {
    const input = (args.p_lines as { quantity: string; override_price?: string }[])[0]!
    const total = Number(input.override_price ?? '31') * Number(input.quantity)
    return { total, net: total, tax: 0, calculationEnabled: false, tradePricingEnabled: true, tradePricingApplied: true, lines: [{ total, pricing: { source: input.override_price ? 'staff_override' : 'customer_group' } }], offers: [] }
   }
   return undefined
  })
  await fixtureGoto(page, '/pos')
  await page.getByRole('button', { name: new RegExp(product.name) }).first().click()
  if (width < 1024) await page.getByRole('button', { name: /Review sale|مراجعة البيع/ }).click()
  const cart = page.locator('.bs-pos-cart')
  await expect(cart).toContainText(ar ? 'سعر مجموعة العميل' : 'Customer group price')
  const approval = cart.getByLabel(ar ? 'سعر معتمد لوحدة البيع (EGP)' : 'Approved price per sale unit (EGP)', { exact: true })
  await approval.fill('30.25')
  await cart.getByLabel(ar ? 'سبب تعديل السعر' : 'Price adjustment reason', { exact: true }).fill('Approved cable quote')
  await expect.poll(() => (calls.filter(call => call.name === 'quote_customer_sale').at(-1)!.args.p_lines as unknown[])[0]).toMatchObject({ override_price: '30.25', override_reason: 'Approved cable quote' })
  await cart.getByRole('combobox').click()
  await page.getByRole('option', { name: ar ? 'سنتيمتر' : 'Centimeter', exact: true }).click()
  await expect(approval).toHaveValue('')
  await expect.poll(() => (calls.filter(call => call.name === 'quote_customer_sale').at(-1)!.args.p_lines as { override_price?: string }[])[0]?.override_price).toBeUndefined()
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('trade-pos.png'), fullPage: true })
 })
}

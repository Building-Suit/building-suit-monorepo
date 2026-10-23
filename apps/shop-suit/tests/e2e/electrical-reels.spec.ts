import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
const measurement = { reelTracking: true, baseUnitCode: 'm', increment: '0.001', revision: 1, saleUnits: ['m'], baseUnitPrice: '35', packages: [] }
const summary = { reelCount: 2, available: '100', largestContinuous: '50', largestAutomatic: '50', automaticAvailable: '100', baseUnitCode: 'm' }
for (const [locale, theme, width] of [['en','light',1440],['ar','dark',390]] as const) {
 test(`physical stock count and explicit cable cut ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width, height: 1000 })
  await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), theme)
  const reel = { id: 'reel-1', productId: 'product-1', name: 'Blue cable', sku: 'BLUE', barcode: 'SOURCE-1', unit: 'm', originalLength: '50', remainingLength: '50', reservedLength: '0', status: 'sealed', classification: 'sellable', storagePosition: 'A2', revision: 3, remnantPrice: null, lastMovementAt: '2026-10-22T12:00:00Z', value: 1250 }
  const { calls } = await pilotFixture(page,locale,'owner',(name,args) => {
   if (name === 'list_products') return { items: [], total: 0 }
   if (name === 'shops') return [{ id: 'shop-1', name: 'Electrical shop', business_mode: 'mixed', status: 'active' }]
   if (name === 'inventory_reel_context') return { items: [reel], total: 1, page: 1, pageSize: 20, canManage: true, canCount: true, canSetPrices: true, canViewCosts: true, summary, history: args.p_reel_id ? [{ id: 'event-1', kind: 'receipt', quantityChange: '50', valueChange: 1250, reason: 'Received sealed reel', createdAt: '2026-10-22T12:00:00Z', actorName: 'Owner', snapshot: {} }] : [], historyTotal: args.p_reel_id ? 1 : 0 }
   if (name === 'update_inventory_reel') { reel.remainingLength = String((args.p_values as { quantity: string }).quantity); reel.revision++; return 'operation-1' }
   if (name === 'pos_reel_options') return { items: [{ id: 'reel-1', barcode: 'SOURCE-1', remainingLength: '50', originalLength: '50', status: 'sealed', classification: 'sellable', price: null, storagePosition: 'A2', revision: 3 }], total: 1, page: 1, pageSize: 20, summary }
   if (name === 'shop_catalog_media' && args.p_action === 'pos') return { items: [{ id: 'product-1', itemType: 'product', name: 'Blue cable', unitPrice: 35, discount: 0, stock: 100, measurement, reelSummary: summary }], total: 1, page: 1, pageSize: 30, businessMode: 'mixed' }
   if (name === 'pos_checkout_context') return { staff: [{ id: 'member-1', name: 'Cashier' }], customers: [], appointments: [] }
   if (name === 'quote_customer_sale') return { calculationEnabled: false, tradePricingEnabled: false, tax: 0, total: 437.5, lines: [], offers: [] }
   if (name === 'pos_catalog_offers') return []
   return undefined
  })
  await fixtureGoto(page,'/inventory/reels')
  await expect(page.getByRole('heading',{ name: ar ? 'البكرات والقطع' : 'Reels & cuts', exact: true })).toBeVisible()
  await expect(page.getByText('SOURCE-1',{ exact: true })).toBeVisible()
  await page.getByRole('button',{ name: ar ? 'السجل' : 'History', exact: true }).click()
  await expect(page.getByText('Received sealed reel',{ exact: true })).toBeVisible()
  await page.getByRole('button',{ name: ar ? 'جرد البكرة' : 'Count reel', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(ar ? 'الطول المعدود (متر)' : 'Counted length (Meter)',{ exact: true }).fill('49.975')
  await dialog.getByLabel(ar ? 'مرجع الجرد' : 'Count reference',{ exact: true }).fill('COUNT-1')
  await dialog.getByLabel(ar ? 'السبب' : 'Reason',{ exact: true }).fill('Measured reel count')
  await dialog.getByRole('button',{ name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await expect(dialog).not.toBeVisible()
  const command = calls.find(call => call.name === 'update_inventory_reel')?.args
  expect(command).toMatchObject({ p_reel_id: 'reel-1', p_revision: 3, p_action: 'count', p_values: { quantity: '49.975', reference: 'COUNT-1' }, p_reason: 'Measured reel count' })
  expect(command?.p_request_id).toMatch(/^[0-9a-f-]{36}$/)
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('physical-reels.png'),fullPage: true })
  await fixtureGoto(page,'/pos')
  await page.locator('.bs-catalog-tile').click()
  if (width<1024) await page.getByRole('button',{ name: /Review sale|مراجعة البيع/ }).click()
  const cart = page.locator('.bs-pos-cart')
  await cart.getByRole('spinbutton').fill('12.5');await cart.getByRole('spinbutton').blur()
  await cart.getByLabel(ar ? 'فاقد القطع (متر)' : 'Cutting loss (Meter)',{ exact: true }).fill('0.02')
  await cart.getByRole('checkbox').check()
  await expect.poll(() => calls.filter(call => call.name === 'quote_customer_sale').at(-1)?.args.p_lines).toEqual([{ item_type: 'product', source_id: 'product-1', quantity: '12.5', unit_code: 'm', measurement_revision: 1, allow_split: true, cutting_loss: '0.02' }])
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('physical-cart.png'),fullPage: true })
 })
 test(`supplier return chooses a reel from its purchase ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'
  await page.setViewportSize({ width, height: 1000 })
  const purchase = { id: 'purchase-1', vendorId: 'vendor-1', vendorNameSnapshot: 'Cable supplier', invoiceNumber: 'CABLE-BILL', status: 'posted', issuedAt: '2026-10-22T12:00:00Z', totalAmount: 1250, payable: 1250, settlementState: 'unpaid', notes: null, createdAt: '2026-10-22T12:00:00Z', canManagePurchases: true, canRecordPayment: true, canReversePayment: true, canRecordCredit: true, canReturnStock: true, items: [{ id: 'item-1', productId: 'product-1', productName: 'Blue cable', reelTracking: true, quantity: 50, unitCost: 25, totalCost: 1250, availableToReturn: 50, batchId: 'batch-1', measurement: { enteredQuantity: '50', enteredUnitPrice: '25', baseUnitCode: 'm', quantityIncrement: '0.001', unitNameEn: 'Meter', unitNameAr: 'متر' } }], paymentEvents: [], credits: [], returns: [], receiptMovements: [] }
  const { calls } = await pilotFixture(page,locale,'owner',(name) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Electrical shop', business_mode: 'mixed', status: 'active' }]
   if (name === 'get_purchase') return purchase
   if (name === 'purchase_reel_options') return { items: [{ id: 'source-2', barcode: 'BILL-REEL-2', remainingLength: '50' }], total: 1, page: 1 }
   if (name === 'record_purchase_return') return 'return-1'
   return undefined
  })
  await fixtureGoto(page,'/purchases/purchase-1')
  await page.getByRole('button',{ name: ar ? 'تسجيل مرتجع مخزون' : 'Return available stock', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('spinbutton').fill('2.5')
  await dialog.getByRole('combobox',{ name: ar ? 'البكرة المصدر' : 'Source reel', exact: true }).click()
  await page.getByRole('option',{ name: 'BILL-REEL-2 · 50', exact: true }).click()
  await dialog.getByLabel(ar ? 'السبب' : 'Reason',{ exact: true }).fill('Supplier selected reel')
  await dialog.getByRole('button',{ name: ar ? 'حفظ' : 'Save', exact: true }).click()
  await page.getByRole('dialog',{ name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button',{ name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
  await expect.poll(() => calls.find(call => call.name === 'record_purchase_return')?.args.p_items).toEqual([{ vendor_invoice_item_id: 'item-1', quantity: 2.5, reel_id: 'source-2' }])
  await expectNoPageOverflow(page)
 })

}

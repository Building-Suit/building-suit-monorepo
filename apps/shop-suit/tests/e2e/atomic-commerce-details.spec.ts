import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`supplier detail payment and immutable reversal: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const purchase = { id: 'purchase-1', vendorId: 'vendor-1', vendorNameSnapshot: 'Fixture supplier', invoiceNumber: 'BILL-1', status: 'posted', issuedAt: '2026-10-01T12:00:00Z', totalAmount: 100, payable: 100, settlementState: 'unpaid', notes: null, createdAt: '2026-10-01T12:00:00Z', canManagePurchases: true, canRecordPayment: true, canReversePayment: true, canRecordCredit: true, canReturnStock: true, items: [{ id: 'item-1', productId: 'product-1', productName: 'Fixture stock', quantity: 2, unitCost: 50, totalCost: 100, availableToReturn: 2, batchId: 'batch-1' }], paymentEvents: [] as { id: string; eventType: string; paymentId: string; allocationId: string; amount: number; eventAt: string; method: string; remainingEffective: number; reason?: string }[], credits: [], returns: [], receiptMovements: [{ id: 'movement-1', productId: 'product-1', batchId: 'batch-1', quantityChange: 2, unitCostSnapshot: 50, createdAt: '2026-10-01T12:00:00Z', referenceId: 'purchase-1' }] }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'shops') return [{ id: 'shop-1', name: 'Fixture shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
      if (name === 'get_purchase') return purchase
      if (name === 'record_supplier_payment') { purchase.payable = 75; purchase.settlementState = 'partial'; purchase.paymentEvents.push({ id: 'event-1', eventType: 'payment', paymentId: 'payment-1', allocationId: 'allocation-1', amount: 25, eventAt: String(args.p_paid_at), method: 'cash', remainingEffective: 25 }); return 'payment-1' }
      if (name === 'reverse_supplier_payment') { purchase.payable = 100; purchase.paymentEvents[0]!.remainingEffective = 0; purchase.paymentEvents.push({ ...purchase.paymentEvents[0]!, id: 'event-2', eventType: 'reversal', amount: 25, reason: String(args.p_reason) }); return 'reversal-1' }
      return undefined
    })
    await fixtureGoto(page, '/purchases/purchase-1')
    await expect(page.getByRole('heading', { name: ar ? 'تفاصيل فاتورة المورد' : 'Supplier bill detail' })).toBeVisible()
    await page.getByRole('button', { name: ar ? 'تسجيل دفعة' : 'Record payment', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true }).fill('25')
    await dialog.getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    const confirm = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
    await confirm.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'record_supplier_payment')?.args).toMatchObject({ p_shop_id: 'shop-1', p_vendor_id: 'vendor-1', p_amount: 25, p_allocations: [{ vendor_invoice_id: 'purchase-1', amount: 25 }] })
    await page.getByRole('button', { name: ar ? 'عكس' : 'Reverse', exact: true }).click()
    await page.getByRole('dialog').getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Reviewed payment correction')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'reverse_supplier_payment')?.args).toMatchObject({ p_shop_id: 'shop-1', p_original_payment_id: 'payment-1', p_reason: 'Reviewed payment correction', p_allocations: [{ allocation_id: 'allocation-1', amount: 25 }] })
    expect(purchase.paymentEvents).toHaveLength(2)
    const lineRow = page.getByRole('row').filter({ hasText: 'Fixture stock' }).first()
    await expect(lineRow).toContainText(/50|٥٠/)
    await expect(lineRow).toContainText(/100|١٠٠/)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/purchase-detail-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
  test(`sale detail receipt and reasoned full correction: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const sale = { id: 'sale-1', invoice_number: 'SALE-1', status: 'issued', created_at: '2026-10-01T12:00:00Z', issued_at: '2026-10-01T12:00:00Z', total_amount: 100, discount_amount: 0, notes: null, client_id: 'customer-1', client_name_snapshot: 'Fixture customer', client_phone_snapshot: null, client_email_snapshot: null, client_address_snapshot: null, due_date: null, amountPaid: 0, outstanding: 100, settlementState: 'unpaid', overdue: false, canManage: true, canIssue: true, canReceivePayment: true, canReversePayment: true, canRefundPayment: true, lines: [{ id: 'line-1', item_type: 'product', item_name: 'Fixture stock', quantity: 2, unit_price: 50, discount_amount: 0, total_amount: 100, product_id: 'product-1', service_id: null, product_sku_snapshot: 'SKU-1' }], movements: [{ id: 'movement-1', productId: 'product-1', invoiceItemId: 'line-1', batchId: 'batch-1', quantityChange: -2, unitCostSnapshot: 40, createdAt: '2026-10-01T12:00:00Z' }], payments: [] as { id: string; eventType: string; paymentId: string; allocationId: string; amount: number; eventAt: string; method: string; reference: null; remainingEffective: number }[] }
    const state = { canCorrect: true, partialReturnsAvailable: false, correction: null as null | { id: string; kind: string; effectiveAt: string; reason: string; reference: null; refundAmount: number; restoredQuantity: number } }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'get_location_sale') return sale
      if (name === 'get_location_sale_receipt') return null
      if (name === 'sale_correction_state') return state
      if (name === 'sale_return_context') return { version: 1, canReturn: false, supported: false, due: sale.outstanding, currency: 'EGP', totalCount: 0, lines: [], history: [] }
      if (name === 'record_location_customer_receipt') { sale.outstanding = 75; sale.amountPaid = 25; sale.settlementState = 'partial'; sale.payments.push({ id: 'event-1', eventType: 'receipt', paymentId: 'payment-1', allocationId: 'allocation-1', amount: 25, eventAt: String(args.p_paid_at), method: 'cash', reference: null, remainingEffective: 25 }); return 'payment-1' }
      if (name === 'correct_location_sale') { state.canCorrect = false; state.correction = { id: 'correction-1', kind: 'full_return', effectiveAt: String(args.p_effective_at), reason: String(args.p_reason), reference: null, refundAmount: 25, restoredQuantity: 2 }; sale.outstanding = 0; return 'correction-1' }
      return undefined
    })
    await fixtureGoto(page, '/sales/sale-1')
    await expect(page.getByRole('heading', { name: 'SALE-1', exact: true })).toBeVisible()
    await page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true }).click()
    await page.getByRole('dialog').getByLabel(ar ? 'المبلغ' : 'Amount', { exact: true }).fill('25')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'record_location_customer_receipt')?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_customer_id: 'customer-1', p_amount: 25, p_allocations: [{ invoice_id: 'sale-1', amount: 25 }] })
    // Localized correction action text comes from the product copy, as in production.
    const correctionAction = page.getByRole('button', { name: ar ? 'إلغاء / إرجاع كامل' : 'Void / full return', exact: true })
    await correctionAction.click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Reviewed full return')
    await dialog.getByRole('button', { name: ar ? 'تأكيد التصحيح الكامل' : 'Confirm full correction', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'correct_location_sale')?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_invoice_id: 'sale-1', p_reason: 'Reviewed full return' })
    await expect(correctionAction).toHaveCount(0)
    const lineRow = page.getByRole('row').filter({ hasText: 'Fixture stock' }).first()
    await expect(lineRow).toContainText(/50|٥٠/)
    await expect(lineRow).toContainText(/100|١٠٠/)
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/sale-detail-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}

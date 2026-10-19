import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) test(`review debt-first return and record original card refund: ${locale} ${theme}`, async ({ page }) => {
 const ar = locale === 'ar'
 await page.setViewportSize({ width: ar ? 390 : 1440, height: 1000 })
 await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
 const line = { id: 'line-1', name: 'Original item', itemType: 'product', quantity: 10, remaining: 10 }
 const originalDocument = { invoiceId: 'sale-1', invoiceNumber: 'SALE-1', issuedAt: '2026-10-01T12:00:00Z', receiptId: null, etaSourceAvailable: false }
 const plan = { version: 1, currency: 'EGP', total: 80, tax: 9.82, net: 70.18, dueBefore: 60, debtReduction: 60, refundDue: 20, dueAfter: 0, originalDocument, lines: [{ lineId: 'line-1', quantity: 8, disposition: 'resellable', total: 80, net: 70.18, tax: 9.82, cumulativeQuantity: 8, originalSnapshot: {} }], allocations: [{ allocationId: 'allocation-1', paymentId: 'payment-1', method: 'card', amount: 20 }] }
 const history: Record<string, unknown>[] = []
 const refund = { id: 'refund-1', allocation_id: 'allocation-1', payment_id: 'payment-1', method: 'card', amount: 20, state: 'pending', events: [{ id: 'reserved-1', state: 'pending', operation: 'reserved', reference: '', reason: 'Eight items returned', created_at: '2026-10-15T10:00:00Z', actor_profile_id: 'owner' }] }
 let due = 60
 const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
  if (name === 'get_location_sale') return { id: 'sale-1', invoice_number: 'SALE-1', status: 'issued', created_at: '2026-10-01T12:00:00Z', issued_at: '2026-10-01T12:00:00Z', total_amount: 100, discount_amount: 0, client_id: 'customer-1', client_name_snapshot: 'Customer', amountPaid: 40, outstanding: due, settlementState: due ? 'partial' : 'paid', canReceivePayment: true, lines: [{ id: 'line-1', item_type: 'product', item_name: 'Original item', quantity: 10, unit_price: 10, discount_amount: 0, total_amount: 100 }], payments: [], movements: [] }
  if (name === 'get_sale_tax_snapshot' || name === 'get_location_sale_receipt') return null
  if (name === 'sale_correction_state') return { canCorrect: false, correction: null }
  if (name === 'sale_return_context') return { version: 1, supported: true, canReturn: true, due, currency: 'EGP', totalCount: history.length, lines: [line], history }
  if (name === 'preview_sale_return') return plan
  if (name === 'create_sale_return') { due = 0; line.remaining = 2; history.push({ version: 1, id: 'return-1', invoice_id: 'sale-1', currency: 'EGP', total: 80, tax: 9.82, net: 70.18, debt_reduction: 60, refund_due: 20, due_after: 0, reason: args.p_reason, actor_profile_id: 'owner', created_at: '2026-10-15T10:00:00Z', original_document: originalDocument, lines: [{ line_id: 'line-1', quantity: 8, disposition: 'resellable', total: 80 }], refunds: [refund] }); return 'return-1' }
  if (name === 'record_sale_return_refund') { refund.state = 'completed'; refund.events.push({ id: 'complete-1', state: 'completed', operation: 'external_record', reference: String(args.p_reference), reason: String(args.p_reason), created_at: '2026-10-15T10:01:00Z', actor_profile_id: 'owner' }); return 'complete-1' }
  return undefined
 })
 await fixtureGoto(page, '/sales/sale-1')
 await page.getByRole('button', { name: ar ? 'إرجاع أصناف' : 'Return items', exact: true }).click()
 const dialog = page.getByRole('dialog')
 await dialog.getByRole('spinbutton', { name: ar ? 'كمية الإرجاع' : 'Return quantity', exact: true }).fill('8')
 await dialog.getByRole('textbox', { name: ar ? 'السبب' : 'Reason', exact: true }).fill('Eight items returned')
 await dialog.getByRole('button', { name: ar ? 'مراجعة المرتجع' : 'Review return', exact: true }).click()
 await expect(dialog.getByText(ar ? 'توزيع الدفعات الأصلية' : 'Original payment allocation', { exact: true })).toBeVisible()
 expect(calls.find(c => c.name === 'preview_sale_return')?.args.p_lines).toEqual([{ lineId: 'line-1', quantity: 8, disposition: 'resellable' }])
 const confirmReturn = dialog.getByRole('button', { name: ar ? 'تأكيد المرتجع والتزامات رد المبلغ' : 'Confirm return and refund obligations', exact: true })
 await page.context().setOffline(true)
 await expect(confirmReturn).toBeDisabled()
 expect(calls.some(c => c.name === 'create_sale_return')).toBe(false)
 await page.context().setOffline(false)
 await expect(confirmReturn).toBeEnabled()
 await confirmReturn.click()
 await expect(dialog).not.toBeVisible()
 expect(calls.find(c => c.name === 'create_sale_return')?.args.p_expected_plan).toMatchObject({ debtReduction: 60, refundDue: 20, dueAfter: 0 })
 expect(calls.some(c => c.name === 'record_sale_return_refund')).toBe(false)
 await page.getByRole('button', { name: ar ? 'تسجيل رد مكتمل خارج النظام' : 'Record externally completed refund', exact: true }).click()
 await page.getByRole('dialog').getByRole('textbox', { name: ar ? 'مرجع أو إثبات رد المبلغ الخارجي' : 'External refund reference / evidence', exact: true }).fill('BANK-REF-20')
 await page.getByRole('dialog').getByRole('textbox', { name: ar ? 'السبب' : 'Reason', exact: true }).fill('Bank confirmed')
 await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد التسجيل' : 'Confirm record', exact: true }).click()
 await expect(page.getByRole('dialog')).toHaveCount(0)
 expect(calls.find(c => c.name === 'record_sale_return_refund')?.args).toMatchObject({ p_refund_id: 'refund-1', p_operation: 'external_record', p_reference: 'BANK-REF-20' })
 await expect(page.getByText(/BANK-REF-20/)).toBeVisible()
 await expectNoPageOverflow(page)
 await page.screenshot({ path: `.local/returns-evidence/${locale}-${theme}.png`, fullPage: true })
})

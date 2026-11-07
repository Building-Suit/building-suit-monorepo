import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import type { QuotationDetail, QuotationRecord, QuotationSnapshot, QuotationValues } from '../../app/types/tradeQuotations'
const measurement = { baseUnitCode: 'm', increment: '0.001', revision: 1, status: 'active', saleUnits: ['m', 'cm'], packages: [], locked: false }
for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
 test(`formal quote versions, frozen issue and uncertain transition retry ${locale}`, async ({ page }) => {
  const ar = locale === 'ar'; let basePrice = 35, loseIssue = true
  await page.setViewportSize({ width, height: 1000 })
  await page.context().addInitScript(() => { window.print = () => {} })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
  let record: QuotationRecord | null = null, snapshot: QuotationSnapshot | null = null
  const versions: QuotationDetail['versions'] = [], events: QuotationDetail['events'] = [], results = new Map<string, object>()
  const apply = (args: Record<string, unknown>) => {
   const key = String(args.p_request_id); if (results.has(key)) return results.get(key)
   const action = String(args.p_action), values = args.p_payload as QuotationValues
   if (action === 'save' || action === 'revise') {
    const input = values.lines[0]!, qty = Number(input.quantity), total = qty * basePrice - Number(values.orderDiscount)
    snapshot = { quotationNumber: 'Q-00000001', version: versions.length + 1, currency: 'EGP', customerId: values.customerId, customerName: 'Contractor customer', projectReference: values.projectReference, notes: values.notes, validUntil: values.validUntil, orderDiscount: Number(values.orderDiscount), net: total, tax: 0, total,
     lines: [{ name: 'Project cable', quantity: String(qty), unitPrice: String(basePrice), total, input, pricing: null, measurement: { version: 1, productRevision: 1, baseUnitCode: 'm', baseUnitNameEn: 'Meter', baseUnitNameAr: 'متر', baseQuantity: String(qty), quantityIncrement: '0.001', enteredQuantity: String(qty), enteredUnitCode: 'm', enteredUnitPrice: String(basePrice), packageId: null, packageName: null, packageVersion: null, unitNameEn: 'Meter', unitNameAr: 'متر' } }] }
    record = { id: 'quotation-1', quotation_number: snapshot.quotationNumber, customer_id: values.customerId, customer_name: snapshot.customerName, project_reference: values.projectReference, notes: values.notes, status: 'draft', effective_status: 'draft', revision: (record?.revision || 0) + 1, version: snapshot.version, valid_until: values.validUntil, currency: 'EGP', total_amount: total, created_at: '2026-10-23T10:00:00Z' }
    versions.unshift({ version: snapshot.version, snapshot: structuredClone(snapshot), reason: String(args.p_reason), actor_profile_id: 'manager-profile', created_at: new Date().toISOString() })
   } else {
    if (!record) throw new Error('Fixture quotation required')
    record = { ...record, revision: record.revision + 1, status: 'issued', effective_status: 'issued' }
   }
   events.unshift({ revision: record!.revision, version: record!.version, action, previous_status: null, status: record!.status, reason: String(args.p_reason), actor_profile_id: 'manager-profile', created_at: new Date().toISOString() })
   const result = { id: record!.id, revision: record!.revision, version: record!.version, status: record!.status }; results.set(key, result); return result
  }
  const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
   if (name === 'shops') return [{ id: 'shop-1', name: 'Trade quotation shop', business_mode: 'product', status: 'active' }]
   if (name === 'shop_permission_access') return { 'products.manage': true }
   if (name === 'list_products') return { items: [{ id: 'product-1', name: 'Project cable' }], total: 1, page: 1, pageSize: 20 }
   if (name === 'list_customers') return { items: [{ id: 'customer-1', name: 'Contractor customer' }], total: 1, page: 1, pageSize: 20 }
   if (name === 'product_measurement_options') return measurement
   if (name === 'trade_order_context') return { items: [], total: 0, page: 1, pageSize: 20, detail: null, quotation: null, canManage: true }
   if (name === 'trade_quotation_context') return { items: record ? [record] : [], total: record ? 1 : 0, page: 1, pageSize: 20, canManage: true, canIssue: true, detail: args.p_quotation_id && record ? { record, snapshot, versions, events, versionCount: versions.length, eventCount: events.length, historyPage: 1 } : null }
   if (name === 'trade_quotation_command') return apply(args)
   return undefined
  })
  await fixtureRoute(page, '**/rest/v1/rpc/trade_quotation_command', async route => {
   const args = route.request().postDataJSON() as Record<string, unknown>; calls.push({ name: 'trade_quotation_command', args })
   const result = apply(args)
   if (args.p_action === 'issue' && loseIssue) { loseIssue = false; await route.fulfill({ status: 503, json: { message: 'Synthetic committed response lost' } }) }
   else await route.fulfill({ json: result })
  })
  await fixtureGoto(page, '/quotations')
  await page.getByRole('button', { name: ar ? 'عرض جديد' : 'New quotation', exact: true }).click()
  const editor = page.getByRole('dialog', { name: ar ? 'عروض الأسعار' : 'Quotations', exact: true })
  await editor.getByRole('combobox', { name: ar ? 'العميل' : 'Customer', exact: true }).click()
  await page.getByRole('option', { name: 'Contractor customer', exact: true }).click()
  await editor.getByRole('combobox', { name: ar ? 'المنتج' : 'Product', exact: true }).click()
  await page.getByRole('option', { name: 'Project cable', exact: true }).click()
  await editor.getByLabel(ar ? 'الكمية' : 'Quantity', { exact: true }).fill('100')
  await editor.getByLabel(ar ? 'مرجع المشروع' : 'Project reference', { exact: true }).fill('Site A / first fix')
  await editor.getByLabel(ar ? 'خصم إجمالي بالعملة' : 'Order discount in currency', { exact: true }).fill('5')
  await editor.getByLabel(ar ? 'سبب الإجراء' : 'Reason for action', { exact: true }).fill('Initial commercial material offer')
  await editor.getByRole('button', { name: ar ? 'حفظ للمراجعة' : 'Save for review', exact: true }).click()
  await expect(editor).toHaveCount(0)
  const detail = page.getByRole('dialog', { name: /Q-00000001/ })
  await expect(detail).toContainText('Site A / first fix')
  expect(calls.filter(c => c.name === 'trade_quotation_command')[0]!.args).toMatchObject({ p_action: 'save', p_revision: 0, p_payload: { customerId: 'customer-1', orderDiscount: '5', lines: [{ quantity: '100', unit_code: 'm', measurement_revision: 1 }] } })
  expect(snapshot!.total).toBe(3495)
  await detail.getByLabel(ar ? 'سبب الإجراء' : 'Reason for action', { exact: true }).fill('Offer issued for customer review')
  await detail.getByRole('button', { name: ar ? 'إصدار العرض' : 'Issue quotation', exact: true }).click()
  await expect(detail.getByRole('alert')).toContainText(ar ? 'لم يتأكد الحفظ' : 'Save is unconfirmed')
  await expect(detail.getByLabel(ar ? 'سبب الإجراء' : 'Reason for action', { exact: true })).toBeDisabled()
  await detail.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
  await expect(detail.getByRole('button', { name: ar ? 'إعداد إصدار جديد' : 'Prepare new version', exact: true })).toBeVisible()
  const issued = calls.filter(c => c.name === 'trade_quotation_command' && c.args.p_action === 'issue')
  expect(issued).toHaveLength(2); expect(issued[0]!.args).toEqual(issued[1]!.args); expect(events.filter(e => e.action === 'issue')).toHaveLength(1)
  basePrice = 99
  await detail.getByRole('button', { name: ar ? 'إعداد إصدار جديد' : 'Prepare new version', exact: true }).click()
  await editor.getByLabel(ar ? 'سبب الإجراء' : 'Reason for action', { exact: true }).fill('Prepare explicitly repriced second version')
  await editor.getByRole('button', { name: ar ? 'حفظ للمراجعة' : 'Save for review', exact: true }).click()
  await expect(editor).toHaveCount(0)
  expect(versions.map(v => v.snapshot.total)).toEqual([9895,3495])
  await expect(detail).toContainText(ar ? 'الإصدار 2' : 'Version 2')
  const versionOne = detail.getByRole('region', { name: ar ? 'الإصدارات المحفوظة' : 'Saved versions', exact: true }).getByRole('row').filter({ hasText: 'Initial commercial material offer' })
  await versionOne.getByRole('button', { name: ar ? 'فتح' : 'Open', exact: true }).click()
  await expect(detail).toContainText(ar ? 'إصدار سابق' : 'Historical version')
  await expect(detail.getByRole('button', { name: ar ? 'إصدار العرض' : 'Issue quotation', exact: true })).toHaveCount(0)
  const printedWindow = page.waitForEvent('popup')
  await detail.getByRole('button', { name: ar ? 'طباعة / PDF' : 'Print / PDF', exact: true }).click()
  const printed = await printedWindow
  await expect(printed.getByRole('heading', { name: /Q-00000001/ })).toBeVisible()
  await expect(printed.locator('body')).toContainText(ar ? 'إصدار سابق' : 'Historical version')
  await expect(printed.locator('body')).toContainText('35 EGP')
  await expect(printed.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
  await printed.close()
  await expectNoPageOverflow(page)
  await page.screenshot({ path: test.info().outputPath('quotation-history.png'), fullPage: true })
  expect(calls.some(c => ['save_sale_draft','save_pos_sale_draft','issue_sale','record_customer_receipt','create_supplier_purchase'].includes(c.name))).toBe(false)
 })
}

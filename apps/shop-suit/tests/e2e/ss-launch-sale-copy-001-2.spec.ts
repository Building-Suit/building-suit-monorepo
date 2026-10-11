import { expect, test, type Locator, type Page } from '@playwright/test'
import { fixtureGoto, fixtureRoute, pilotFixture } from './pilot-fixture'

type Kind = 'product' | 'service' | 'mixed'
const product = { id: 'product-1', itemType: 'product', name: 'Copy product', sku: 'COPY', barcode: null, unitPrice: 100, discount: 0, stock: 10 }
const service = { id: 'service-1', itemType: 'service', name: 'Copy service', sku: null, barcode: null, unitPrice: 100, discount: 0, stock: null, discountType: 'amount', discountValue: 0 }
const itemsFor = (kind: Kind) => kind === 'mixed' ? [product, service] : [kind === 'product' ? product : service]

async function copyFixture(page: Page, locale: string, kind: Kind, options: { customer?: boolean; issued?: boolean } = {}) {
  const items = itemsFor(kind)
  return pilotFixture(page, locale, 'owner', name => {
    // Deliberately mixed shop for every transaction: wording follows lines.
    if (name === 'shops') return [{ id: 'shop-1', name: 'Copy shop', business_mode: 'mixed', status: 'active', created_at: '2026-01-01' }]
    if (name === 'sale_access') return [{ can_view: true, can_manage: true, can_issue: true }]
    if (name === 'payment_access') return [{ can_receive: true }]
    if (name === 'list_location_sales') return { items: [], total: 0, canManage: true, canIssue: true }
    if (name === 'sale_catalog') return { businessMode: 'mixed', products: [product], services: [service], customers: [{ id: 'customer-1', name: 'Copy customer' }] }
    const lines = items.map(item => ({ id: item.id, item_type: item.itemType, item_name: item.name, product_id: item.itemType === 'product' ? item.id : null, service_id: item.itemType === 'service' ? item.id : null, quantity: 1, unit_price: 100, discount_amount: 0, line_total: 100 }))
    if (name === 'get_sale') return { id: 'draft-1', status: 'draft', canManage: true, client_id: options.customer ? 'customer-1' : null, due_date: null, notes: null, lines }
    if (name === 'get_location_sale') return { id: 'draft-1', invoice_number: 'COPY-1', status: options.issued ? 'issued' : 'draft', canIssue: true, canManage: true, client_id: 'customer-1', client_name_snapshot: 'Copy customer', lines, movements: [], payments: [], total_amount: items.length * 100, discount_amount: 0, outstanding: items.length * 100, amountPaid: 0, settlementState: 'unpaid', created_at: '2026-10-01', issued_at: options.issued ? '2026-10-01' : null }
    if (name === 'sale_correction_state') return { canCorrect: true, correction: null }
    if (name === 'get_location_sale_receipt') return null
    if (name === 'save_location_sale_draft') return 'draft-1'
    if (name === 'pos_catalog_search_by_category') return { items, total: items.length, page: 1, pageSize: 30, businessMode: 'mixed', ambiguousBarcode: false }
    return undefined
  })
}

async function expectEffect(surface: Locator, kind: Kind, ar: boolean, restore = false) {
  if (kind === 'service') {
    await expect(surface).toContainText(ar ? (restore ? 'الخدمات ملهاش مخزون يرجع' : 'الخدمات مش بتأثر على المخزون') : (restore ? 'Services have no stock to restore' : 'Services do not affect inventory'))
    await expect(surface).not.toContainText('FIFO')
    await expect(surface).not.toContainText(ar ? 'هيتخصم' : 'deducted')
  } else {
    await expect(surface).toContainText('FIFO')
    await expect(surface).toContainText(ar ? 'مخزون المنتجات' : 'Product stock')
    if (kind === 'mixed') await expect(surface).toContainText(ar ? 'بنود الخدمات' : 'service lines')
  }
  await expect(surface).not.toContainText('{inventory')
}

for (const locale of ['en', 'ar']) for (const kind of ['product', 'service', 'mixed'] as const) {
  test.describe(`${kind} ${locale}`, () => {
    const ar = locale === 'ar'
    const confirmLabel = ar ? 'تأكيد' : 'Confirm'
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: ar ? 390 : 1440, height: 900 })
      await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), ar ? 'dark' : 'light')
    })

    for (const action of ['issue', 'checkout', 'fast-pay'] as const) {
      test(`Sales ${action} ${kind} ${locale}: confirmation and safe stock error`, async ({ page }, info) => {
        const customer = action === 'issue'
        const { calls } = await copyFixture(page, locale, kind, { customer })
        const command = action === 'fast-pay' ? 'fast_pay_location_sale' : customer ? 'issue_location_sale' : 'checkout_location_sale'
        await fixtureRoute(page, `**/rest/v1/rpc/${command}`, route => route.fulfill({ status: 400, json: { message: 'INSUFFICIENT_STOCK' } }))
        await fixtureGoto(page, '/sales?edit=draft-1')
        const editor = page.getByRole('dialog')
        await expectEffect(editor, kind, ar)
        const label = action === 'fast-pay' ? (ar ? 'دفع سريع' : 'Fast Pay') : customer ? (ar ? 'إصدار البيعة' : 'Issue sale') : (ar ? 'إصدار وتحصيل المبلغ' : 'Issue and take payment')
        // Let the shared dialog complete its initial focus placement before
        // exercising the user's keyboard activation of an action.
        await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
        await editor.getByRole('button', { name: label, exact: true }).focus()
        await expect(editor.getByRole('button', { name: label, exact: true })).toBeFocused()
        await page.keyboard.press('Enter')
        const confirm = page.getByRole('dialog', { name: confirmLabel, exact: true })
        await expectEffect(confirm, kind, ar)
        if (action === 'fast-pay') await expect(confirm).toContainText(ar ? 'نقدي' : 'Cash')
        await info.attach('confirmation', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
        await confirm.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
        expect(calls.some(call => call.name === command)).toBe(false)
        await editor.getByRole('button', { name: label, exact: true }).click()
        await confirm.getByRole('button', { name: confirmLabel, exact: true }).click()
        const alert = editor.getByRole('alert')
        await expect(alert).toContainText(kind === 'service' ? (ar ? 'مقدرناش نتحقق من بيعة الخدمات' : 'Could not verify this service sale') : (ar ? 'مخزون المنتجات' : 'not enough product stock'))
        if (kind === 'mixed') await expect(alert).toContainText(ar ? 'بنود الخدمات' : 'Service lines')
        if (kind === 'service') await expect(alert).not.toContainText(ar ? 'لا يكفي' : 'not enough')
        await expect(editor).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      })
    }

    test(`POS ${kind} ${locale}: line-aware review, confirmation, error`, async ({ page }, info) => {
      await copyFixture(page, locale, kind)
      await fixtureRoute(page, '**/rest/v1/rpc/checkout_pos_sale', route => route.fulfill({ status: 400, json: { message: 'CROSS_LOCATION_STOCK' } }))
      await fixtureGoto(page, '/pos')
      for (const item of itemsFor(kind)) await page.getByRole('button', { name: new RegExp(item.name) }).click()
      const review = page.getByRole('button', { name: new RegExp(ar ? 'مراجعة البيعة' : 'Review sale') })
      if (await review.isVisible()) await review.click()
      if (kind === 'service') await expect(page.getByRole('main')).toContainText(ar ? 'الخدمات مش محتاجة مراجعة مخزون' : 'Services require no stock check')
      await page.keyboard.press('F8')
      const confirm = page.getByRole('dialog', { name: confirmLabel, exact: true })
      await expectEffect(confirm, kind, ar)
      await info.attach('pos-confirmation', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      await confirm.getByRole('button', { name: confirmLabel, exact: true }).click()
      await expect(page.getByRole('alert')).toContainText(kind === 'service' ? (ar ? 'مقدرناش نتحقق من بيعة الخدمات' : 'Could not verify this service sale') : (ar ? 'مخزون المنتجات' : 'not enough product stock'))
    })

    test(`Sale detail issuance ${kind} ${locale}`, async ({ page }) => {
      await copyFixture(page, locale, kind)
      await fixtureGoto(page, '/sales/draft-1')
      await page.getByRole('button', { name: ar ? 'إصدار البيعة' : 'Issue sale', exact: true }).click()
      await expectEffect(page.getByRole('dialog', { name: confirmLabel, exact: true }), kind, ar)
    })

    test(`Full correction ${kind} ${locale}: warning and confirmation`, async ({ page }, info) => {
      await copyFixture(page, locale, kind, { issued: true })
      await fixtureGoto(page, '/sales/draft-1')
      await page.getByRole('button', { name: ar ? 'إلغاء / إرجاع كامل' : 'Void / full return', exact: true }).click()
      const editor = page.getByRole('dialog')
      await expectEffect(editor, kind, ar, true)
      await editor.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Copy verification')
      await editor.getByRole('button', { name: ar ? 'تأكيد التصحيح الكامل' : 'Confirm full correction', exact: true }).click()
      const confirm = page.getByRole('dialog', { name: confirmLabel, exact: true })
      await expectEffect(confirm, kind, ar, true)
      await info.attach('correction-confirmation', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    })
  })
}

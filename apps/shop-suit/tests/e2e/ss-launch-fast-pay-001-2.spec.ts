import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute } from './pilot-fixture'

// Synthetic transport proves the browser command/handoff. Money, stock and
// authorization are independently exercised by the task-owned SQL suite.
async function salesFixture(page: Page, locale: string, options: { customer?: boolean; issue?: boolean; receive?: boolean } = {}) {
  return pilotFixture(page, locale, 'owner', name => {
    if (name === 'sale_access') return [{ can_view: true, can_manage: true, can_issue: options.issue !== false }]
    if (name === 'payment_access') return [{ can_receive: options.receive !== false }]
    if (name === 'list_location_sales') return { items: [], total: 0, canManage: true, canIssue: options.issue !== false }
    if (name === 'sale_catalog') return { businessMode: 'service', products: [], services: [{ id: 'service-1', name: 'Haircut', unitPrice: 100, discountType: 'amount', discountValue: 0 }], customers: [{ id: 'customer-1', name: 'Fast Pay customer' }] }
    if (name === 'get_sale') return { id: 'draft-1', status: 'draft', canManage: true, client_id: options.customer ? 'customer-1' : null, notes: 'Edited draft', due_date: null, lines: [{ item_type: 'service', service_id: 'service-1', product_id: null, quantity: 1 }] }
    if (name === 'save_location_sale_draft') return 'draft-1'
    if (name === 'fast_pay_location_sale') return 'sale-1'
    return undefined
  })
}

for (const locale of ['en', 'ar']) {
  const ar = locale === 'ar'
  const payLabel = ar ? 'دفع سريع' : 'Fast Pay'
  const confirmLabel = ar ? 'تأكيد' : 'Confirm'
  for (const mobile of [false, true]) for (const theme of ['light', 'dark']) {
    test(`Fast Pay receipt ${locale} ${mobile ? 'mobile' : 'desktop'} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: 900 })
      await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      const { calls } = await salesFixture(page, locale, { customer: !mobile })
      await fixtureGoto(page, '/sales?edit=draft-1')
      const editor = page.getByRole('dialog')
      await expect(editor.getByRole('button', { name: payLabel, exact: true })).toBeVisible()
      await editor.getByRole('combobox', { name: ar ? 'الطريقة' : 'Method', exact: true }).selectOption('card')
      await editor.getByLabel(ar ? 'المرجع' : 'Reference', { exact: true }).fill('FAST-PAY-CARD')
      await page.screenshot({ path: test.info().outputPath('fast-pay-editor.png'), fullPage: true })
      await editor.getByRole('button', { name: payLabel, exact: true }).focus()
      await page.keyboard.press('Enter')
      const confirmation = page.getByRole('dialog', { name: confirmLabel, exact: true })
      await expect(confirmation).toContainText(ar ? 'بطاقة' : 'Card')
      await confirmation.getByRole('button', { name: confirmLabel, exact: true }).click()
      await expect(page).toHaveURL(/\/sales\/sale-1\/receipt$/)
      await expect(page.locator('.receipt-print-surface')).toContainText('SALE-1')
      const commands = calls.filter(call => call.name === 'fast_pay_location_sale')
      expect(commands).toHaveLength(1)
      expect(commands[0].args).toMatchObject({ p_invoice_id: 'draft-1', p_customer_id: mobile ? null : 'customer-1', p_amount: 100, p_method: 'card', p_reference: 'FAST-PAY-CARD' })
      expect(calls.some(call => ['save_location_sale_draft', 'issue_location_sale', 'checkout_location_sale', 'record_location_customer_receipt'].includes(call.name))).toBe(false)
      await page.screenshot({ path: test.info().outputPath('fast-pay-receipt.png'), fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }

  test(`New Sale cancel, pending lock and uncertain response retry ${locale}`, async ({ page }) => {
    const { calls } = await salesFixture(page, locale)
    await fixtureGoto(page, '/sales')
    await page.getByRole('button', { name: ar ? 'بيعة جديدة' : 'New sale', exact: true }).click()
    const editor = page.getByRole('dialog')
    await editor.getByRole('combobox', { name: ar ? 'عنصر الكتالوج' : 'Catalog item', exact: true }).click()
    await page.getByRole('option', { name: 'Haircut', exact: true }).click()
    await editor.getByRole('button', { name: payLabel, exact: true }).click()
    await page.getByRole('dialog', { name: confirmLabel, exact: true }).getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
    expect(calls.filter(call => call.name === 'fast_pay_location_sale')).toHaveLength(0)
    const attempts: unknown[] = []
    let release: (() => void) | undefined
    await fixtureRoute(page, '**/rest/v1/rpc/fast_pay_location_sale', async route => {
      attempts.push(route.request().postDataJSON())
      if (attempts.length === 1) {
        await new Promise<void>(resolve => { release = resolve })
        await route.fulfill({ status: 503, json: { message: 'Response lost after commit' } })
      }
      else await route.fulfill({ json: 'sale-1' })
    })
    await editor.getByRole('button', { name: payLabel, exact: true }).click()
    await page.getByRole('dialog', { name: confirmLabel, exact: true }).getByRole('button', { name: confirmLabel, exact: true }).click()
    await expect(editor.getByRole('button', { name: payLabel, exact: true })).toBeDisabled()
    await expect.poll(() => Boolean(release)).toBe(true)
    release!()
    await expect(editor.getByRole('alert')).toBeVisible()
    await expect(editor.getByRole('button', { name: ar ? 'حفظ المسودة' : 'Save draft', exact: true })).toBeDisabled()
    await editor.getByRole('button', { name: payLabel, exact: true }).click()
    await expect(page).toHaveURL(/\/sales\/sale-1\/receipt$/)
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
  })

  for (const permission of ['issue', 'receive'] as const) {
    test(`Fast Pay requires ${permission} ${locale}`, async ({ page }) => {
      await salesFixture(page, locale, { [permission]: false })
      await fixtureGoto(page, '/sales?edit=draft-1')
      await expect(page.getByRole('dialog').getByRole('button', { name: payLabel, exact: true })).toHaveCount(0)
      await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ المسودة' : 'Save draft', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
    })
  }
  test(`Cash-shift rejection retains editor and retry ${locale}`, async ({ page }) => {
    await salesFixture(page, locale)
    await fixtureRoute(page, '**/rest/v1/rpc/fast_pay_location_sale', route => route.fulfill({ status: 400, json: { message: 'SALE_OPEN_CASH_SHIFT_REQUIRED' } }))
    await fixtureGoto(page, '/sales?edit=draft-1')
    await page.getByRole('dialog').getByRole('button', { name: payLabel, exact: true }).click()
    await page.getByRole('dialog', { name: confirmLabel, exact: true }).getByRole('button', { name: confirmLabel, exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(ar ? 'ورديات الخزنة' : 'Cashier shifts')
    await expect(page).toHaveURL(/\/sales$/)
    await page.screenshot({ path: test.info().outputPath('fast-pay-shift-blocked.png'), fullPage: true })
  })
}

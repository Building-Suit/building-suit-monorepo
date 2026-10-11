import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureRoute, fixtureUnroute, fixtureGoto, fixtureReload } from './pilot-fixture'

// Browser tests use synthetic HTTP responses; authoritative policy/financial
// invariants are exercised separately by the task's database command matrix.
for (const locale of ['en', 'ar']) {
  const ar = locale === 'ar'
  for (const mobile of [false, true]) for (const theme of ['light', 'dark']) {
    test(`Business cashier policy ${locale} ${mobile ? 'mobile' : 'desktop'} ${theme}`, async ({ page }) => {
      await page.setViewportSize({ width: mobile ? 390 : 1440, height: 900 })
      await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      let required = false
      const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
        if (name === 'shop_permission_access') return { 'settings.manage': true }
        if (name === 'shop_cash_policy') return required
        if (name === 'set_shop_cash_policy') { required = args.p_required === true; return required }
        return undefined
      })
      await fixtureGoto(page, '/settings')
      const toggle = page.getByRole('dialog').getByRole('checkbox', { name: ar ? 'اشتراط وردية خزنة مفتوحة للمبيعات' : 'Require an open cashier shift for sales' })
      const save = page.getByRole('button', { name: ar ? 'حفظ سياسة الخزنة' : 'Save cashier policy', exact: true })
      const edit = page.getByRole('button', { name: ar ? 'تعديل سياسة الخزنة' : 'Edit cashier policy', exact: true })
      await edit.click()
      await expect(toggle).not.toBeChecked()
      await expect(save).toBeDisabled()
      await toggle.focus()
      await expect(toggle).toBeFocused()
      await page.keyboard.press('Space')
      await save.click()
      await expect(page.getByRole('status').filter({ hasText: ar ? 'اتحفظت سياسة ورديات الخزنة.' : 'Cashier shift policy saved.' })).toBeVisible()
      expect(calls.filter(call => call.name === 'set_shop_cash_policy').at(-1)?.args).toEqual({ p_shop_id: 'shop-1', p_required: true })
      await fixtureReload(page)
      await expect(page.getByRole('checkbox')).toBeChecked()
      await page.screenshot({ path: test.info().outputPath('policy-enabled.png'), fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await edit.click()
      await toggle.uncheck()
      await save.click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      expect(required).toBe(false)
    })
  }

  test(`Policy load failure, retry, save failure and denied ${locale}`, async ({ page }) => {
    await pilotFixture(page, locale, 'cashier', name => {
      if (name === 'shop_cash_policy') return false
      if (name === 'shop_permission_access') return { 'settings.manage': false }
      return undefined
    })
    await fixtureGoto(page, '/settings')
    const toggle = page.getByRole('checkbox', { name: ar ? 'اشتراط وردية خزنة مفتوحة للمبيعات' : 'Require an open cashier shift for sales' })
    await expect(toggle).toBeDisabled()
    await expect(page.getByRole('button', { name: ar ? 'حفظ سياسة الخزنة' : 'Save cashier policy', exact: true })).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('policy-readonly.png'), fullPage: true })
    await fixtureRoute(page, '**/rest/v1/rpc/shop_cash_policy', route => route.fulfill({ status: 500, json: { message: 'load failed' } }))
    await fixtureReload(page)
    const section = page.locator('section[aria-labelledby="cash-policy-title"]')
    await expect(section.getByRole('alert')).toBeVisible()
    await fixtureUnroute(page, '**/rest/v1/rpc/shop_cash_policy')
    await section.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(toggle).toBeVisible()
    await fixtureRoute(page, '**/rest/v1/rpc/shop_permission_access', route => route.fulfill({ json: { 'settings.manage': true } }))
    await fixtureRoute(page, '**/rest/v1/rpc/set_shop_cash_policy', route => route.fulfill({ status: 403, json: { message: 'SHOP_PERMISSION_DENIED' } }))
    await fixtureReload(page)
    await section.getByRole('button', { name: ar ? 'تعديل سياسة الخزنة' : 'Edit cashier policy', exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByRole('checkbox').check()
    await dialog.getByRole('button', { name: ar ? 'حفظ سياسة الخزنة' : 'Save cashier policy', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(ar ? 'مقدرناش نحفظ' : 'Could not save')
  })

  test(`POS policy rejection and Cashier shifts recovery ${locale}`, async ({ page }) => {
    let opened = false
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'cash_shift_dashboard') return { canManage: true, canAdjust: true, currentMembershipId: 'membership-1', active: opened ? { id: 'shift-1', cashierMembershipId: 'membership-1', cashierName: 'Pilot barber', registerKey: 'main', openedAt: new Date().toISOString(), openingAmount: 0, expectedCash: 0, cashSales: 0, cashRefunds: 0, payIns: 0, payOuts: 0, nonCashTotal: 0, nonCashByMethod: {}, events: [] } : null, items: [], total: 0, cashiers: [] }
      if (name === 'open_cash_shift') { opened = true; return 'shift-1' }
      return undefined
    })
    await fixtureRoute(page, '**/rest/v1/rpc/checkout_pos_sale', async route => {
      if (!opened) await route.fulfill({ status: 400, json: { message: 'SALE_OPEN_CASH_SHIFT_REQUIRED' } })
      else await route.fallback()
    })
    await fixtureGoto(page, '/pos')
    await page.getByRole('button', { name: /Haircut/ }).click()
    await page.keyboard.press('F8')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(ar ? 'ورديات الخزنة' : 'Cashier shifts')
    await expect(page).toHaveURL(/\/pos$/)
    await page.screenshot({ path: test.info().outputPath('checkout-blocked.png'), fullPage: true })
    await fixtureGoto(page, '/cash-shifts')
    await page.getByRole('button', { name: ar ? 'فتح وردية' : 'Open shift', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'فتح الخزنة' : 'Open drawer', exact: true }).click()
    await page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(opened).toBe(true)
    await fixtureGoto(page, '/pos')
    await page.getByRole('button', { name: /Haircut/ }).click()
    await page.keyboard.press('F8')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/\/receipt\?origin=pos/)
    expect(calls.some(call => call.name === 'open_cash_shift')).toBe(true)
    expect(calls.filter(call => call.name === 'checkout_pos_sale')).toHaveLength(1)
  })
  test(`Sales draft saving, issue and payment policy errors ${locale}`, async ({ page }) => {
    const sale = {
      id: 'sale-1', invoice_number: null, status: 'draft', created_at: new Date().toISOString(), issued_at: null,
      total_amount: 100, discount_amount: 0, notes: '', client_id: 'customer-1', client_name_snapshot: 'Policy customer',
      due_date: null, amountPaid: 0, outstanding: 100, settlementState: 'unpaid', overdue: false,
      canManage: true, canIssue: true, canReceivePayment: true, canReversePayment: false, canRefundPayment: false,
      lines: [{ id: 'line-1', item_type: 'service', item_name: 'Haircut', quantity: 1, unit_price: 100,
        discount_amount: 0, total_amount: 100, product_id: null, service_id: 'service-1' }], movements: [], payments: [],
    }
    const { calls } = await pilotFixture(page, locale, 'owner', name => {
      if (name === 'get_sale' || name === 'get_location_sale') return sale
      if (name === 'sale_access') return [{ can_view: true, can_manage: true, can_issue: true }]
      if (name === 'payment_access') return [{ can_receive: true }]
      if (name === 'list_location_sales') return { items: [], total: 0, canManage: true, canIssue: true }
      if (name === 'sale_catalog') return { businessMode: 'service', products: [], services: [{ id: 'service-1', name: 'Haircut', unitPrice: 100, discountType: 'amount', discountValue: 0 }], customers: [{ id: 'customer-1', name: 'Policy customer' }] }
      if (name === 'save_location_sale_draft') return 'sale-1'
      if (name === 'get_location_sale_receipt') return null
      if (name === 'sale_correction_state') return { canCorrect: false, correction: null }
      return undefined
    })
    for (const name of ['issue_location_sale', 'checkout_location_sale', 'record_location_customer_receipt']) {
      await fixtureRoute(page, `**/rest/v1/rpc/${name}`, route => route.fulfill({ status: 400, json: { message: 'SALE_OPEN_CASH_SHIFT_REQUIRED' } }))
    }
    // Existing customer draft can be edited and saved despite no open shift.
    await fixtureGoto(page, '/sales?edit=sale-1')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ المسودة' : 'Save draft', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.some(call => call.name === 'save_location_sale_draft')).toBe(true)
    await fixtureGoto(page, '/sales/sale-1')
    await page.getByRole('button', { name: ar ? 'إصدار البيعة' : 'Issue sale', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(ar ? 'ورديات الخزنة' : 'Cashier shifts')
    await page.screenshot({ path: test.info().outputPath('sale-issue-blocked.png'), fullPage: true })
    sale.status = 'issued'
    await fixtureReload(page)
    await page.getByRole('button', { name: ar ? 'تسجيل تحصيل' : 'Record receipt', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ' : 'Save', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(ar ? 'ورديات الخزنة' : 'Cashier shifts')
    await page.screenshot({ path: test.info().outputPath('sale-payment-blocked.png'), fullPage: true })
    // Customerless issue-and-take-payment (the fast checkout path).
    sale.status = 'draft'; sale.client_id = ''
    await fixtureGoto(page, '/sales?edit=sale-1')
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'إصدار وتحصيل المبلغ' : 'Issue and take payment', exact: true }).click()
    await page.getByRole('dialog').filter({ hasText: ar ? 'تأكيد' : 'Confirm' }).getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText(ar ? 'ورديات الخزنة' : 'Cashier shifts')
  })

}

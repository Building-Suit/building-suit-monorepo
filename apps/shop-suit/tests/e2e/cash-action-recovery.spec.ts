import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`cash shift command confirmation and recovery ${locale}`, async ({ page }) => {
    test.setTimeout(60000)
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const shift = { id: 'shift-1', registerKey: 'main', cashierMembershipId: 'membership-1', cashierName: 'Fixture cashier', openingAmount: 0, cashSales: 0, cashRefunds: 0, payIns: 0, payOuts: 0, expectedCash: 0, openedAt: '2026-10-13T08:00:00Z', nonCashTotal: 0, nonCashByMethod: {}, events: [] }
    let active: typeof shift | null = null
    const items: object[] = []
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'cash_shift_dashboard') return { canManage: true, canAdjust: true, currentMembershipId: 'membership-1', active, items, total: items.length, cashiers: [{ id: 'membership-1', name: shift.cashierName }] }
      if (name === 'open_cash_shift') { active = { ...shift, openingAmount: Number(args.p_opening_amount), cashSales: 100, expectedCash: Number(args.p_opening_amount) + 100 }; return shift.id }
      if (name === 'record_cash_movement') { if (active) { active.payOuts = Number(args.p_amount); active.expectedCash -= Number(args.p_amount) } return 'event-1' }
      if (name === 'close_cash_shift') { if (active) items.push({ ...active, countedCash: args.p_counted_amount, variance: Number(args.p_counted_amount) - active.expectedCash, closedAt: '2026-10-13T09:00:00Z' }); active = null; return shift.id }
      return undefined
    })
    await fixtureGoto(page, '/cash-shifts')
    const filter = page.getByRole('combobox', { name: ar ? 'الكاشير' : 'Cashier', exact: true })
    await expect(filter).toContainText(ar ? 'كل الكاشير' : 'All cashiers')
    const confirmation = page.getByRole('dialog', { name: ar ? 'تأكيد' : 'Confirm', exact: true })
    const commands = [
      { rpc: 'open_cash_shift', title: ar ? 'فتح وردية' : 'Open shift', submit: ar ? 'فتح الخزنة' : 'Open drawer', field: ar ? 'النقدية الافتتاحية' : 'Opening cash', value: '0', code: 'CASH_SHIFT_ALREADY_OPEN', error: ar ? 'وردية مفتوحة' : 'already open', details: ar ? 'النقدية الافتتاحية' : 'Opening cash' },
      { rpc: 'record_cash_movement', title: ar ? 'حركة نقدية' : 'Cash movement', submit: ar ? 'تسجيل الحركة' : 'Record movement', field: ar ? 'المبلغ' : 'Amount', value: '20', code: 'INVALID_CASH_MOVEMENT', error: ar ? 'راجع المبلغ' : 'Review the amount', details: 'REF-1' },
      { rpc: 'close_cash_shift', title: ar ? 'إغلاق الوردية' : 'Close shift', submit: ar ? 'تأكيد العد والإغلاق' : 'Confirm count and close', field: ar ? 'النقدية المعدودة' : 'Counted cash', value: '0', code: 'SHOP_PERMISSION_DENIED', error: ar ? 'معندكش صلاحية' : 'do not have permission', details: ar ? 'النقدية المتوقعة' : 'Expected cash' },
    ]
    for (const command of commands) {
      await page.getByRole('button', { name: command.title, exact: true }).click()
      const form = page.getByRole('dialog', { name: command.title, exact: true })
      await form.getByLabel(command.field, { exact: true }).fill('-1')
      await form.getByRole('button', { name: command.submit, exact: true }).click()
      await expect(confirmation).toHaveCount(0)
      expect(await form.getByLabel(command.field, { exact: true }).evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false)
      await form.getByLabel(command.field, { exact: true }).fill(command.value)
      if (command.rpc === 'record_cash_movement') {
        await form.getByRole('radio', { name: ar ? 'سحب' : 'Pay out', exact: true }).check()
        await form.getByLabel(ar ? 'السبب' : 'Reason', { exact: true }).fill('Fixture pay out')
        await form.getByLabel(ar ? 'المرجع' : 'Reference', { exact: true }).fill('REF-1')
      }
      const submit = form.getByRole('button', { name: command.submit, exact: true })
      await submit.click()
      await expect(confirmation).toContainText('First branch')
      await expect(confirmation).toContainText(command.details)
      await confirmation.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
      expect(calls.filter(call => call.name === command.rpc)).toHaveLength(0)
      await expect(form).toHaveAttribute('aria-busy', 'false')
      let failedRequestId: string | undefined
      await fixtureRoute(page, `**/rest/v1/rpc/${command.rpc}`, route => {
        failedRequestId = route.request().postDataJSON().p_request_id
        return route.fulfill({ status: 400, json: { message: command.code } })
      })
      await submit.click()
      await confirmation.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(form.getByRole('alert')).toContainText(command.error)
      await expect(form.getByLabel(command.field, { exact: true })).toHaveValue(command.value)
      await fixtureUnroute(page, `**/rest/v1/rpc/${command.rpc}`)
      await submit.click()
      await page.screenshot({ path: test.info().outputPath(`${command.rpc}-confirmation.png`), fullPage: true, animations: 'disabled' })
      await confirmation.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      const call = calls.filter(call => call.name === command.rpc).at(-1)!
      expect(call.args).toMatchObject({ p_shop_id: 'shop-1' })
      expect(call.args.p_request_id).toMatch(/^[\da-f-]{36}$/)
      expect(call.args.p_request_id).toBe(failedRequestId)
      if (command.rpc === 'open_cash_shift') expect(call.args).toMatchObject({ p_location_id: 'location-1', p_opening_amount: 0, p_register_key: 'main' })
      if (command.rpc === 'record_cash_movement') expect(call.args).toMatchObject({ p_session_id: shift.id, p_kind: 'pay_out', p_amount: 20, p_reason: 'Fixture pay out', p_reference: 'REF-1' })
      if (command.rpc === 'close_cash_shift') expect(call.args).toMatchObject({ p_session_id: shift.id, p_counted_amount: 0 })
    }
    await expect(page.getByRole('cell', { name: shift.cashierName, exact: true })).toBeVisible()
    await expectNoPageOverflow(page)
  })

  test(`cash shift read states and restricted cashier ${locale}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const active = { id: 'shift-other', registerKey: 'main', cashierMembershipId: 'membership-2', cashierName: 'Another cashier', openingAmount: 100, expectedCash: 100, cashSales: 0, cashRefunds: 0, payIns: 0, payOuts: 0, nonCashTotal: 0, nonCashByMethod: {}, openedAt: '2026-10-13T08:00:00Z', events: [] }
    const { calls } = await pilotFixture(page, locale, 'cashier', name => name === 'cash_shift_dashboard'
      ? { canManage: false, canAdjust: false, currentMembershipId: 'membership-1', active, items: [], total: 0, cashiers: [] } : undefined)
    let releaseRead!: () => void
    let gate = Promise.resolve()
    let fail = false
    await fixtureRoute(page, '**/rest/v1/rpc/cash_shift_dashboard', async route => { if (fail) return route.fulfill({ status: 503, json: { message: 'Synthetic read failure' } }); await gate; return route.fallback() })
    await fixtureGoto(page, '/cash-shifts')
    await expect(page.getByText(active.cashierName, { exact: false })).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'حركة نقدية' : 'Cash movement', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: ar ? 'إغلاق الوردية' : 'Close shift', exact: true })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: ar ? 'الكاشير' : 'Cashier', exact: true })).toHaveCount(0)
    fail = true
    await fixtureGoto(page, '/cash-shifts?failure=1')
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل' : 'Could not load')
    await expect(page.getByRole('table')).toHaveCount(0)
    await expect(page.getByRole('button', { name: ar ? 'فتح وردية' : 'Open shift', exact: true })).toHaveCount(0)
    fail = false
    gate = new Promise<void>(resolve => { releaseRead = resolve })
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.getByRole('status', { name: ar ? 'بنحمّل الورديات…' : 'Loading shifts…', exact: true })).toBeVisible()
    await expect(page.getByRole('table')).toHaveCount(0)
    releaseRead()
    await expect(page.getByText(active.cashierName, { exact: false })).toBeVisible()
    active.cashierMembershipId = 'membership-1'
    await fixtureGoto(page, '/cash-shifts?own=1')
    await expect(page.getByRole('button', { name: ar ? 'إغلاق الوردية' : 'Close shift', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: ar ? 'حركة نقدية' : 'Cash movement', exact: true })).toHaveCount(0)
    expect(calls.filter(call => /^(open_cash_shift|record_cash_movement|close_cash_shift)$/.test(call.name))).toHaveLength(0)
    await expectNoPageOverflow(page)
  })

  for (const context of ['no-shop', 'no-location']) {
    test(`cash shift ${context} context ${locale}`, async ({ page }) => {
      const ar = locale === 'ar'
      let absent = false
      const { calls } = await pilotFixture(page, locale, 'owner', name => {
        if (absent && context === 'no-shop' && name === 'shops') return []
        if (absent && context === 'no-location' && name === 'list_shop_locations') return []
        return undefined
      })
      absent = true
      await fixtureGoto(page, '/cash-shifts')
      await expect(page.getByText(context === 'no-shop' ? (ar ? 'اعمل متجر الأول من لوحة التحكم.' : 'Create a shop from the dashboard first.') : (ar ? 'مفيش فرع متاح.' : 'No location is available.'), { exact: true })).toBeVisible()
      await expect(page.getByRole('table')).toHaveCount(0)
      expect(calls.filter(call => call.name === 'cash_shift_dashboard')).toHaveLength(0)
    })
  }

  test(`cash history filter restarts pagination ${locale}`, async ({ page }) => {
    const ar = locale === 'ar'
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name !== 'cash_shift_dashboard') return undefined
      const currentPage = Number(args.p_page)
      return { canManage: true, canAdjust: true, currentMembershipId: 'membership-1', active: null,
        cashiers: [{ id: 'membership-1', name: 'Fixture cashier' }], total: args.p_cashier_membership_id ? 1 : 40,
        items: Array.from({ length: args.p_cashier_membership_id ? 1 : 20 }, (_, index) => ({ id: `history-${currentPage}-${index}`, cashierName: `Cashier page ${currentPage} row ${index}`, openedAt: '2026-10-13T08:00:00Z', expectedCash: 100, countedCash: 100, variance: 0, nonCashTotal: 0 })) }
    })
    await fixtureGoto(page, '/cash-shifts')
    await page.getByRole('button', { name: 'Next Page', exact: true }).click()
    await expect(page.getByRole('cell', { name: 'Cashier page 2 row 0', exact: true })).toBeVisible()
    await page.getByRole('combobox', { name: ar ? 'الكاشير' : 'Cashier', exact: true }).click()
    await page.getByRole('option', { name: 'Fixture cashier', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'cash_shift_dashboard').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_page: 1, p_page_size: 20, p_cashier_membership_id: 'membership-1' })
    await expect(page.getByRole('cell', { name: 'Cashier page 1 row 0', exact: true })).toBeVisible()
  })
}

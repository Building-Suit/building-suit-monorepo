import { expect, test, type Locator, type Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { backendFixture, login, type PilotRole } from './pilot-backend'

async function choose(page: Page, scope: Locator, label: string, option?: string) {
  await scope.getByRole('combobox', { name: label, exact: true }).click()
  const list = page.getByRole('listbox')
  await (option ? list.getByRole('option', { name: option, exact: true }) : list.getByRole('option').first()).click()
}

async function confirm(page: Page, ar: boolean) {
  await page.getByRole('dialog').last().getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
}

async function layout(page: Page, ar: boolean) {
  await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

// Each cell gets its own synthetic tenant, real Auth sessions and branch data.
// The existing pilot-usability suite remains the separate mocked error-state
// matrix; this suite must never route.fulfill a business response.
for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) for (const role of ['owner', 'manager', 'cashier'] satisfies PilotRole[]) {
  test(`paid pilot journey: ${locale}, ${width}px, ${role}`, async ({ page, browser }) => {
    const fixture = await backendFixture(role)
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.name))
    await login(page, fixture.actor, locale)
    const date = await page.evaluate(() => {
      const now = new Date()
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    })

    for (const [index, location] of fixture.locations.entries()) {
      const initialShift = await fixture.rpc<{ active: unknown; items: unknown[] }>(fixture.actor, 'cash_shift_dashboard', {
        p_shop_id: fixture.shopId, p_location_id: location.id,
      })
      expect(initialShift.active).toBeNull()
      expect(initialShift.items).toHaveLength(0)

      // Full document navigation resolves useAsyncData during SSR and embeds
      // the dashboard in Nuxt's payload, so there is no browser RPC to await.
      // Assert the rendered branch state; real client-side branch changes below
      // still verify the RPC request and its location contract.
      await page.goto('/cash-shifts')
      await expect(page.getByRole('heading', { name: ar ? 'ورديات الخزنة' : 'Cashier shifts', exact: true })).toBeVisible()
      const branchSelector = page.locator('header').getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true })
      if (await branchSelector.inputValue() !== location.id) {
        const switched = page.waitForResponse(response => response.url().endsWith('/rpc/cash_shift_dashboard') && response.request().postDataJSON()?.p_location_id === location.id)
        await branchSelector.selectOption(location.id)
        expect((await switched).ok()).toBe(true)
      }
      await expect(branchSelector).toHaveValue(location.id)
      await expect(page.getByRole('main')).toContainText(location.name)
      const open = page.getByRole('button', { name: ar ? 'فتح وردية' : 'Open shift', exact: true })
      await expect(open).toBeVisible()
      await open.click()
      const dialog = page.getByRole('dialog')
      await dialog.getByRole('spinbutton', { name: ar ? 'النقدية الافتتاحية' : 'Opening cash', exact: true }).fill('50')
      await dialog.getByRole('button', { name: ar ? 'فتح الخزنة' : 'Open drawer', exact: true }).click()
      await confirm(page, ar)
      await expect(dialog).toHaveCount(0)

      await page.goto('/appointments')
      const main = page.getByRole('main')
      await expect(main.getByRole('heading', { name: ar ? 'المواعيد' : 'Appointments', exact: true })).toBeVisible()
      await expect(main.getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true })).toHaveValue(location.id)
      await main.getByRole('button', { name: index === 0 ? (ar ? 'حضور بدون حجز' : 'Walk-in') : (ar ? 'موعد جديد' : 'New appointment'), exact: true }).click()
      await choose(page, dialog, ar ? 'الخدمة' : 'Service', 'Pilot haircut')
      await choose(page, dialog, ar ? 'الموظف' : 'Staff member')
      // Fixed midday avoids a near-midnight walk-in crossing working hours.
      await dialog.getByLabel(ar ? 'وقت البداية' : 'Start time', { exact: true }).fill(`${date}T${index === 0 ? '10' : '12'}:00`)
      if (index === 0) await dialog.getByRole('textbox', { name: ar ? 'الاسم' : 'Name', exact: true }).fill('Pilot walk-in')
      else await choose(page, dialog, ar ? 'عميل مسجل' : 'Saved customer', 'Pilot booked customer')
      const saved = page.waitForResponse(response => response.url().endsWith('/rpc/save_appointment') && response.request().method() === 'POST')
      await dialog.getByRole('button', { name: ar ? 'حفظ الموعد' : 'Save appointment', exact: true }).click()
      const savedResponse = await saved
      expect(savedResponse.ok()).toBe(true)
      const appointmentId = await savedResponse.json() as string
      await expect(dialog).toHaveCount(0)
      const checkout = main.locator(`a[href="/pos?appointment=${appointmentId}"]`)
      await checkout.click()
      await expect(page).toHaveURL(new RegExp(`/pos\\?appointment=${appointmentId}`))
      await expect(main.getByRole('region', { name: ar ? 'البيعة الحالية' : 'Current sale', exact: true })).toContainText(location.name)
      const payButton = main.getByRole('button', { name: ar ? /^تحصيل / : /^Pay / })
      await expect(payButton).toBeEnabled()
      const otherLocation = fixture.locations[1 - index]!
      await branchSelector.selectOption(otherLocation.id)
      await expect(payButton).toBeDisabled()
      await page.keyboard.press('F8')
      await expect(dialog).toHaveCount(0)
      await branchSelector.selectOption(location.id)
      await expect(payButton).toBeEnabled()
      await layout(page, ar)
      const paid = page.waitForResponse(response => response.url().endsWith('/rpc/checkout_pos_sale') && response.request().method() === 'POST')
      await page.keyboard.press('F8')
      await confirm(page, ar)
      const payment = await paid
      expect(payment.ok()).toBe(true)
      const invoiceId = await payment.json() as string
      await expect(page).toHaveURL(new RegExp(`/sales/${invoiceId}/receipt`))
      await expect(page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })).toBeEnabled()
      await layout(page, ar)
      // Retry the exact command from the browser and compare persisted proof.
      expect(await fixture.rpc(fixture.actor, 'checkout_pos_sale', payment.request().postDataJSON())).toBe(invoiceId)
      const receiptArgs = { p_shop_id: fixture.shopId, p_location_id: location.id, p_invoice_id: invoiceId }
      const receipt = await fixture.rpc<{ total: number; payments: unknown[]; location: { name: string } }>(fixture.actor, 'get_location_sale_receipt', receiptArgs)
      expect(Number(receipt.total)).toBe(100)
      expect(receipt.payments).toHaveLength(1)
      expect(receipt.location.name).toBe(location.name)
      await page.reload()
      await expect(page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })).toBeEnabled()
      expect(await fixture.rpc(fixture.actor, 'get_location_sale_receipt', receiptArgs)).toEqual(receipt)

      await page.goto('/cash-shifts')
      await page.getByRole('button', { name: ar ? 'إغلاق الوردية' : 'Close shift', exact: true }).click()
      await expect(dialog.getByRole('spinbutton', { name: ar ? 'النقدية المعدودة' : 'Counted cash', exact: true })).toHaveValue('150')
      await dialog.getByRole('button', { name: ar ? 'تأكيد العد والإغلاق' : 'Confirm count and close', exact: true }).click()
      await confirm(page, ar)
      await expect(dialog).toHaveCount(0)
      const shift = await fixture.rpc<{ active: unknown; items: Array<{ expectedCash: number; countedCash: number; variance: number }> }>(fixture.actor, 'cash_shift_dashboard', { p_shop_id: fixture.shopId, p_location_id: location.id })
      expect(shift.active).toBeNull()
      expect(shift.items).toHaveLength(1)
      expect(Number(shift.items[0]!.expectedCash)).toBe(150)
      expect(Number(shift.items[0]!.countedCash)).toBe(150)
      expect(Number(shift.items[0]!.variance)).toBe(0)
      await layout(page, ar)
    }

    const ownerContext = await browser.newContext({ baseURL: 'http://127.0.0.1:4422', timezoneId: 'Africa/Cairo', viewport: { width, height: 900 } })
    try {
      const ownerPage = await ownerContext.newPage()
      const reportResponse = ownerPage.waitForResponse(response => response.url().endsWith('/rpc/shop_operating_report') && response.request().method() === 'POST')
      await login(ownerPage, fixture.owner, locale)
      const response = await reportResponse
      expect(response.ok()).toBe(true)
      const report = await response.json()
      expect(Number(report.sales)).toBe(200)
      expect(Number(report.paymentsIn)).toBe(200)
      expect(Number(report.saleCount)).toBe(2)
      expect(Number(report.cash.closedShifts)).toBe(2)
      expect(Number(report.cash.variance)).toBe(0)
      expect(report.locations).toHaveLength(2)
      for (const branch of report.locations) expect(Number(branch.sales)).toBe(100)
      await expect(ownerPage.getByRole('heading', { name: ar ? 'مقارنة الفروع' : 'Location comparison', exact: true })).toBeVisible()
      await layout(ownerPage, ar)
    } finally { await ownerContext.close() }
    expect(errors).toEqual([])
  })
}

for (const locale of ['en', 'ar']) {
  test(`barber branch revocation and money permission boundary: ${locale}`, async ({ page }) => {
    const fixture = await backendFixture('barber')
    const ar = locale === 'ar'
    await login(page, fixture.actor, locale)
    await page.goto('/appointments')
    const branch = page.getByRole('main').getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true })
    for (const [index, location] of fixture.locations.entries()) {
      await page.goto('/appointments')
      await branch.selectOption(location.id)
      await page.getByRole('button', { name: ar ? 'حضور بدون حجز' : 'Walk-in', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await choose(page, dialog, ar ? 'الخدمة' : 'Service', 'Pilot haircut')
      await choose(page, dialog, ar ? 'الموظف' : 'Staff member')
      const today = await dialog.getByLabel(ar ? 'وقت البداية' : 'Start time', { exact: true }).inputValue()
      await dialog.getByLabel(ar ? 'وقت البداية' : 'Start time', { exact: true }).fill(`${today.slice(0, 10)}T${index === 0 ? '10' : '12'}:00`)
      await dialog.getByRole('textbox', { name: ar ? 'الاسم' : 'Name', exact: true }).fill('Barber walk-in')
      const saved = page.waitForResponse(response => response.url().endsWith('/rpc/save_appointment') && response.request().method() === 'POST')
      await dialog.getByRole('button', { name: ar ? 'حفظ الموعد' : 'Save appointment', exact: true }).click()
      const savedResponse = await saved
      expect(savedResponse.ok()).toBe(true)
      const appointmentId = await savedResponse.json() as string
      await expect(dialog).toHaveCount(0)
      const card = page.getByRole('main').locator('li').filter({ has: page.locator(`a[href="/pos?appointment=${appointmentId}"]`) })
      await card.getByRole('button', { name: ar ? 'تسجيل الوصول' : 'Mark arrived', exact: true }).click()
      await card.getByRole('button', { name: ar ? 'بدء الخدمة' : 'Start service', exact: true }).click()
      await card.getByRole('button', { name: ar ? 'إكمال' : 'Complete', exact: true }).click()
      await card.getByRole('link', { name: ar ? 'تحصيل الموعد' : 'Check out appointment', exact: true }).click()
      await expect(page.getByRole('main').getByRole('button', { name: ar ? /^تحصيل / : /^Pay / })).toBeEnabled()
      const denied = page.waitForResponse(response => response.url().endsWith('/rpc/checkout_pos_sale') && response.request().method() === 'POST')
      await page.keyboard.press('F8')
      await confirm(page, ar)
      expect((await denied).status()).toBe(403)
      await expect(page.getByRole('main').getByRole('alert')).toBeVisible()
    }
    // Revocation happens through the owner command while the barber is signed
    // in on branch two. An existing JWT must not retain branch authority.
    await fixture.rpc(fixture.owner, 'manage_shop_member', {
      p_request_id: randomUUID(), p_shop_id: fixture.shopId, p_membership_id: fixture.membershipId,
      p_action: 'assign_locations', p_location_ids: [fixture.locations[0]!.id], p_reason: 'Pilot branch denial check',
    })
    await expect(fixture.rpc(fixture.actor, 'pos_checkout_context', { p_shop_id: fixture.shopId, p_location_id: fixture.locations[1]!.id })).rejects.toThrow(/failed \(403\)/)
    await page.goto('/appointments')
    await expect(branch.locator(`option[value="${fixture.locations[1]!.id}"]`)).toHaveCount(0)
    await expect(fixture.rpc(fixture.actor, 'open_cash_shift', {
      p_request_id: randomUUID(), p_shop_id: fixture.shopId, p_location_id: fixture.locations[0]!.id,
      p_register_key: 'main', p_opening_amount: 0, p_notes: null,
    })).rejects.toThrow(/failed \(403\)/)
    await expect(fixture.rpc(fixture.actor, 'shop_operating_report', { p_shop_id: fixture.shopId })).rejects.toThrow(/failed \(403\)/)
    await fixture.rpc(fixture.owner, 'manage_shop_member', {
      p_request_id: randomUUID(), p_shop_id: fixture.shopId, p_membership_id: fixture.membershipId,
      p_action: 'suspend', p_reason: 'Pilot suspension check',
    })
    await expect(fixture.rpc(fixture.actor, 'appointment_options', { p_shop_id: fixture.shopId })).rejects.toThrow(/failed \(403\)/)
  })
}

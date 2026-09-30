import { test, expect, type Page, type Locator } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

async function noPageOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}
async function touchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box?.width).toBeGreaterThanOrEqual(44)
  expect(box?.height).toBeGreaterThanOrEqual(44)
}
async function navigateClient(page: Page, path: string) {
  await page.locator('#__nuxt').evaluate(async (root, destination) => {
    const app = (root as HTMLElement & {
      __vue_app__?: { config: { globalProperties: { $router?: { push: (to: string) => Promise<unknown> } } } }
    }).__vue_app__
    const router = app?.config.globalProperties.$router
    if (!router) throw new Error('Nuxt router is not ready')
    await router.push(destination)
  }, path)
  await expect(page).toHaveURL(new RegExp(`${path}(?:[?#]|$)`))
}

for (const locale of ['en', 'ar']) for (const width of [360, 768, 1440]) for (const role of ['owner', 'manager', 'barber']) {
  test(`pilot branch handoff and reachable actions: ${locale}, ${width}px, ${role}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    const { calls } = await pilotFixture(page, locale, role)
    const ar = locale === 'ar'
    await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
    const guide = page.getByRole('region', { name: ar ? 'جهّز متجرك لاستقبال أول عميل' : 'Prepare your shop for its first customer' })
    if (role === 'owner') {
      await expect(guide.getByRole('link')).toHaveCount(6)
      expect(await guide.getByRole('link').evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(['/settings', '/settings#locations', '/team', '/services', '/appointments', '/billing'])
    } else await expect(guide).toHaveCount(0)
    await noPageOverflow(page)
    await page.locator('a[href="/appointments"]:visible').first().click()
    const main = page.getByRole('main')
    await expect(page).toHaveURL(/\/appointments(?:[?#]|$)/)
    await expect(main.getByRole('heading', { name: ar ? 'المواعيد' : 'Appointments', exact: true })).toBeVisible()
    const branch = main.getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true })
    for (const id of ['location-2', 'location-1', 'location-2']) {
      await branch.selectOption(id)
      await expect(page.locator('header').getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true })).toHaveValue(id)
      await expect.poll(() => calls.filter(call => call.name === 'appointment_calendar').at(-1)?.args.p_location_id).toBe(id)
    }
    const walkIn = main.getByRole('button', { name: ar ? 'حضور بدون حجز' : 'Walk-in', exact: true })
    await expect(walkIn).toBeEnabled()
    await touchTarget(walkIn)
    await walkIn.click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('radio', { name: ar ? 'حضور بدون حجز' : 'Walk-in', exact: true })).toBeChecked()
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(walkIn).toBeFocused()
    await noPageOverflow(page)
    await main.getByRole('link', { name: ar ? 'تحصيل الموعد' : 'Check out appointment' }).first().click()
    await expect(page).toHaveURL(/pos\?appointment=appointment-location-2/)
    await expect.poll(() => calls.filter(call => call.name === 'pos_checkout_context').at(-1)?.args.p_location_id).toBe('location-2')
    const context = main.getByRole('region', { name: ar ? 'البيعة الحالية' : 'Current sale', exact: true })
    await expect(context).toContainText('Second branch')
    await expect(context).toContainText('Pilot barber')
    await expect(main.getByRole('button', { name: ar ? 'المنتجات' : 'Products', exact: true })).toHaveCount(0)
    if (width < 1280) {
      const review = context.getByRole('link', { name: ar ? /مراجعة البيعة/ : /Review sale/ })
      await touchTarget(review)
      await review.click()
      await expect(page.locator('#pos-cart-title')).toBeInViewport()
    }
    const shift = context.getByRole('link', { name: ar ? 'فتح / إغلاق الوردية' : 'Open / close shift' })
    await touchTarget(shift)
    await expect(shift).toHaveAttribute('href', '/cash-shifts')
    await noPageOverflow(page)
    expect(errors).toEqual([])
  })
}

for (const locale of ['en', 'ar']) {
  test(`walk-in save feedback and recoverable calendar states: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 900 })
    const { state } = await pilotFixture(page, locale)
    const ar = locale === 'ar'
    state.delayCalendar = true
    await page.locator('a[href="/appointments"]:visible').first().click()
    await expect(page.getByRole('status').filter({ hasText: ar ? 'جاري تحميل التقويم' : 'Loading calendar' })).toBeVisible()
    const add = page.getByRole('button', { name: ar ? 'حضور بدون حجز' : 'Walk-in', exact: true })
    await expect(add).toBeEnabled()
    await add.click()
    const dialog = page.getByRole('dialog')
    for (const [label, option] of [[ar ? 'الخدمة' : 'Service', 'Haircut'], [ar ? 'الموظف' : 'Staff member', 'Pilot barber']] as const) {
      await dialog.getByRole('combobox', { name: label, exact: true }).click()
      await page.getByRole('listbox').getByRole('option', { name: option, exact: true }).click()
    }
    const name = dialog.getByRole('textbox', { name: ar ? 'الاسم' : 'Name', exact: true })
    await name.fill('New walk-in')
    await dialog.getByRole('button', { name: ar ? 'حفظ الموعد' : 'Save appointment', exact: true }).click()
    await expect(name).toBeDisabled()
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('main').getByText('New walk-in', { exact: true }).first()).toBeVisible()
    state.calendarError = true
    await page.getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(ar ? 'تعذّر تحميل التقويم' : 'Could not load the calendar')
    state.calendarError = false; state.calendarDenied = true
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(ar ? 'اطلب من المالك' : 'Ask the owner')
    state.calendarDenied = false; state.emptyCalendar = true
    await page.getByRole('button', { name: ar ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(add).toBeEnabled()
    await expect(page.getByText(ar ? 'لا توجد مواعيد في هذه الفترة.' : 'No appointments in this period.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true }).click()
    await noPageOverflow(page)
    await page.keyboard.press('Escape')
  })

  test(`POS keyboard, payment confirmation and receipt: ${locale}`, async ({ page }) => {
    const { calls } = await pilotFixture(page, locale)
    const ar = locale === 'ar'
    await page.locator('a[href="/pos"]:visible').first().click()
    await page.getByRole('button', { name: /Haircut/ }).click()
    const notes = page.getByRole('textbox', { name: ar ? 'ملاحظات البيعة (اختياري)' : 'Sale notes (optional)', exact: true })
    const before = calls.filter(call => call.args.p_barcode).length
    await notes.fill('')
    await notes.pressSequentially('123456', { delay: 5 })
    await notes.press('Enter')
    expect(calls.filter(call => call.args.p_barcode)).toHaveLength(before)
    await page.keyboard.press('F8')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(ar ? 'خصم مخزون المنتجات' : 'deduct product stock')
    const cancel = dialog.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true })
    await expect(cancel).toBeFocused()
    await page.keyboard.press('F8')
    await cancel.click()
    await expect(dialog).toHaveCount(0)
    await page.keyboard.press('F8')
    await dialog.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(page).toHaveURL(/sales\/sale-1\/receipt\?origin=pos/)
    expect(calls.filter(call => call.name === 'checkout_pos_sale')).toHaveLength(1)
    const print = page.getByRole('button', { name: ar ? 'طباعة الإيصال' : 'Print receipt', exact: true })
    await expect(print).toBeEnabled({ timeout: 20_000 })
    await page.evaluate(() => { window.print = () => { document.body.dataset.printed = 'true' } })
    await print.click()
    await expect(page.locator('body')).toHaveAttribute('data-printed', 'true')
  })

  test(`report access retry recovers without a browser refresh: ${locale}`, async ({ page }) => {
    const { calls, state } = await pilotFixture(page, locale)
    state.failAccess = true
    await page.reload()
    const alert = page.getByRole('alert').filter({ hasText: locale === 'ar' ? 'تعذّر تحميل البيانات.' : 'Could not load this data.' })
    await expect(alert).toBeVisible()
    const before = calls.filter(call => call.name === 'shop_permission_access').length
    state.failAccess = false
    await alert.getByRole('button', { name: locale === 'ar' ? 'إعادة المحاولة' : 'Retry', exact: true }).click()
    await expect(alert).toHaveCount(0)
    expect(calls.filter(call => call.name === 'shop_permission_access').length).toBeGreaterThan(before)
  })

  test(`billing and admin controls at 360px: ${locale}`, async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 })
    await pilotFixture(page, locale)
    const ar = locale === 'ar'
    await navigateClient(page, '/billing')
    const reference = page.getByRole('textbox', { name: ar ? 'مرجع التحويل' : 'Transfer reference', exact: true })
    await expect(reference).toBeVisible()
    await touchTarget(reference)
    await noPageOverflow(page)
    await navigateClient(page, '/platform-admin')
    const billing = page.getByRole('button', { name: ar ? 'قائمة الفوترة' : 'Billing queue', exact: true })
    await expect(billing).toBeVisible()
    await touchTarget(billing)
    await billing.focus()
    await page.keyboard.press('Enter')
    await expect(billing).toHaveAttribute('aria-pressed', 'true')
    await noPageOverflow(page)
  })
}

import { expect, test, type Page } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

async function scheduleFixture(page: Page, locale: string, state = 'ready') {
  await page.setViewportSize({ width: locale === 'ar' ? 390 : 1440, height: 1000 })
  await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), locale === 'ar' ? 'dark' : 'light')
  let absent = false
  const fixture = await pilotFixture(page, locale, 'owner', name => {
    if (absent && state === 'no-shop' && name === 'shops') return []
    if (absent && state === 'no-location' && name === 'list_shop_locations') return []
    if (name === 'appointment_options') return { canManage: state !== 'view-only', canManageSchedule: state !== 'view-only',
      locations: state === 'no-location' ? [] : [{ id: 'location-1', name: 'First branch' }, { id: 'location-2', name: 'Second branch' }],
      staff: state === 'no-staff' ? [] : [{ membershipId: 'membership-1', name: 'First staff', locationIds: ['location-1', 'location-2'] }, { membershipId: 'membership-2', name: 'Second staff', locationIds: ['location-1', 'location-2'] }],
      services: state === 'no-staff' ? [] : [{ id: 'service-1', name: 'Haircut', durationMinutes: 30, cleanupMinutes: 0, locationIds: ['location-1', 'location-2'], staffMembershipIds: ['membership-1', 'membership-2'] }], customers: [] }
    if (name === 'appointment_calendar') return { appointments: [], workingHours: [{ membershipId: 'membership-1', weekday: 1, startsLocal: '09:00', endsLocal: '17:00' }, { membershipId: 'membership-2', weekday: 1, startsLocal: '11:00', endsLocal: '18:00' }], blocks: [] }
    if (name === 'save_staff_schedule') return null
    return undefined
  })
  absent = true
  return fixture
}

for (const locale of ['en', 'ar'] as const) {
  const ar = locale === 'ar'
  test(`schedule staff baseline block staging and save recovery ${locale}`, async ({ page }) => {
    test.setTimeout(60000)
    const { calls } = await scheduleFixture(page, locale)
    await fixtureGoto(page, '/appointments?from=2026-10-13')
    const open = page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true })
    await open.click()
    const dialog = page.getByRole('dialog', { name: ar ? 'جدول الموظف' : 'Staff schedule', exact: true })
    const staff = dialog.getByRole('combobox', { name: ar ? 'الموظف' : 'Staff member', exact: true })
    await staff.click()
    await page.getByRole('option', { name: 'Second staff', exact: true }).click()
    const monday = dialog.getByLabel(ar ? 'الاثنين · من' : 'Monday · From', { exact: true })
    await expect(monday).toHaveValue('11:00')
    await monday.focus() // Leave the select's own Escape handler before testing dialog close.
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0) // Switching a clean record must not create a false discard prompt.
    await open.click()
    await monday.fill('10:00')
    await expect(staff).toBeDisabled()
    await expect(dialog.getByRole('status').filter({ hasText: ar ? 'احفظ التغييرات أو تجاهلها' : 'Save or discard changes' })).toBeVisible()
    await dialog.getByRole('combobox', { name: ar ? 'نوع التوقف' : 'Block type', exact: true }).click()
    await page.getByRole('option', { name: ar ? 'إجازة' : 'Time off', exact: true }).click()
    await dialog.getByLabel(ar ? 'بداية التوقف' : 'Block starts', { exact: true }).fill('2026-10-13T12:00')
    await dialog.getByLabel(ar ? 'نهاية التوقف' : 'Block ends', { exact: true }).fill('2026-10-13T11:00')
    const save = dialog.getByRole('button', { name: ar ? 'حفظ الجدول' : 'Save schedule', exact: true })
    await expect(save).toBeDisabled()
    await dialog.getByRole('button', { name: ar ? 'إضافة توقف' : 'Add block', exact: true }).click()
    await expect(dialog.getByRole('alert')).toContainText(ar ? 'اختر بداية ونهاية لاحقة' : 'Choose a start time and a later end time')
    await dialog.getByLabel(ar ? 'نهاية التوقف' : 'Block ends', { exact: true }).fill('2026-10-13T13:00')
    await dialog.getByLabel(ar ? 'ملاحظة' : 'Note', { exact: true }).fill('Fixture time off')
    await dialog.getByRole('button', { name: ar ? 'إضافة توقف' : 'Add block', exact: true }).click()
    await expect(save).toBeEnabled()
    await expect(dialog.getByText(/Time off ·|إجازة ·/)).toBeVisible()
    await fixtureRoute(page, '**/rest/v1/rpc/save_staff_schedule', route => route.fulfill({ status: 403, json: { message: 'SHOP_PERMISSION_DENIED' } }))
    await save.click()
    await expect(dialog.getByRole('alert')).toContainText(ar ? 'اطلب من المالك صلاحية المواعيد' : 'Ask the owner for appointment access')
    await expect(monday).toHaveValue('10:00')
    await fixtureUnroute(page, '**/rest/v1/rpc/save_staff_schedule')
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/save_staff_schedule', async route => { await gate; await route.fallback() })
    await save.click()
    await expect(dialog).toHaveAttribute('aria-busy', 'true')
    await expect(save).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()
    await page.screenshot({ path: test.info().outputPath('schedule-pending.png'), fullPage: true, animations: 'disabled' })
    release()
    await expect(dialog).toHaveCount(0)
    expect(calls.filter(call => call.name === 'save_staff_schedule').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_membership_id: 'membership-1', p_timezone: 'Africa/Cairo', p_working_hours: [{ weekday: 1, startsLocal: '10:00', endsLocal: '17:00' }], p_blocks: [{ kind: 'time_off', startsAt: '2026-10-13T12:00:00.000Z', endsAt: '2026-10-13T13:00:00.000Z', note: 'Fixture time off' }] })
    await expectNoPageOverflow(page)
  })

  for (const state of ['no-shop', 'no-location', 'no-staff', 'view-only']) {
    test(`appointment ${state} ${locale}`, async ({ page }) => {
      const { calls } = await scheduleFixture(page, locale, state)
      await fixtureGoto(page, '/appointments?from=2026-10-13')
      if (state === 'view-only') {
        await expect(page.getByRole('button', { name: ar ? 'موعد جديد' : 'New appointment', exact: true })).toHaveCount(0)
        await expect(page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true })).toHaveCount(0)
      } else await expect(page.getByText(state === 'no-shop' ? (ar ? 'اعمل متجر الأول من لوحة التحكم.' : 'Create a shop from the dashboard first.') : state === 'no-location' ? (ar ? 'اطلب من المالك يضيفك لفرع شغّال من إعدادات النشاط.' : 'Ask the owner to add or assign an active location in Business settings.') : (ar ? 'اطلب من المالك يضيف الموظفين والخدمات للفرع قبل الحجز.' : 'Ask the owner to assign staff and services to this location before booking.'), { exact: true }).first()).toBeVisible()
      expect(calls.filter(call => /^(save_|transition_)/.test(call.name))).toHaveLength(0)
    })
  }

  test(`appointment options failure retries and branch filter ${locale}`, async ({ page }) => {
    const { calls } = await scheduleFixture(page, locale)
    await fixtureRoute(page, '**/rest/v1/rpc/appointment_options', route => route.fulfill({ status: 503, json: { message: 'Synthetic options failure' } }))
    await fixtureGoto(page, '/appointments?from=2026-10-13')
    await expect(page.getByRole('alert')).toContainText(ar ? 'مقدرناش نحمّل التقويم.' : 'Could not load the calendar.')
    await fixtureUnroute(page, '**/rest/v1/rpc/appointment_options')
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar')).toBeVisible()
    await page.getByRole('main').getByRole('combobox', { name: ar ? 'الفرع' : 'Location', exact: true }).click()
    await page.getByRole('option', { name: 'Second branch', exact: true }).click()
    await expect.poll(() => calls.filter(call => call.name === 'appointment_calendar').at(-1)?.args.p_location_id).toBe('location-2')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })

  test(`late schedule success stays out of a new page ${locale}`, async ({ page }) => {
    await scheduleFixture(page, locale)
    await fixtureGoto(page, '/appointments?from=2026-10-13')
    await page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true }).click()
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/save_staff_schedule', async route => { await gate; await route.fulfill({ json: null }) })
    const response = page.waitForResponse(value => value.url().endsWith('/rpc/save_staff_schedule'))
    await page.getByRole('dialog').getByRole('button', { name: ar ? 'حفظ الجدول' : 'Save schedule', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveAttribute('aria-busy', 'true')
    await page.evaluate(async () => {
      const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $nuxt: { $router: { push: (path: string) => Promise<void> } } } } } }
      await root.__vue_app__.config.globalProperties.$nuxt.$router.push('/dashboard')
    })
    await expect(page.getByRole('main').getByRole('heading', { name: ar ? 'لوحة التحكم' : 'Operating dashboard', exact: true })).toBeVisible()
    release()
    await (await response).finished()
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))))
    await expect(page.getByText(ar ? 'تم حفظ جدول الموظف.' : 'Staff schedule saved.', { exact: true })).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
}

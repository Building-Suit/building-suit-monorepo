import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`appointment adapter and schedule commands: ${locale}, ${theme}, ${width}`, async ({ page }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const items: Record<string, unknown>[] = []
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'appointment_calendar') return { appointments: items, workingHours: [], blocks: [] }
      if (name === 'save_appointment') { items.push({ id: 'appointment-new', locationId: args.p_location_id, staffMembershipId: args.p_membership_id, serviceId: args.p_service_id, customerId: null, identityKind: 'walk_in', customerName: args.p_walk_in_name, customerPhone: null, status: 'booked', startsAt: args.p_starts_at, endsAt: new Date(new Date(String(args.p_starts_at)).getTime() + 1800000).toISOString(), notes: args.p_notes, saleId: null, serviceName: 'Haircut', staffName: 'Pilot barber', history: [] }); return 'appointment-new' }
      if (name === 'transition_appointment') { items[0].status = args.p_status; return 'appointment-new' }
      if (name === 'save_staff_schedule') return null
      return undefined
    })
    async function choose(label: string, option: string) { const dialog = page.getByRole('dialog'); await dialog.getByRole('combobox', { name: label, exact: true }).click(); await page.getByRole('option', { name: option, exact: true }).click() }
    await fixtureGoto(page, '/appointments')
    await page.getByRole('button', { name: ar ? 'حضور بدون حجز' : 'Walk-in', exact: true }).click()
    await choose(ar ? 'الخدمة' : 'Service', 'Haircut')
    await choose(ar ? 'الموظف' : 'Staff member', 'Pilot barber')
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(ar ? 'الاسم' : 'Name', { exact: true }).fill('Fixture walk in')
    await dialog.getByLabel(ar ? 'ملاحظات' : 'Notes', { exact: true }).fill('Original appointment note')
    await dialog.getByRole('button', { name: ar ? 'حفظ الموعد' : 'Save appointment', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    await page.locator('.bs-appointment-event summary').first().click()
    await page.getByRole('button', { name: ar ? 'تسجيل الوصول' : 'Mark arrived', exact: true }).click()
    await expect(page.getByRole('button', { name: ar ? 'بدء الخدمة' : 'Start service', exact: true }).first()).toBeVisible()
    await page.getByRole('button', { name: ar ? 'بدء الخدمة' : 'Start service', exact: true }).first().click()
    await page.getByRole('button', { name: ar ? 'إكمال' : 'Complete', exact: true }).first().click()
    await expect.poll(() => items[0].status).toBe('completed')
    expect(calls.find(call => call.name === 'save_appointment')?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_service_id: 'service-1', p_membership_id: 'membership-1', p_identity_kind: 'walk_in', p_customer_id: null, p_walk_in_name: 'Fixture walk in', p_notes: 'Original appointment note' })
    await page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true }).click()
    const schedule = page.getByRole('dialog')
    await schedule.getByRole('checkbox').nth(1).check()
    await schedule.getByRole('button', { name: ar ? 'حفظ الجدول' : 'Save schedule', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'save_staff_schedule')?.args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_membership_id: 'membership-1', p_timezone: 'Africa/Cairo', p_working_hours: [{ weekday: 1, startsLocal: '09:00', endsLocal: '18:00' }], p_blocks: [] })
    await page.getByRole('button', { name: ar ? 'شهر' : 'Month', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar--month')).toBeVisible()
    expect(await page.locator('.bs-appointment-calendar__day').count()).toBeGreaterThanOrEqual(28)
    await page.getByRole('button', { name: ar ? 'التالي' : 'Next', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar--month')).toBeVisible()
    await page.getByRole('button', { name: ar ? 'اليوم' : 'Today', exact: true }).click()
    await expectNoPageOverflow(page)
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/appointments-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
  })
}

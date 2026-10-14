import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`read-only schedule blocks and calendar contexts ${locale} ${theme} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const blocks = [
      { id: 'block-break', membershipId: 'membership-1', kind: 'break', startsAt: '2026-10-13T09:00:00Z', endsAt: '2026-10-13T09:30:00Z', note: 'Planned training <img src=x onerror=alert(1)>' },
      { id: 'block-overnight', membershipId: 'membership-2', kind: 'time_off', startsAt: '2026-10-12T23:00:00Z', endsAt: '2026-10-13T01:00:00Z', note: null },
      { id: 'block-midnight', membershipId: 'membership-2', kind: 'break', startsAt: '2026-10-12T22:00:00Z', endsAt: '2026-10-13T00:00:00Z', note: null },
    ]
    const { calls } = await pilotFixture(page, locale, 'cashier', (name) => {
      if (name === 'appointment_options') return { canManage: false, canManageSchedule: false,
        locations: [{ id: 'location-1', name: 'First branch' }, { id: 'location-2', name: 'Second branch' }],
        staff: [{ membershipId: 'membership-1', name: 'Pilot barber', locationIds: ['location-1'] }, { membershipId: 'membership-2', name: 'Second staff', locationIds: ['location-1'] }],
        services: [{ id: 'service-1', name: 'Haircut', durationMinutes: 30, cleanupMinutes: 0, locationIds: ['location-1'], staffMembershipIds: ['membership-1', 'membership-2'] }], customers: [] }
      if (name === 'appointment_calendar') return { appointments: [], workingHours: [], blocks }
      return undefined
    })
    const ar = locale === 'ar'
    await fixtureGoto(page, '/appointments?from=2026-10-13')
    await expect(page.getByRole('button', { name: ar ? 'موعد جديد' : 'New appointment', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: ar ? 'ساعات العمل والإجازات' : 'Working hours & time off', exact: true })).toHaveCount(0)
    expect(calls.some(call => call.name === 'appointment_calendar')).toBe(true)
    const calendar = page.locator('.bs-appointment-calendar')
    const block = calendar.getByRole('button', { name: /Pilot barber/ }).first()
    await expect(block).toBeVisible()
    await expect(calendar.getByRole('button', { name: /Second staff/ })).toHaveCount(1) // Midnight-ending block is outside the selected day.
    await block.click()
    const dialog = page.getByRole('dialog', { name: ar ? 'تفاصيل فترة عدم التوفر' : 'Schedule block details', exact: true })
    await expect(dialog).toContainText(blocks[0].note!)
    await expect(dialog.locator('img,input,select,textarea')).toHaveCount(0)
    await expect(dialog.getByRole('button', { name: ar ? 'إزالة' : 'Remove', exact: true })).toHaveCount(0)
    await page.screenshot({ path: test.info().outputPath('block-detail.png'), fullPage: true, animations: 'disabled' })
    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
    await expect(block).toBeFocused()
    await page.getByRole('button', { name: ar ? 'أسبوع' : 'Week', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar--week')).toBeVisible()
    await expect(calendar.getByRole('button', { name: /Second staff/ })).toHaveCount(3) // Overnight on both dates, plus the earlier midnight-ending block.
    await page.getByRole('button', { name: ar ? 'شهر' : 'Month', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar--month')).toBeVisible()
    await expect(calendar.getByRole('button', { name: /Pilot barber/ })).toBeVisible()
    await expect(calendar.getByRole('button', { name: /Second staff/ })).toHaveCount(3)
    const staff = page.getByRole('combobox', { name: ar ? 'الموظف' : 'Staff member', exact: true })
    await staff.click()
    await page.getByRole('option', { name: 'Pilot barber', exact: true }).click()
    await expect(calendar.getByRole('button', { name: /Second staff/ })).toHaveCount(0)
    await block.click()
    await expect(dialog).toBeVisible()
    // A background refresh must not leave a stale block detail available.
    blocks.splice(0)
    let releaseRead!: () => void
    const readGate = new Promise<void>(resolve => { releaseRead = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/appointment_calendar', async route => {
      await readGate
      await route.fulfill({ status: ar ? 403 : 503, json: { message: ar ? 'SHOP_PERMISSION_DENIED' : 'Synthetic calendar failure' } })
    })
    await page.locator('input[type=date]').evaluate((element: HTMLInputElement) => {
      element.value = '2026-10-14'
      element.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await expect(dialog).toHaveCount(0)
    await expect(page.getByRole('status').filter({ hasText: ar ? 'بنحمّل التقويم' : 'Loading calendar' })).toBeVisible()
    releaseRead()
    await expect(page.getByRole('alert')).toContainText(ar ? 'اطلب من المالك صلاحية المواعيد' : 'Could not load the calendar.')
    await expect(page.locator('.bs-appointment-calendar')).toHaveCount(0)
    await fixtureUnroute(page, '**/rest/v1/rpc/appointment_calendar')
    await page.getByRole('button', { name: ar ? 'حاول تاني' : 'Retry', exact: true }).click()
    await expect(page.locator('.bs-appointment-calendar')).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(calls.filter(call => /^(save_|transition_)/.test(call.name))).toHaveLength(0)
    await expectNoPageOverflow(page)
  })
}

import { expect, test } from '@playwright/test'
import { pilotFixture, fixtureGoto, fixtureRoute, fixtureUnroute } from './pilot-fixture'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`appointment confirmations and edit recovery ${locale}`, async ({ page }) => {
    test.setTimeout(60000) // Cumulative multi-command recovery journey; assertion timeouts stay unchanged.
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    const item = { id: 'appointment-existing', locationId: 'location-1', staffMembershipId: 'membership-1', serviceId: 'service-1', customerId: null,
      identityKind: 'walk_in', customerName: 'Fixture walk in', customerPhone: '01000000000', notes: 'Keep original note',
      status: 'booked', startsAt: '2026-10-13T10:00:00Z', endsAt: '2026-10-13T10:30:00Z', serviceName: 'Haircut', staffName: 'Pilot barber', saleId: null, history: [] }
    const { calls } = await pilotFixture(page, locale, 'owner', (name, args) => {
      if (name === 'appointment_calendar') return { appointments: [item], workingHours: [], blocks: [] }
      if (name === 'save_appointment') { item.startsAt = String(args.p_starts_at); item.endsAt = new Date(new Date(item.startsAt).getTime() + 1800000).toISOString(); item.notes = String(args.p_notes); return item.id }
      if (name === 'transition_appointment') { item.status = String(args.p_status); return item.id }
      return undefined
    })
    await fixtureGoto(page, '/appointments?from=2026-10-13')
    const event = page.getByRole('button', { name: new RegExp(item.customerName) })
    const details = page.getByRole('dialog', { name: item.customerName, exact: true })
    await event.click()
    const reschedule = details.getByRole('button', { name: ar ? 'إعادة الجدولة' : 'Reschedule', exact: true })
    await reschedule.click()
    const form = page.getByRole('dialog', { name: ar ? 'تعديل الموعد' : 'Edit appointment', exact: true })
    await expect(form.getByLabel(ar ? 'الاسم' : 'Name', { exact: true })).toHaveValue(item.customerName)
    await expect(form.getByLabel(ar ? 'ملاحظات' : 'Notes', { exact: true })).toHaveValue(item.notes)
    const starts = form.getByLabel(ar ? 'وقت البداية' : 'Start time', { exact: true })
    await starts.fill('2026-10-13T11:00')
    await page.keyboard.press('Escape')
    const discard = form.getByRole('alert')
    await expect(discard).toBeVisible()
    await discard.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
    await expect(starts).toHaveValue('2026-10-13T11:00')
    const save = form.getByRole('button', { name: ar ? 'حفظ الموعد' : 'Save appointment', exact: true })
    const errors = [
      ['APPOINTMENT_STAFF_CONFLICT', ar ? 'هذا الموظف لديه موعد متداخل.' : 'This staff member already has an overlapping appointment.'],
      ['APPOINTMENT_STAFF_UNAVAILABLE', ar ? 'الوقت خارج ساعات العمل' : 'time is outside working hours'],
      ['INVALID_APPOINTMENT', ar ? 'أكمل بيانات الموعد' : 'Complete the appointment details'],
      ['Synthetic write failure', ar ? 'مقدرناش نحفظ الموعد.' : 'Could not save the appointment.'],
    ] as const
    for (const [message, expected] of errors) {
      await fixtureRoute(page, '**/rest/v1/rpc/save_appointment', route => route.fulfill({ status: 400, json: { message } }))
      await save.click()
      await expect(form.getByRole('alert')).toContainText(expected)
      await expect(starts).toHaveValue('2026-10-13T11:00')
      await fixtureUnroute(page, '**/rest/v1/rpc/save_appointment')
    }
    let releaseSave!: () => void
    const saveGate = new Promise<void>(resolve => { releaseSave = resolve })
    await fixtureRoute(page, '**/rest/v1/rpc/save_appointment', async route => {
      await saveGate
      const args = route.request().postDataJSON()
      expect(args).toMatchObject({ p_shop_id: 'shop-1', p_location_id: 'location-1', p_appointment_id: item.id, p_membership_id: 'membership-1', p_service_id: 'service-1', p_identity_kind: 'walk_in', p_customer_id: null, p_walk_in_name: item.customerName, p_walk_in_phone: item.customerPhone, p_notes: item.notes, p_starts_at: '2026-10-13T11:00:00.000Z' })
      item.startsAt = args.p_starts_at
      item.endsAt = new Date(new Date(item.startsAt).getTime() + 1800000).toISOString()
      await route.fulfill({ json: item.id })
    })
    await save.click()
    await expect(form).toHaveAttribute('aria-busy', 'true')
    await expect(save).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(form).toBeVisible()
    releaseSave()
    await expect(form).toHaveCount(0)
    await fixtureUnroute(page, '**/rest/v1/rpc/save_appointment')
    await expect(details).toBeVisible()
    await reschedule.click()
    await expect(starts).toHaveValue('2026-10-13T11:00')
    await form.getByLabel(ar ? 'ملاحظات' : 'Notes', { exact: true }).fill('Discard this change')
    await page.keyboard.press('Escape')
    await discard.getByRole('button', { name: ar ? 'تأكيد' : 'Confirm', exact: true }).click()
    await expect(form).toHaveCount(0)
    await expect(reschedule).toBeFocused()
    expect(item.notes).toBe('Keep original note')

    for (const [status, label] of [['cancelled', ar ? 'إلغاء الموعد' : 'Cancel appointment'], ['no_show', ar ? 'لم يحضر' : 'No-show']] as const) {
      if (status === 'no_show') { item.status = 'booked'; await fixtureGoto(page, '/appointments?from=2026-10-13'); await event.click() }
      if (!await details.isVisible()) await event.click()
      const action = details.getByRole('button', { name: label, exact: true })
      await action.click()
      const confirmation = page.getByRole('dialog', { name: label, exact: true })
      await expect(confirmation).toContainText(item.customerName)
      await expect(confirmation).toContainText(item.serviceName)
      await confirmation.getByRole('button', { name: ar ? 'إلغاء' : 'Cancel', exact: true }).click()
      expect(calls.filter(call => call.name === 'transition_appointment')).toHaveLength(status === 'cancelled' ? 0 : 1)
      await expect(action).toBeFocused()
      await action.click()
      await page.screenshot({ path: test.info().outputPath(`confirmation-${status}.png`), fullPage: true, animations: 'disabled' })
      await confirmation.getByRole('button', { name: label, exact: true }).click()
      await expect(confirmation).toHaveCount(0)
      await expect(details.getByRole('button', { name: /Reschedule|إعادة الجدولة/ })).toHaveCount(0)
      expect(calls.filter(call => call.name === 'transition_appointment').at(-1)?.args).toMatchObject({ p_shop_id: 'shop-1', p_appointment_id: item.id, p_status: status })
    }
    await expectNoPageOverflow(page)
  })
}

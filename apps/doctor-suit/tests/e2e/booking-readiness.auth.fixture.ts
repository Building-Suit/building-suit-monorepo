import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { test, expect, type Page } from '@playwright/test'
import { doctorAppointmentsCopy } from '../../app/utils/appointmentsPresentation'
import { localRealtimeProtocol } from './realtimeProtocol'
import { selected, tabTo } from './bookingKeyboard'

const fixture = 'http://127.0.0.1:4338/__fixture'
const patientLabel = 'Synthetic A patient 02'

async function hold(page: Page, rpc: string) {
  let release!: () => void
  let captured = false
  const held = new Promise<void>(resolve => { release = resolve })
  const pattern = `**/rest/v1/rpc/${rpc}`
  await page.route(pattern, async route => {
    const response = await route.fetch()
    captured = true
    await held
    await route.fulfill({ response }).catch(() => {})
  })
  return {
    release,
    arrived: () => expect.poll(() => captured).toBe(true),
    async deliver() {
      const delivered = page.waitForResponse(pattern)
      release()
      const response = await delivered
      expect(response.ok()).toBe(true)
      expect(await response.finished()).toBeNull()
    },
  }
}

for (const [ar, width] of [[false, 1280], [true, 390]] as const) for (const first of ['patients', 'offers'] as const) {
  test(`booking readiness: ${ar ? 'AR' : 'EN'} ${width}, ${first} response first`, async ({ browser, request }) => {
    await request.post(fixture, { data: { reset: true } })
    await request.post(fixture, { data: { delegation: true, patients: true, documents: true, availability: true, appointments: true } })
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    const releases: (() => void)[] = []
    try {
      await context.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: 'http://127.0.0.1:4337' }])
      await context.addInitScript(() => localStorage.setItem('building-suit.theme', 'light'))
      await context.route('**/*', route => ['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
      const page = await context.newPage()
      await localRealtimeProtocol(page)
      const copy = doctorAppointmentsCopy(ar)
      await page.goto('/appointments')
      await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill('synthetic-doctor-a@example.test')
      await doctorPasswordStep(page);await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only')
      await page.getByRole('button', { name: ar ? 'تسجيل الدخول' : 'Sign in', exact: true }).press('Enter')
      const scope = page.getByRole('combobox', { name: ar ? 'الممارسة والموقع' : 'Practice and location', exact: true })
      await scope.click()
      await page.getByRole('option', { name: / · Clinic A1$/ }).click()
      await expect(scope).toHaveAttribute('aria-expanded', 'false')
      const date = page.locator('main').getByLabel(copy.date, { exact: true })
      await expect(date).toBeVisible()
      const data = (await (await request.get(fixture)).json()).delegation
      const patientId = data.patientRows.find((row: { name: string }) => row.name === patientLabel).id
      await date.fill(data.scheduleTestDay)
      await date.press('Tab')
      const patients = await hold(page, 'doctor_patients')
      const offers = await hold(page, 'doctor_availability')
      releases.push(patients.release, offers.release)
      await tabTo(page, page.getByRole('button', { name: copy.create, exact: true }))
      await page.keyboard.press('Enter')
      const booking = page.getByRole('dialog', { name: copy.create, exact: true })
      const patient = booking.getByRole('combobox', { name: copy.patient, exact: true })
      const slot = booking.getByRole('combobox', { name: copy.slot, exact: true })
      const save = booking.getByRole('button', { name: copy.save, exact: true })
      await Promise.all([patients.arrived(), offers.arrived()])
      await expect(slot).toBeDisabled()
      await expect(save).toBeDisabled()

      async function choosePatient() {
        await patients.deliver()
        await tabTo(page, patient)
        await page.keyboard.press('Enter')
        await expect(page.getByRole('option', { name: patientLabel, exact: true })).toBeVisible()
        await page.keyboard.press('Home')
        await page.keyboard.press('Enter')
        await selected(patient, patientLabel)
      }
      async function chooseSlot() {
        await offers.deliver()
        await tabTo(page, slot)
        await page.keyboard.press('Enter')
        await page.keyboard.press('Home')
        // Hold the actual deferred Select close. The new label can already be
        // visible while focus return is still queued; it is not readiness.
        await page.clock.install()
        await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100))
        await page.keyboard.press('Enter')
        await expect(slot).toContainText('09:00')
        await expect(slot).toHaveAttribute('aria-expanded', 'true')
        await page.clock.runFor(1)
        await page.clock.resume()
        await selected(slot, '09:00')
      }
      if (first === 'patients') {
        await choosePatient()
        await expect(slot).toBeDisabled()
        await expect(save).toBeDisabled()
        await chooseSlot()
      } else {
        await chooseSlot()
        await expect(save).toBeDisabled()
        await choosePatient()
      }
      await expect(save).toBeEnabled()
      const command = await hold(page, 'doctor_book_appointment')
      releases.push(command.release)
      await tabTo(page, save)
      await page.keyboard.press('Enter')
      await command.arrived()
      await expect(save).toBeDisabled()
      await page.keyboard.press('Enter')
      await page.keyboard.press('Escape')
      await expect(booking).toBeVisible()
      await command.deliver()
      await expect(booking).toBeHidden()
      await expect(page.locator('.bs-appointment-event').filter({ hasText: patientLabel })).toHaveCount(1)
      const final = (await (await request.get(fixture)).json()).delegation
      expect(final.appointmentRows.filter((row: { patient_id: string; starts_at: string }) => row.patient_id === patientId && row.starts_at.startsWith(data.scheduleTestDay))).toHaveLength(1)
    } finally {
      releases.forEach(release => release())
      try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() }
    }
  })
}

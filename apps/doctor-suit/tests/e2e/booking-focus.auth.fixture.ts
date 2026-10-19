import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { test, expect, type Page, type Locator } from '@playwright/test'
import { doctorAppointmentsCopy } from '../../app/utils/appointmentsPresentation'
import { localRealtimeProtocol } from './realtimeProtocol'

const fixture = 'http://127.0.0.1:4338/__fixture'
async function tabTo(page: Page, target: Locator) {
  await expect(target).toBeVisible()
  for (let index = 0; index < 100; index++) {
    if (await target.evaluate(element => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target).toBeFocused()
}

for (const ar of [true, false]) for (const width of [390, 1280]) {
  test(`booking keyboard focus survives an in-flight board refresh: ${ar ? 'AR' : 'EN'} light ${width}`, async ({ browser, request }) => {
    await request.post(fixture, { data: { reset: true } })
    await request.post(fixture, { data: { delegation: true, patients: true, documents: true, availability: true, appointments: true } })
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
    let release: (() => void) | undefined
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
      const picker = page.getByRole('combobox', { name: ar ? 'الممارسة والموقع' : 'Practice and location', exact: true })
      await picker.click()
      await page.getByRole('option', { name: / · Clinic A1$/ }).click()
      await expect(picker).toContainText('Clinic A1')
      const boardDate = page.locator('main').getByLabel(copy.date, { exact: true })
      const create = page.getByRole('button', { name: copy.create, exact: true })
      await tabTo(page, create)
      await expect(create).toBeFocused()

      let captured = 0
      const held = new Promise<void>(resolve => { release = resolve })
      await page.route('**/rest/v1/rpc/doctor_appointment_board', async route => {
        const response = await route.fetch()
        captured++
        await held
        await route.fulfill({ response }).catch(() => {})
      })
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect.poll(() => captured).toBeGreaterThan(0)
      await expect(boardDate).toHaveCount(0)
      // A read must not remove the permitted action between keyboard focus and
      // activation. The real synthetic board response is still deliberately held.
      await expect(create).toBeFocused()
      await page.keyboard.press('Enter')
      const booking = page.getByRole('dialog', { name: copy.create, exact: true })
      await expect(booking).toBeVisible()
      await expect(booking.getByRole('combobox', { name: copy.patient, exact: true })).toBeVisible()
      const delivered = page.waitForResponse('**/rest/v1/rpc/doctor_appointment_board')
      release()
      const response = await delivered
      expect(response.ok()).toBe(true)
      expect(await response.finished()).toBeNull()
      // Network completion precedes the async adapter/controller/Vue update.
      // This control returns only after the board loading branch has cleared.
      await expect(boardDate).toBeVisible()
      await expect(booking).toBeVisible()
      await page.keyboard.press('Escape')
      await expect(booking).toBeHidden()
      await expect(create).toBeFocused()
    } finally {
      release?.()
      try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() }
    }
  })
}

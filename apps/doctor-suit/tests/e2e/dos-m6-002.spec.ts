import { test, expect } from '@playwright/test'
import { doctorPasswordStep } from '../helpers/password-step.mjs'
import { doctorPatientsCopy } from '../../app/utils/patientsPresentation'
import { doctorLocationsCopy } from '../../app/utils/locationsPresentation'
const fixture = 'http://127.0.0.1:4338/__fixture', origin = 'http://127.0.0.1:4337', practice = 'a3000000-0000-4000-8000-000000000001'
// Owned HTTP protocol fixture, not actual Supabase/merchant/RLS acceptance. No Auth artifacts.
for (const ar of [false, true]) test(`DOS-M6-002 ${ar ? 'AR mobile' : 'EN desktop'} protocol: expired history and withdrawn draft never restore writes`, async ({ browser, request }) => {
  test.setTimeout(90000)
  expect((await request.post(fixture, { data: { reset: true } })).ok()).toBe(true)
  const expired = { state: 'expired', revision: 1, writes_allowed: false, can_add_staff: false, can_add_clinic: false, over_limit: false, valid_until: new Date(Date.now() - 1000).toISOString() }
  expect((await request.post(fixture, { data: { delegation: true, patients: true, edition: 'administrative_candidate', editionRevision: 2, entitlements: { [practice]: expired } } })).ok()).toBe(true)
  const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280, height: 1000 } })
  try {
    await context.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: origin }])
    await context.route('**/*', route => [origin, 'http://127.0.0.1:4338'].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
    const page = await context.newPage(), patients = doctorPatientsCopy(ar), locations = doctorLocationsCopy(ar)
    page.setDefaultTimeout(15000)
    await page.goto(origin + '/patients')
    await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill('synthetic-doctor-a@example.test')
    await doctorPasswordStep(page)
    await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only')
    await page.getByRole('button', { name: ar ? 'تسجيل الدخول' : 'Sign in', exact: true }).click()
    const picker = page.getByRole('combobox', { name: ar ? 'الممارسة والموقع' : 'Practice and location', exact: true })
    await picker.click(); await page.getByRole('option', { name: / · Clinic A1$/ }).click()
    await expect(page.getByRole('row').filter({ hasText: 'Synthetic A patient 02' })).toBeVisible()
    await expect(page.getByRole('button', { name: patients.create, exact: true })).toHaveCount(0)
    const initialCount = (await (await request.get(fixture)).json()).delegation.patientRows.length
    await page.goto(origin + '/locations')
    await expect(page.getByRole('button', { name: locations.create, exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: locations.archive, exact: true }).first()).toBeVisible()
    const active = { ...expired, state: 'trial', writes_allowed: true, valid_until: new Date(Date.now() + 3600000).toISOString() }
    expect((await request.post(fixture, { data: { entitlements: { [practice]: active } } })).ok()).toBe(true)
    await page.goto(origin + '/patients'); await picker.click(); await page.getByRole('option', { name: / · Clinic A1$/ }).click()
    await page.getByRole('button', { name: patients.create, exact: true }).click()
    const editor = page.getByRole('dialog', { name: patients.create, exact: true })
    await editor.getByLabel(ar ? /^الاسم المُدخل/ : /^Entered name/).fill('Synthetic M6 discarded expired draft')
    expect((await request.post(fixture, { data: { entitlements: { [practice]: { ...expired, valid_until: new Date(Date.now() - 1000).toISOString() } } } })).ok()).toBe(true)
    await editor.getByRole('button', { name: patients.save, exact: true }).click()
    await expect(editor).toBeHidden()
    await expect(page.getByRole('button', { name: patients.create, exact: true })).toHaveCount(0)
    await expect(page.getByRole('row').filter({ hasText: 'Synthetic A patient 02' })).toBeVisible()
    const after = (await (await request.get(fixture)).json()).delegation.patientRows
    expect(after.length).toBe(initialCount)
    expect(after.some((row: { name: string }) => row.name === 'Synthetic M6 discarded expired draft')).toBe(false)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  } finally { await context.unrouteAll({ behavior: 'ignoreErrors' }); await context.close() }
})

import { financialBillingDiagnostic } from './financial-notice-diagnostics'
import { test, expect, type BrowserContext, type Page } from '@playwright/test'
import { practiceBillingCopy } from '../../app/utils/practiceBillingPresentation'
type Storage = Awaited<ReturnType<BrowserContext['storageState']>>
interface VisitFixture { visit_id: string; patient_id: string; version: number; starts_at: string; patient_name: string }
interface Fixture { origin: string; api: string; storageState: Storage; billing: { reference: string; timezone: string; EN: VisitFixture; AR: VisitFixture; readonlyStorageState: Storage; readonlyServiceLabel: string } }
for (const ar of [false, true]) test(`DOS-M6-006-C02-${ar ? 'AR' : 'EN'}`, async ({ browser }) => {
 const phase = (description: string) => test.info().annotations.push({ type: 'financial-stage', description })
 phase('fixture')
 if (process.env.DOCTOR_FINANCIAL_ACCEPTANCE !== 'owned-actual-provider') throw Error('Owned financial fixture required')
 const f = JSON.parse(process.env.DOCTOR_FINANCIAL_FIXTURE ?? '{}') as Fixture
 if (f.origin !== 'http://127.0.0.1:4341' || f.api !== 'http://127.0.0.1:65321' || !Array.isArray(f.storageState?.cookies) || !Array.isArray(f.billing?.readonlyStorageState?.cookies) || !/^SYNTHETIC-BILLING-[a-f0-9-]{36}$/.test(f.billing.reference)) throw Error('Owned billing target required')
 const copy = practiceBillingCopy(ar), locale = ar ? 'AR' : 'EN', source = f.billing[locale], service = f.billing.reference + '-' + locale
 async function context(storageState: Storage) {
  const c = await browser.newContext({ storageState, viewport: { width: ar ? 390 : 1280, height: 1000 }, colorScheme: ar ? 'dark' : 'light' })
  await c.route('**/*', route => [f.origin, f.api].includes(new URL(route.request().url()).origin) ? route.continue() : route.abort())
  await c.addCookies([{ name: 'building-suit-locale', value: ar ? 'ar' : 'en', url: f.origin }])
  await c.addInitScript(({ dark }) => localStorage.setItem('building-suit.theme', dark ? 'dark' : 'light'), { dark: ar })
  return c
 }
 let diagnosticPage:Page|undefined
 const owner = await context(f.storageState); let readonly: BrowserContext | undefined
 try {
  phase('route')
  const page = await owner.newPage(); diagnosticPage=page; await page.goto(f.origin + '/practice-billing')
  await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible()
  phase('price_button')
  await page.getByRole('button', { name: copy.createPrice, exact: true }).click()
  phase('price_form')
  let dialog = page.getByRole('dialog', { name: copy.createPrice, exact: true })
  await dialog.getByLabel(copy.label, { exact: true }).fill(service); await dialog.getByLabel(copy.amount, { exact: true }).fill('125.55'); await dialog.getByLabel(copy.currency, { exact: true }).fill('EGP')
  await dialog.getByRole('combobox', { name: copy.exponent, exact: true }).click(); await page.getByRole('option', { name: '2', exact: true }).click()
  phase('price_save'); await dialog.getByRole('button', { name: copy.save, exact: true }).click(); await expect(dialog).toBeHidden()
  phase('price_saved'); await expect(page.getByRole('row').filter({ hasText: service })).toContainText('125.55 EGP')
  phase('charge_create')
  let lost = false
  const commands: { p_key: string; p_visit: string; p_visit_version: number; p_patient: string; p_price: string; p_quantity: number }[] = []
  await page.route(f.api + '/rest/v1/rpc/doctor_write_visit_charge', async route => {
   const body = JSON.parse(route.request().postData() ?? '{}') as { p_key: string; p_visit: string; p_visit_version: number; p_patient: string; p_price: string; p_quantity: number }; commands.push({ p_key: body.p_key, p_visit: body.p_visit, p_visit_version: body.p_visit_version, p_patient: body.p_patient, p_price: body.p_price, p_quantity: body.p_quantity })
   if (lost) return route.continue()
   lost = true; const response = await route.fetch(); expect(response.ok()).toBe(true); await response.dispose(); await route.abort('failed')
  })
  await page.getByRole('button', { name: copy.createCharge, exact: true }).click(); dialog = page.getByRole('dialog', { name: copy.createCharge, exact: true })
  await dialog.getByRole('combobox', { name: copy.service, exact: true }).click(); await page.getByRole('option').filter({ hasText: service }).click()
  const when = await page.evaluate(({ ar, timezone, starts }) => new Intl.DateTimeFormat(ar ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(new Date(starts)), { ar, timezone: f.billing.timezone, starts: source.starts_at })
  await dialog.getByRole('combobox', { name: copy.visit, exact: true }).click(); await page.getByRole('option', { name: source.patient_name + ' · ' + when, exact: true }).click()
  await dialog.getByLabel(copy.quantity, { exact: true }).fill('2'); await dialog.getByLabel(copy.reason, { exact: true }).fill('SYNTHETIC_ORIGINAL_CHARGE_' + locale)
  await dialog.getByRole('button', { name: copy.save, exact: true }).click(); await dialog.getByRole('button', { name: copy.retryOperation, exact: true }).click(); await expect(dialog).toBeHidden()
  expect(commands.length).toBe(2); expect(commands[0]).toEqual(commands[1]); expect(commands[0]!.p_visit).toBe(source.visit_id); expect(commands[0]!.p_quantity).toBe(2); expect(commands[0]!.p_visit_version).toBe(source.version); expect(commands[0]!.p_patient).toBe(source.patient_id)
  await page.unroute(f.api + '/rest/v1/rpc/doctor_write_visit_charge')
  let chargeRow = page.getByRole('row').filter({ hasText: service }).filter({ hasText: '251.10 EGP' }); await expect(chargeRow).toHaveCount(1)
  phase('price_change')
  await page.getByRole('row').filter({ hasText: service }).getByRole('button', { name: copy.editPrice, exact: true }).click(); dialog = page.getByRole('dialog', { name: copy.editPrice, exact: true })
  await dialog.getByLabel(copy.amount, { exact: true }).fill('180.75'); await dialog.getByRole('button', { name: copy.save, exact: true }).click(); await expect(dialog).toBeHidden()
  await expect(page.getByRole('row').filter({ hasText: service }).filter({ hasText: '251.10 EGP' })).toHaveCount(1)
  phase('charge_history')
  chargeRow = page.getByRole('row').filter({ hasText: service }).filter({ hasText: '251.10 EGP' })
  await chargeRow.getByRole('button', { name: copy.history, exact: true }).click(); let history = page.getByRole('dialog', { name: copy.history, exact: true })
  await expect(history.getByText('251.10 EGP', { exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(history).toBeHidden()
  await chargeRow.getByRole('button', { name: copy.correctCharge, exact: true }).click(); dialog = page.getByRole('dialog', { name: copy.correctCharge, exact: true })
  await expect(dialog.getByRole('combobox', { name: copy.visit, exact: true })).toBeDisabled()
  await dialog.getByLabel(copy.quantity, { exact: true }).fill('1'); await dialog.getByLabel(copy.reason, { exact: true }).fill('SYNTHETIC_EXPLICIT_CORRECTION_' + locale)
  await dialog.getByRole('button', { name: copy.save, exact: true }).click(); await expect(dialog).toBeHidden()
  chargeRow = page.getByRole('row').filter({ hasText: service }).filter({ hasText: '180.75 EGP' }).filter({ has: page.getByRole('button', { name: copy.history, exact: true }) })
  await expect(chargeRow).toHaveCount(1); await chargeRow.getByRole('button', { name: copy.history, exact: true }).click(); history = page.getByRole('dialog', { name: copy.history, exact: true })
  await expect(history.getByText('251.10 EGP', { exact: true })).toBeVisible(); await expect(history.getByText('180.75 EGP', { exact: true })).toBeVisible(); await page.keyboard.press('Escape'); await expect(history).toBeHidden()
  phase('direction_and_viewport')
  await expect(page.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr'); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  phase('read_only')
  readonly = await context(f.billing.readonlyStorageState); const blocked = await readonly.newPage(); await blocked.goto(f.origin + '/practice-billing')
  await expect(blocked.getByRole('heading', { name: copy.title, exact: true })).toBeVisible(); await expect(blocked.getByText(copy.readOnly, { exact: true })).toBeVisible()
  await expect(blocked.getByRole('row').filter({ hasText: f.billing.readonlyServiceLabel }).filter({ hasText: '123.45 EGP' })).toHaveCount(2)
  await expect(blocked.getByRole('button', { name: copy.createPrice, exact: true })).toHaveCount(0); await expect(blocked.getByRole('button', { name: copy.createCharge, exact: true })).toHaveCount(0); await expect(blocked.getByRole('row').filter({ hasText: service })).toHaveCount(0)
  await blocked.getByRole('row').filter({ hasText: f.billing.readonlyServiceLabel }).getByRole('button', { name: copy.history, exact: true }).click(); await expect(blocked.getByRole('dialog', { name: copy.history, exact: true }).getByText('123.45 EGP', { exact: true })).toBeVisible()
  await expect(blocked.locator('html')).toHaveAttribute('dir', ar ? 'rtl' : 'ltr')
 } catch(error) { await financialBillingDiagnostic(diagnosticPage,test.info(),'billing');throw error } finally { for (const c of [owner, readonly]) if (c) { await c.unrouteAll({ behavior: 'ignoreErrors' }); await c.close() } }
})

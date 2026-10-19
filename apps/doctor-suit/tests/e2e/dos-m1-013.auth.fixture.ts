import{doctorPasswordStep}from'../helpers/password-step.mjs'
import { test,expect,type BrowserContext,type Page } from '@playwright/test'
import { doctorAvailabilityCopy } from '../../app/utils/availabilityPresentation'
import { doctorDelegationCopy } from '../../app/utils/delegationPresentation'
test.use({ actionTimeout: 10000 })
const fixture = 'http://127.0.0.1:4338/__fixture'; const base = 'http://127.0.0.1:4337'
async function local(context: BrowserContext,ar: boolean) {
  await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: base }]); await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark')
  await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
}
async function lifecycle(page: Page) {
  const diagnostic = await page.evaluate(() => {
    const root = document.querySelector('#__nuxt'); const app = root && Reflect.get(root,'__vue_app__'); const nuxt = app?.config.globalProperties.$nuxt
    const auth = nuxt?.$doctorAuth?.state; const context = nuxt?.$doctorContext?.state; const availability = nuxt?.$doctorAvailability?.state
    return { path: location.pathname,auth: auth?.phase ?? null,authPending: Boolean(auth?.pending),context: context?.phase ?? null,options: context?.options?.length ?? null,current: Boolean(context?.current),availabilityError: availability?.error ?? null,configuration: Boolean(availability?.config) }
  }).catch(() => null)
  console.info('Doctor availability lifecycle',diagnostic)
}
async function login(page: Page,email: string,ar: boolean) {
  await page.goto('/availability'); await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill(email); await doctorPasswordStep(page);await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only')
  await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click(); try { await expect(page).toHaveURL(url => url.pathname==='/availability') } catch (error) { await lifecycle(page); throw error }
}
async function choose(page: Page,ar: boolean,clinic: string) {
  const select = page.getByRole('combobox',{ name: ar ? 'الممارسة والموقع' : 'Practice and location',exact: true }); try { await select.click() } catch (error) { await lifecycle(page); throw error }; await page.getByRole('option',{ name: new RegExp(` · ${clinic}$`) }).click(); await expect(select).toContainText(clinic); await expect(select).toBeEnabled()
}
async function close(contexts: BrowserContext[]) { await Promise.allSettled(contexts.map(async context => { try { await context.unrouteAll({ behavior: 'ignoreErrors' }) } finally { await context.close() } })) }
test.beforeEach(async ({ request }) => { await request.post(fixture,{ data: { reset: true } }); await request.post(fixture,{ data: { delegation: true,patients: true,availability: true } }) })
for (const ar of [false,true]) test(`DOS-M1-013-C01/C02/C03/C04 ${ar ? 'AR mobile light' : 'EN desktop dark'}: weekly hours, exceptions, uncertain save, unchanged commitments and scope`,async ({ browser,request }) => {
  test.setTimeout(90000)
  const copy = doctorAvailabilityCopy(ar); const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } })
  try {
    await local(context,ar); const page = await context.newPage(); await login(page,'synthetic-doctor-a@example.test',ar); await choose(page,ar,'Clinic A1')
    await expect(page.locator('html')).toHaveAttribute('data-theme',ar ? 'light' : 'dark'); await expect(page.getByText(copy.override,{ exact: true })).toBeVisible(); await expect(page.getByText(copy.preservation,{ exact: true })).toBeVisible(); await expect(page.getByText(copy.unconfigured,{ exact: true })).toBeVisible()
    const data = (await (await request.get(fixture)).json()).delegation; const before = data.scheduleCommitments; const day = data.scheduleTestDay; const weekday = copy.weekdays[new Date(`${day}T12:00:00Z`).getUTCDay()]
    await page.getByRole('button',{ name: copy.addWindow,exact: true }).click(); const dialog = page.getByRole('dialog',{ name: copy.addWindow,exact: true })
    await dialog.getByRole('combobox',{ name: copy.weekday,exact: true }).click(); await page.getByRole('option',{ name: weekday,exact: true }).click()
    await page.route('**/rest/v1/rpc/doctor_write_schedule',async route => { await route.fetch(); await route.abort('failed') },{ times: 1 })
    await dialog.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(dialog.getByText(copy.network,{ exact: true })).toBeVisible()
    await dialog.getByRole('button',{ name: copy.save,exact: true }).evaluate(button => { (button as HTMLButtonElement).click(); (button as HTMLButtonElement).click() }); await expect(dialog).toBeHidden()
    const state = (await (await request.get(fixture)).json()).delegation; expect(state.scheduleRules[data.locations[0].id].version).toBe(1); expect(state.scheduleEvents).toHaveLength(1)
    await page.getByLabel(copy.date,{ exact: true }).fill(day); await page.getByLabel(copy.date,{ exact: true }).press('Tab'); await expect(page.getByRole('cell',{ name: copy.busy,exact: true })).toBeVisible()
    await page.route('**/rest/v1/rpc/doctor_availability',route => route.abort('failed'),{ times: 1 })
    await page.getByRole('button',{ name: copy.retry,exact: true }).click(); await expect(page.getByText(copy.network,{ exact: true })).toBeVisible()
    await page.getByRole('button',{ name: copy.retry,exact: true }).first().click(); await expect(page.getByRole('cell',{ name: copy.busy,exact: true })).toBeVisible()
    await page.getByRole('button',{ name: copy.addWindow,exact: true }).click(); await dialog.getByRole('combobox',{ name: copy.weekday,exact: true }).click(); await page.getByRole('option',{ name: weekday,exact: true }).click()
    await dialog.getByLabel(ar ? /^بداية الفترة/ : /^Window start/).fill('10:00'); await dialog.getByLabel(ar ? /^نهاية الفترة/ : /^Window end/).fill('12:00'); await expect(dialog.getByRole('button',{ name: copy.save,exact: true })).toBeDisabled(); await expect(dialog.getByText(copy.invalid,{ exact: true })).toBeVisible()
    await dialog.getByRole('button',{ name: copy.cancel,exact: true }).click(); await expect(dialog).toBeVisible(); await dialog.getByRole('button',{ name: ar ? 'تأكيد' : 'Confirm',exact: true }).click(); await expect(dialog).toBeHidden()
    await page.getByRole('button',{ name: copy.addException,exact: true }).click(); const exception = page.getByRole('dialog',{ name: copy.addException,exact: true }); await exception.getByLabel(ar ? /^السبب الإداري/ : /^Administrative reason/).fill('Synthetic closed day')
    await exception.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(exception).toBeHidden(); await expect(page.getByText(copy.empty,{ exact: true })).toBeVisible()
    const row = page.getByRole('row',{ name: /Synthetic closed day/ }); await row.getByRole('button',{ name: copy.edit,exact: true }).click(); const edit = page.getByRole('dialog',{ name: copy.editException,exact: true }); await edit.getByRole('checkbox',{ name: copy.closed,exact: true }).uncheck()
    await edit.getByLabel(ar ? /^بداية الفترة 1/ : /^Window start 1/).fill('10:00'); await edit.getByLabel(ar ? /^نهاية الفترة 1/ : /^Window end 1/).fill('11:00'); await edit.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(edit).toBeHidden()
    await expect(page.getByRole('region',{ name: copy.slots,exact: true }).getByRole('cell',{ name: copy.available,exact: true })).toHaveCount(3)
    await page.getByRole('button',{ name: copy.duration,exact: true }).click(); const duration = page.getByRole('dialog',{ name: copy.duration,exact: true }); await duration.getByLabel(ar ? /^مدة الموعد بالدقائق/ : /^Appointment duration in minutes/).fill('30'); await duration.getByRole('button',{ name: copy.save,exact: true }).click(); await expect(duration).toBeHidden()
    await expect(page.getByRole('region',{ name: copy.slots,exact: true }).getByRole('cell',{ name: copy.available,exact: true })).toHaveCount(2)
    const after = (await (await request.get(fixture)).json()).delegation; expect(after.scheduleCommitments).toEqual(before); expect(after.scheduleEvents.every((item: { appointments_changed: boolean }) => item.appointments_changed===false)).toBe(true)
    expect(after.scheduleRules[data.locations[0].id].slot_minutes).toBe(30)
    await choose(page,ar,'Clinic A2'); await expect(page.getByText(`${copy.slotMinutes}: 40`,{ exact: true })).toBeVisible(); await expect(page.getByText('Synthetic closed day',{ exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } finally { await close([context]) }
})
for (const ar of [false,true]) test(`DOS-M1-010/013 ${ar ? 'AR mobile' : 'EN desktop'}: independent clinics, readonly rules and open-draft revocation`,async ({ browser }) => {
  test.setTimeout(90000)
  const copy = doctorAvailabilityCopy(ar); const access = doctorDelegationCopy(ar); const staffContext = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } }); const ownerContext = await browser.newContext()
  try {
    await local(staffContext,ar); await local(ownerContext,ar); const staff = await staffContext.newPage(); const owner = await ownerContext.newPage()
    await login(staff,'synthetic-secretary@example.test',ar); await choose(staff,ar,'Clinic A1'); await expect(staff.getByRole('button',{ name: copy.addWindow,exact: true })).toBeVisible()
    await choose(staff,ar,'Clinic A2'); await expect(staff.getByRole('button',{ name: copy.addWindow,exact: true })).toHaveCount(0); await expect(staff.getByText(copy.readOnly,{ exact: true })).toBeVisible()
    await choose(staff,ar,'Clinic B1'); await expect(staff.getByText(`${copy.slotMinutes}: 20`,{ exact: true })).toBeVisible(); await expect(staff.getByRole('button',{ name: copy.duration,exact: true })).toHaveCount(0)
    await choose(staff,ar,'Clinic A1'); await staff.getByRole('button',{ name: copy.addWindow,exact: true }).click(); const dirty = staff.getByRole('dialog',{ name: copy.addWindow,exact: true }); await dirty.getByLabel(ar ? /^نهاية الفترة/ : /^Window end/).fill('18:00')
    await login(owner,'synthetic-doctor-a@example.test',ar); await choose(owner,ar,'Clinic A1'); await owner.goto('/team'); await owner.getByRole('row',{ name: /synthetic-secretary@example.test/ }).getByRole('button',{ name: access.revoke,exact: true }).click(); await owner.getByRole('dialog',{ name: access.actionTitle,exact: true }).getByRole('button',{ name: access.confirm,exact: true }).click()
    await staff.bringToFront(); await staff.evaluate(() => window.dispatchEvent(new Event('focus'))); await expect(dirty).toBeHidden(); await expect(staff.getByRole('button',{ name: copy.addWindow,exact: true })).toHaveCount(0)
    await choose(staff,ar,'Clinic B1'); await expect(staff.getByText(copy.readOnly,{ exact: true })).toBeVisible(); await expect(staff.getByText(`${copy.slotMinutes}: 20`,{ exact: true })).toBeVisible()
  } finally { await close([staffContext,ownerContext]) }
})

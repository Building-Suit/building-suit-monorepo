import { test,expect } from '@playwright/test'
import { doctorAccountCopy } from '../../app/utils/accountPresentation'
const fixture = 'http://127.0.0.1:4338/__fixture'
for(const ar of [false,true])test(`DOS-M1-016-C01/C02/C03/C04 ${ar ? 'AR mobile light' : 'EN desktop dark'} personal settings and expired sign-in recovery`,async ({ browser,request }) => {
  test.setTimeout(90000);await request.post(fixture,{ data: { reset: true } })
  const context = await browser.newContext({ viewport: { width: ar ? 390 : 1280,height: 1000 } });const copy = doctorAccountCopy(ar)
  try {
    await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: 'http://127.0.0.1:4337' }]);await context.addInitScript(theme => localStorage.setItem('building-suit.theme',theme),ar ? 'light' : 'dark')
    await context.route('**/*',route => ['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
    const page = await context.newPage()
    async function login() { await page.getByLabel(ar ? /^البريد الإلكتروني/ : /^Email/).fill('synthetic@example.test');await page.getByLabel(ar ? /^كلمة المرور/ : /^Password/).fill('synthetic-password-only');await page.getByRole('button',{ name: ar ? 'تسجيل الدخول' : 'Sign in',exact: true }).click();await expect(page).toHaveURL(/\/account$/) }
    await page.goto('/account');await login();await expect(page.getByRole('heading',{ name: copy.title,exact: true })).toBeVisible()
    await expect(page.getByText(copy.unavailable,{ exact: true })).toBeVisible();await expect(page.getByRole('button',{ name: /Subscribe|Export|اشتراك|تصدير/ })).toHaveCount(0)
    await page.getByRole('button',{ name: copy.edit,exact: true }).click();let dialog = page.getByRole('dialog',{ name: copy.edit,exact: true })
    await expect(dialog.getByRole('checkbox',{ name: copy.confirmations })).not.toBeChecked();await dialog.getByLabel(copy.name,{ exact: true }).fill('Synthetic personal account');await dialog.getByRole('checkbox',{ name: copy.confirmations }).check();await dialog.getByRole('button',{ name: copy.save,exact: true }).click();await expect(dialog).toHaveCount(0);await expect(page.getByText(copy.saved,{ exact: true })).toBeVisible()
    let data = await (await request.get(fixture)).json();expect(data.profile).toBeNull();expect(data.accountWrites).toBe(1);expect(data.account.personal_name).toBe('Synthetic personal account');expect(data.outbox).toEqual([])
    await request.post(fixture,{ data: { accountExpired: true } });await page.getByRole('button',{ name: copy.edit,exact: true }).click();dialog = page.getByRole('dialog',{ name: copy.edit,exact: true });await dialog.getByLabel(copy.phone,{ exact: true }).fill('+12025550123');await dialog.getByRole('button',{ name: copy.save,exact: true }).click();await expect(dialog.getByText(copy.reauthenticate,{ exact: true })).toBeVisible()
    data = await (await request.get(fixture)).json();expect(data.accountWrites).toBe(1);expect(data.account.contact_phone).toBe('');const oldSid = data.sessionId
    await dialog.getByRole('button',{ name: copy.signIn,exact: true }).click();await expect(page).toHaveURL(/\/sign-in\?next=\/account$/);await login();await page.getByRole('button',{ name: copy.edit,exact: true }).click();dialog = page.getByRole('dialog',{ name: copy.edit,exact: true });await expect(dialog.getByLabel(copy.phone,{ exact: true })).toHaveValue('');await expect(dialog.getByLabel(copy.name,{ exact: true })).toHaveValue('Synthetic personal account');await dialog.getByLabel(copy.phone,{ exact: true }).fill('+12025550123');await dialog.getByRole('button',{ name: copy.save,exact: true }).click();await expect(dialog).toHaveCount(0)
    data = await (await request.get(fixture)).json();expect(data.sessionId).not.toBe(oldSid);expect(data.accountWrites).toBe(2);expect(data.account.contact_phone).toBe('+12025550123');expect(data.outbox).toEqual([]);expect(data.profile).toBeNull()
    await page.reload();await expect(page.getByText('+12025550123',{ exact: true })).toBeVisible();expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
  } finally { await context.unrouteAll({ behavior: 'ignoreErrors' });await context.close() }
})

import { expect, test } from '@playwright/test'
import { expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import { fixtureGoto } from './pilot-fixture'

for (const [locale, theme, width] of [['en', 'light', 1440], ['ar', 'dark', 390]] as const) {
  test(`flat public/auth tokens and recoverable sign-in: ${locale}/${theme}/${width}`, async ({ page, context }) => {
    const ar = locale === 'ar'
    await page.setViewportSize({ width, height: 1000 })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    let release: () => void = () => {}
    const pending = new Promise<void>(resolve => { release = resolve })
    await page.route('**/auth/v1/token*', async route => {
      await pending
      await route.fulfill({ status: 400, json: { code: 'invalid_credentials', message: 'Invalid login credentials' } })
    })
    await fixtureGoto(page, '/auth/login')
    await expect(page.locator('.bs-auth-layout')).toHaveAttribute('data-presentation', 'flat')
    const form = page.locator('.bs-auth-form')
    expect(await form.evaluate(el => ({ shadow: getComputedStyle(el).boxShadow, radius: getComputedStyle(el).borderRadius }))).toEqual({ shadow: 'none', radius: '14px' })
    expect(await page.locator('.bs-auth-form__title').evaluate(el => getComputedStyle(el).fontSize)).toBe('22px')
    if (width === 1440) expect(await page.locator('.ls-auth-showcase-content h2').evaluate(el => getComputedStyle(el).fontSize)).toBe('32px')
    await page.getByLabel(ar ? 'البريد الإلكتروني' : 'Email', { exact: false }).fill('synthetic@example.test')
    await page.getByLabel(ar ? 'كلمة المرور' : 'Password', { exact: false }).fill('synthetic-password')
    const submit = page.getByRole('button', { name: ar ? 'تسجيل الدخول' : 'Log in', exact: true })
    await submit.click()
    await expect(submit).toBeDisabled()
    release()
    await expect(page.getByRole('alert')).toContainText(ar ? 'غير صحيحة' : 'incorrect')
    await expect(submit).toBeEnabled()
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('flat-sign-in.png'), fullPage: true, animations: 'disabled' })
    await fixtureGoto(page, '/auth/forgot-password')
    await expect(page.locator('.bs-auth-layout')).toHaveAttribute('data-presentation', 'flat')
    await expect(page.locator('.bs-auth-form__title')).toBeVisible()
    await expectNoPageOverflow(page)
    await fixtureGoto(page, '/privacy')
    expect(await page.locator('main.bs-public-legal-page--flat h1').evaluate(el => getComputedStyle(el).fontSize)).toBe('32px')
    expect(await page.locator('main.bs-public-legal-page--flat h2').first().evaluate(el => getComputedStyle(el).fontSize)).toBe('22px')
    await expectNoPageOverflow(page)
    await page.screenshot({ path: test.info().outputPath('flat-legal.png'), fullPage: true, animations: 'disabled' })
  })
}

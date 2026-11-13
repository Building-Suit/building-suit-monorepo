import { expect, test } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'
import { login } from './pilot-backend'

// Exercise the native pilot's UI driver against the current built login form.
// This deliberately synthetic transport is NOT native Auth/financial acceptance.
for (const locale of ['en', 'ar']) {
  test(`native pilot login driver follows current email/password stages: ${locale}`, async ({ page }) => {
    await pilotFixture(page, locale)
    // This is this test's synthetic context only; retain its transport handlers
    // while starting the actual login driver without an authenticated cookie.
    await page.context().clearCookies()
    await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
    await login(page, { email: 'pilot@example.test', password: 'fixture-password', token: 'unused-by-ui-driver' }, locale)
    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('main').getByRole('heading', { name: locale === 'ar' ? 'لوحة التحكم' : 'Operating dashboard', exact: true })).toBeVisible()
  })
}

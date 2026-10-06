import { test, expect } from '@playwright/test'

// Presentation coverage uses controlled session responses. Database and server
// authorization are verified separately; these mocks do not prove real login.
for (const locale of ['en', 'ar']) {
  for (const mobile of [false, true]) {
    test(`session states ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
      await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
      await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
      let code = 401
      let delayResponse = false
      await page.route('**/api/registry', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{"suits":[]}' }))
      await page.route('**/api/session', async route => {
        if (delayResponse) await new Promise(resolve => setTimeout(resolve, 500))
        await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(code === 200 ? { userId: 'fixture', role: 'owner', authorityEnvironmentId: 'fixture-env' } : { statusCode: code }) })
      })
      // SSR returns unauthenticated using the local test project; client retry
      // controls the other rendered states without weakening production code.
      // Wait for the mounted auth listener's INITIAL_SESSION recheck. The SSR
      // form is visible before hydration, but that recheck replaces it while
      // loading; focusing the SSR input would race with its removal.
      const initialSession = page.waitForResponse(response => new URL(response.url()).pathname === '/api/session')
      await page.goto('/')
      await page.waitForFunction(() => {
        const root = document.querySelector('#__nuxt') as (Element & { __vue_app__?: { $nuxt: { isHydrating: boolean } } }) | null
        return root?.__vue_app__?.$nuxt.isHydrating === false
      })
      await initialSession
      await expect(page.locator('#admin-email')).toBeVisible()
      await page.locator('#admin-email').focus()
      await expect(page.locator('#admin-email')).toBeFocused()
      await page.keyboard.press('Tab')
      await expect(page.locator('#admin-password')).toBeFocused()
      await page.screenshot({ path: `/tmp/sas-auth-${locale}-${mobile}-login.png` })
      await page.route('**/auth/v1/token*', route => route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) }))
      await page.locator('#admin-email').fill('outsider@example.invalid')
      await page.locator('#admin-password').fill('Invalid-test-password-123')
      await page.getByRole('button', { name: locale === 'en' ? 'Sign in' : 'تسجيل الدخول', exact: true }).click()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(page.locator('#admin-password')).toHaveValue('')
      // A focus event forces a fresh server session request.
      code = 403
      delayResponse = true
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(page.locator('[data-state="loading"]')).toBeVisible()
      await expect(page.locator('[data-state="denied"]')).toBeVisible()
      delayResponse = false
      await page.screenshot({ path: `/tmp/sas-auth-${locale}-${mobile}-denied.png` })
      code = 503
      await page.locator('[data-state="denied"] button').click()
      await expect(page.locator('[data-state="error"]')).toBeVisible()
      code = 200
      await page.locator('[data-state="error"] button').click()
      await expect(page.locator('[data-state="success"]')).toBeVisible()
      await expect(page.locator('[data-state="empty"]')).toBeVisible()
      await page.screenshot({ path: `/tmp/sas-auth-${locale}-${mobile}-success.png` })
      code = 401
      await page.getByRole('button', { name: locale === 'en' ? 'Sign out' : 'تسجيل الخروج', exact: true }).click()
      await expect(page.locator('[data-state="success"]')).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    })
  }
}

test('server rejects an unauthenticated request without caching identity', async ({ request }) => {
  const response = await request.get('/api/session')
  expect(response.status()).toBe(401)
  expect(response.headers()['cache-control']).toBe('private, no-store')
})

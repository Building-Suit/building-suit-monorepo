import { test, expect } from '@playwright/test'

// Sanitized endpoint fixtures exercise the shell; SQL tests exercise authority.
const fixture = () => ({ suits: [
  { key: 'first-suit', label: { en: 'First Suit', ar: 'الحزمة الأولى' }, items: [{ key: 'overview', label: { en: 'First overview', ar: 'نظرة الحزمة الأولى' }, module: 'overview' }] },
  { key: 'future-suit', label: { en: 'Future Suit', ar: 'الحزمة المستقبلية' }, items: [{ key: 'context', label: { en: 'Capability context', ar: 'سياق الإمكانات' }, module: 'capabilities' }, { key: 'unsafe', label: { en: 'Unsafe', ar: 'غير آمن' }, module: 'unreviewed' }] },
] })
for (const locale of ['en', 'ar']) {
  for (const mobile of [false, true]) {
    test(`database navigation ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
      await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
      await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
      await page.route('**/api/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: 'fixture', role: 'owner', authorityEnvironmentId: 'fixture-env' }) }))
      let data = fixture()
      let code = 200
      let delayed = false
      await page.route('**/api/registry', async route => {
        if (delayed) await new Promise(resolve => setTimeout(resolve, 700))
        await route.fulfill({ status: code, contentType: 'application/json', body: JSON.stringify(code === 200 ? data : { statusCode: code }) })
      })
      await page.goto('/?suit=future-suit&item=context')
      await expect(page.locator('[data-registry-pending]')).toBeVisible()
      const rail = page.getByRole('navigation', { name: locale === 'en' ? 'Managed Suits' : 'الحزم المُدارة', exact: true })
      const context = page.getByRole('navigation', { name: locale === 'en' ? 'Suit navigation' : 'تنقل الحزمة', exact: true })
      const open = page.locator('button[aria-controls="bs-primary-navigation"]')
      async function showMenu() {
        if (mobile && !await rail.isVisible()) await open.click()
      }
      await showMenu()
      await expect(rail.getByRole('link', { name: locale === 'en' ? 'Future Suit' : 'الحزمة المستقبلية', exact: true })).toHaveAttribute('aria-current', 'true')
      await expect(context.getByRole('link')).toHaveCount(1)
      await expect(context.getByRole('link')).toHaveAttribute('aria-current', 'page')
      await page.screenshot({ path: `/tmp/sas-registry-${locale}-${mobile}-future.png` })
      const first = rail.getByRole('link', { name: locale === 'en' ? 'First Suit' : 'الحزمة الأولى', exact: true })
      await first.focus()
      await expect(first).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page).toHaveURL(/suit=first-suit/)
      await showMenu()
      await expect(context.getByRole('link')).toHaveText(locale === 'en' ? 'First overview' : 'نظرة الحزمة الأولى')
      if (mobile) {
        await page.keyboard.press('Escape')
        await expect(open).toBeFocused()
      }
      await page.goBack()
      await expect(page.locator('[data-registry-pending]')).toBeVisible()
      // Same runtime, changed database metadata/order/navigation.
      data.suits.reverse()
      data.suits[0]!.label = { en: 'Renamed Suit', ar: 'الحزمة المعدلة' }
      data.suits[0]!.items = []
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(page.locator('[data-state="denied"]')).toBeVisible()
      // Removed explicit context remains denied; empty rendering applies when
      // selecting the available Suit without a removed context deep link.
      await page.goto('/?suit=future-suit')
      await expect(page.locator('[data-state="empty"]')).toBeVisible()
      await showMenu()
      await expect(rail.getByRole('link').first()).toHaveAccessibleName(locale === 'en' ? 'Renamed Suit' : 'الحزمة المعدلة')
      await page.screenshot({ path: `/tmp/sas-registry-${locale}-${mobile}-empty.png` })
      if (mobile) await page.keyboard.press('Escape')
      code = 503
      await page.evaluate(() => window.dispatchEvent(new Event('focus')))
      await expect(page.locator('[data-state="error"]')).toBeVisible()
      await showMenu()
      await expect(rail.getByRole('link')).toHaveCount(0)
      if (mobile) await page.keyboard.press('Escape')
      code = 200
      delayed = true
      await page.locator('[data-state="error"] button').click()
      await expect(page.locator('[data-state="loading"]')).toBeVisible()
      await expect(page.locator('[data-state="empty"]')).toBeVisible()
      delayed = false
      code = 403
      await page.locator('[data-state="empty"] button').click()
      await expect(page.locator('[data-state="denied"]')).toBeVisible()
      code = 200
      data = { suits: [] }
      await page.locator('[data-state="denied"] button').click()
      await expect(page.locator('[data-state="denied"]')).toBeVisible()
      await page.goto('/')
      await expect(page.locator('[data-state="empty"]')).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    })
  }
}
test('registry denies unauthenticated reads and does not cache them', async ({ request }) => {
  const response = await request.get('/api/registry')
  expect(response.status()).toBe(401)
  expect(response.headers()['cache-control']).toBe('private, no-store')
})

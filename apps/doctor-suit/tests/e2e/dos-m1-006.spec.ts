import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar']) for (const width of [390, 1280]) {
  test(`DOS-M1-006 ${locale} ${width}px: unconfigured identity routes expose no credentials`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    const remote: string[] = []
    await page.route('**/*', route => {
      if (!['127.0.0.1', 'localhost'].includes(new URL(route.request().url()).hostname)) { remote.push(route.request().url()); return route.abort() }
      return route.continue()
    })
    for (const path of ['/sign-in?next=https://evil.example.test', '/sign-up', '/recover', '/verify?code=synthetic-expired', '/account']) {
      await page.goto(path)
      await expect(page.getByText(locale === 'en' ? 'Sign-in unavailable' : 'تسجيل الدخول غير متاح', { exact: true })).toBeVisible()
      await expect(page.locator('input[type="password"], input[type="email"], input[autocomplete="one-time-code"]')).toHaveCount(0)
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
    expect(remote).toEqual([])
  })
}

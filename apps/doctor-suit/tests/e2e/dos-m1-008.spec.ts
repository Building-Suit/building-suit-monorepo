import { test, expect } from '@playwright/test'
for (const locale of ['en', 'ar']) test(`DOS-M1-008 ${locale}: location administration is gated without a verified provider`, async ({ page, context }) => {
  await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
  await page.goto('/locations')
  await expect(page).toHaveURL(/\/sign-in\?next=/)
  await expect(page.getByText(locale === 'en' ? 'Sign-in unavailable' : 'تسجيل الدخول غير متاح', { exact: true })).toBeVisible()
  await expect(page.locator('input')).toHaveCount(0)
})

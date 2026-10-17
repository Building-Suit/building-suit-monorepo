import { test,expect } from '@playwright/test'
for(const ar of [false,true])test(`DOS-M1-020-C04 ${ar ? 'AR' : 'EN'}: combined preview preserves unavailable clinical payment and mobile boundaries`,async ({ page,context }) => {
  await context.addCookies([{ name: 'building-suit-locale',value: ar ? 'ar' : 'en',url: 'http://127.0.0.1:4336' }]);const response = await page.goto('/preview');expect(response?.headers()['x-robots-tag']).toContain('noindex');await expect(page.getByRole('main')).toBeVisible();await expect(page.getByRole('link',{ name: /App Store|Google Play|Checkout|Subscribe|اشترك|الدفع/ })).toHaveCount(0);await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
})

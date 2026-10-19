import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar']) {
  test(`DOS-M1-002: ${locale} synthetic scope disclosure and private metadata`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    const response = await page.goto('/')
    expect(response?.headers()['x-robots-tag']).toBe('noindex, nofollow')
    expect(response?.headers()['cache-control']).toContain('no-store')
    const scope = page.getByRole('link',{name:locale==='en'?'Preview scope':'نطاق المعاينة',exact:true})
    await scope.focus();await page.keyboard.press('Enter');await expect(page).toHaveURL(/\/preview$/)
    const button = page.getByRole('button', { name: locale === 'en' ? 'View preview scope' : 'عرض نطاق المعاينة', exact: true })
    await expect(button).toBeVisible()
    await button.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: locale === 'en' ? 'Preview scope:' : 'نطاق المعاينة:' })).toContainText(locale === 'en' ? 'remain unavailable' : 'غير متاحة')
    await expect(button).toBeDisabled()
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0)
  })
}

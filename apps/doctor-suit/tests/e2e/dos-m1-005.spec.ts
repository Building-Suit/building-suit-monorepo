import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar']) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`DOS-M1-005 ${locale} ${width}px ${theme}: truthful preview and actual internal navigation`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 900 })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: locale === 'en' ? 'Your practice, wherever you work' : 'ممارستك الطبية معك أينما عملت' })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    expect(await page.locator('a[href^="http"], a[href^="mailto:"], a[href^="tel:"]').count()).toBe(0)
    await expect(page.getByText(locale === 'en' ? 'Planned' : 'مخطط', { exact: true })).toHaveCount(3)
    await page.getByRole('link', { name: locale === 'en' ? 'Preview details' : 'تفاصيل المعاينة' }).click()
    await expect(page).toHaveURL(/\/preview$/)
    await expect(page.getByText(locale === 'en' ? 'Synthetic preview · no active account, practice or location' : 'معاينة تجريبية · لا يوجد حساب أو ممارسة أو موقع نشط')).toBeVisible()
  })
}

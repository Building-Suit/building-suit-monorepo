import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar']) for (const width of [390, 1280]) for (const theme of ['light', 'dark']) {
  test(`DOS-M1-004 ${locale} ${width}px ${theme}: keyboard and shared shell without a fabricated session`, async ({ page, context }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await page.goto('/preview')
    const inspect = page.getByRole('button', { name: locale === 'en' ? 'View preview scope' : 'عرض نطاق المعاينة', exact: true })
    await inspect.focus()
    await expect(inspect).toBeFocused()
    expect(await inspect.evaluate(element => {
      const style = getComputedStyle(element)
      return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
    })).toBe(true)
    await page.keyboard.press('Enter')
    await expect(page.getByRole('status').filter({ hasText: locale === 'en' ? 'Preview scope:' : 'نطاق المعاينة:' })).toContainText(locale === 'en' ? 'remain unavailable' : 'غير متاحة')
    await expect(page.getByText(locale === 'en' ? 'Synthetic preview · no active account, practice or location' : 'معاينة تجريبية · لا يوجد حساب أو ممارسة أو موقع نشط')).toBeVisible()
    if (width === 390) await page.getByRole('button', { name: locale === 'en' ? 'Open navigation' : 'فتح القائمة', exact: true }).click()
    const settings = page.getByRole('button', { name: /^(Theme|المظهر):/ }).first()
    await settings.focus()
    for (let step = 0; step < (theme === 'light' ? 1 : 2); step++) await page.keyboard.press('Space')
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme)
    await expect(settings).toBeFocused()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

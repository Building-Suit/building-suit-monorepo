import { test, expect } from '@playwright/test'

for (const locale of ['en', 'ar'] as const) for (const width of [390, 1280]) for (const theme of ['light', 'dark'] as const) {
  test(`DOS-M1-004 ${locale} ${width}px ${theme}: keyboard and shared shell without a fabricated session`, async ({ page, context }) => {
    const copy = locale === 'en'
      ? { theme: 'Theme', language: 'Language', themeLight: 'Light', themeDark: 'Dark', themeSystem: 'System', open: 'Open navigation' }
      : { theme: 'المظهر', language: 'اللغة', themeLight: 'فاتح', themeDark: 'داكن', themeSystem: 'النظام', open: 'فتح القائمة' }
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await context.addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4336' }])
    await page.addInitScript(value => { if (!localStorage.getItem('building-suit.theme')) localStorage.setItem('building-suit.theme', value) }, theme)
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
    const navigation = page.getByRole('button', { name: copy.open, exact: true })
    if (width === 390) {
      await navigation.focus()
      await page.keyboard.press('Enter')
    }
    const settings = page.getByRole('button', { name: new RegExp(`^${copy.theme}:`) })
    await expect(settings).toHaveAccessibleName(`${copy.theme}: ${theme === 'light' ? copy.themeLight : copy.themeDark}`)
    const language = page.getByRole('button', { name: `${copy.language}: ${locale}`, exact: true })
    await expect(language).toBeEnabled()
    await language.focus()
    await expect(language).toBeFocused()
    for (const next of theme === 'light' ? ['dark'] as const : ['system', 'light'] as const) {
      await expect(settings).toBeEnabled()
      await settings.focus()
      await page.keyboard.press('Enter')
      const label = next === 'light' ? copy.themeLight : next === 'dark' ? copy.themeDark : copy.themeSystem
      await expect(settings).toHaveAccessibleName(`${copy.theme}: ${label}`)
      if (next === 'system') await expect(page.locator('html')).not.toHaveAttribute('data-theme')
      else await expect(page.locator('html')).toHaveAttribute('data-theme', next)
    }
    const nextTheme = theme === 'light' ? 'dark' : 'light'
    expect(await page.evaluate(() => localStorage.getItem('building-suit.theme'))).toBe(nextTheme)
    await page.keyboard.press('Escape')
    if (width === 390) {
      await expect(settings).not.toBeVisible()
      await expect(navigation).toBeFocused()
    } else await expect(settings).toBeFocused()
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', nextTheme)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  })
}

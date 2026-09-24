import { expect, test } from '@playwright/test'

test('Inventory bootstrap uses the shared bilingual responsive theme shell', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('http://127.0.0.1:4323/')
  await expect(page.getByRole('heading', { name: 'Inventory Suit foundation' })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 250)')

  const settings = page.getByRole('button', { name: 'Language · Theme' })
  await settings.click()
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')

  await page.getByRole('menuitemradio', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'الأساس التقني لحزمة المخزون' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

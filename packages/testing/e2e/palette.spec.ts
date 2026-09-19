import { test, expect } from '@playwright/test'

for (const app of [
  { name: 'Ledger', port: 4320, path: '/login', product: true },
  { name: 'Shop', port: 4321, path: '/auth/login', product: true },
  { name: 'Docs', port: 4322, path: '/components', product: false },
]) {
  test(`${app.name}: shared Ledger palette reaches rendered UI and theme changes`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${app.port}${app.path}`)
    const settings = page.getByRole('button', { name: 'Language · Theme' })
    const primary = page.locator('.ls-btn-primary').first()
    const input = page.locator('.ls-input').first()
    await expect(primary).toBeVisible()
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 250)')
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(11, 11, 13)')
    await expect(input).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(primary).toHaveCSS('background-color', 'rgb(22, 41, 59)')
    await primary.hover()
    await expect(primary).toHaveCSS('background-color', 'rgb(30, 58, 80)')
    await page.mouse.down()
    await expect(primary).toHaveCSS('background-color', 'rgb(13, 27, 40)')
    // Release outside the button so checking :active never submits a form.
    await page.mouse.move(1, 1)
    await page.mouse.up()
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-light.png`, fullPage: true })

    await settings.click()
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await settings.click()
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(250, 250, 250)')
    await expect(input).toHaveCSS('background-color', 'rgb(20, 20, 22)')
    await expect(primary).toHaveCSS('background-color', 'rgb(216, 155, 66)')
    await primary.hover()
    await expect(primary).toHaveCSS('background-color', 'rgb(235, 180, 90)')
    await page.mouse.move(1, 1)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-dark.png`, fullPage: true })

    await settings.click()
    await page.getByRole('menuitemradio', { name: 'System', exact: true }).click()
    await settings.click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    await expect(primary).toHaveCSS('background-color', 'rgb(216, 155, 66)')

    if (app.product) {
      await page.goto(`http://127.0.0.1:${app.port}/`)
      // Landing previews intentionally stay charcoal, including on light pages.
      await expect(page.locator('.ls-hero-preview')).toHaveCSS('background-color', 'rgb(20, 20, 22)')
      await expect(page.locator('.ls-hero-preview .bg-surface-muted').first()).toHaveCSS('background-color', 'rgb(28, 28, 31)')
    }
  })
}

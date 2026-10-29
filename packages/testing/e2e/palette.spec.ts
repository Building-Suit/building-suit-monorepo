import { test, expect, type Locator } from '@playwright/test'

// CSS Color 4 may serialize identical colors as rgb() or color(srgb).
async function expectColor(control: Locator, property: string, expected: string) {
  await expect.poll(() => control.evaluate((element, { property, expected }) => {
    const probe = document.createElement('span')
    probe.style.color = expected
    document.body.append(probe)
    const values = [getComputedStyle(element).getPropertyValue(property), getComputedStyle(probe).color]
    probe.remove()
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('Color comparison requires a 2D context')
    const colors = values.map(value => {
      if (!CSS.supports('color', value)) throw new Error('Invalid color expectation')
      context.clearRect(0, 0, 1, 1)
      context.fillStyle = value
      context.fillRect(0, 0, 1, 1)
      return [...context.getImageData(0, 0, 1, 1).data]
    })
    return { actual: colors[0], expected: colors[1], equal: colors[0].every((channel, index) => channel === colors[1][index]) }
  }, { property, expected })).toMatchObject({ equal: true })
}

for (const app of [
  { name: 'Ledger', port: 4320, path: '/login', product: true },
  { name: 'Shop', port: 4321, path: '/auth/login', product: true },
  { name: 'Docs', port: 4322, path: '/components', product: false },
]) {
  test(`${app.name}: shared Ledger palette reaches rendered UI and theme changes`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${app.port}${app.path}`)
    // Catalogue examples may include their own settings control. Exercise the
    // Docs site's header control; standalone product auth pages have no banner.
    const settings = (app.product ? page : page.getByRole('banner')).getByRole('button', { name: 'Language · Theme', exact: true })
    const primary = page.locator('.ls-btn-primary').first()
    const input = page.locator('.ls-input').first()
    await expect(primary).toBeVisible()
    await expectColor(page.locator('body'), 'background-color', 'rgb(250, 250, 250)')
    await expectColor(page.locator('body'), 'color', 'rgb(11, 11, 13)')
    await expectColor(input, 'background-color', app.product ? 'color-mix(in srgb, var(--bs-surface-raised) 88%, var(--bs-surface))' : 'var(--bs-surface)')
    await expectColor(primary, 'background-color', 'rgb(22, 41, 59)')
    await primary.hover()
    await expectColor(primary, 'background-color', 'rgb(30, 58, 80)')
    await page.mouse.down()
    await expectColor(primary, 'background-color', 'rgb(13, 27, 40)')
    // Release outside the button so checking :active never submits a form.
    await page.mouse.move(1, 1)
    await page.mouse.up()
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-light.png`, fullPage: true })

    await settings.click()
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await settings.click()
    await expectColor(page.locator('body'), 'background-color', 'rgb(11, 11, 13)')
    await expectColor(page.locator('body'), 'color', 'rgb(250, 250, 250)')
    await expectColor(input, 'background-color', app.product ? 'color-mix(in srgb, var(--bs-surface-raised) 88%, var(--bs-surface))' : 'var(--bs-surface)')
    await expectColor(primary, 'background-color', 'rgb(216, 155, 66)')
    await primary.hover()
    await expectColor(primary, 'background-color', 'rgb(235, 180, 90)')
    await page.mouse.move(1, 1)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expectColor(page.locator('body'), 'background-color', 'rgb(11, 11, 13)')
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-dark.png`, fullPage: true })

    await settings.click()
    await page.getByRole('menuitemradio', { name: 'System', exact: true }).click()
    await settings.click()
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expectColor(page.locator('body'), 'background-color', 'rgb(11, 11, 13)')
    await expectColor(primary, 'background-color', 'rgb(216, 155, 66)')

    if (app.product) {
      await page.goto(`http://127.0.0.1:${app.port}/`)
      // Landing previews intentionally stay charcoal, including on light pages.
      await expectColor(page.locator('.ls-hero-preview').first(), 'background-color', 'rgb(20, 20, 22)')
      await expectColor(page.locator('.ls-hero-preview .bg-surface-muted, .ls-hero-preview .bs-box--surface-muted, .ls-hero-preview .ls-card-flat').first(), 'background-color', 'rgb(28, 28, 31)')
    }
  })
}

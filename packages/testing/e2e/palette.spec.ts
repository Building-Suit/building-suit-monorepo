import { test, expect, type Locator } from '@playwright/test'

// Compare painted sRGB bytes, including opacity, rather than the browser's
// choice of rgb() or color(srgb ...) serialization for the same CSS color.
async function backgroundRgba(locator: Locator) {
  return locator.evaluate(element => {
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = 1
    const context = canvas.getContext('2d')!
    context.fillStyle = getComputedStyle(element).backgroundColor
    context.fillRect(0, 0, 1, 1)
    return Array.from(context.getImageData(0, 0, 1, 1).data)
  })
}

const arrowGradient = 'linear-gradient(140deg, rgb(244, 206, 134), rgb(216, 155, 66) 85%)'
const arrowHoverGradient = 'linear-gradient(140deg, rgb(235, 180, 90), rgb(216, 155, 66))'

test('palette color comparison retains changed-color and opacity detection', async ({ page }) => {
  await page.setContent('<div id="color"></div>')
  const color = page.locator('#color')
  for (const value of ['rgb(255, 255, 255)', 'color(srgb 1 1 1)']) {
    await color.evaluate((element, value) => { element.style.backgroundColor = value }, value)
    expect(await backgroundRgba(color)).toEqual([255, 255, 255, 255])
  }
  await color.evaluate(element => { element.style.backgroundColor = 'rgb(254, 255, 255)' })
  expect(await backgroundRgba(color)).toEqual([254, 255, 255, 255])
  await color.evaluate(element => { element.style.backgroundColor = 'rgb(255 255 255 / 50%)' })
  expect(await backgroundRgba(color)).toEqual([255, 255, 255, 128])
})

for (const app of [
  { name: 'Ledger', port: 4320, path: '/login', product: true },
  { name: 'Shop', port: 4321, path: '/auth/login', product: true },
  { name: 'Docs', port: 4322, path: '/components', product: false },
]) {
  test(`${app.name}: shared Ledger palette reaches rendered UI and theme changes`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(() => { if (!localStorage.getItem('building-suit.theme')) localStorage.setItem('building-suit.theme', 'light') })
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${app.port}${app.path}`)
    // Catalogue examples may include their own settings control. Exercise the
    // Docs site's outer navigation control; standalone product auth pages have no banner.
    const settings = app.product ? page.getByRole('button', { name: 'Language · Theme', exact: true }) : page.locator('.bs-side-navigation').first().getByRole('button', { name: /^Theme:/ })
    const primary = page.locator('.ls-btn-primary').first()
    const input = page.locator('.ls-input').first()
    await expect(primary).toBeVisible()
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 250)')
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(11, 11, 13)')
    await expect.poll(() => backgroundRgba(input)).toEqual([255, 255, 255, 255])
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(22, 41, 59)')
    await primary.hover()
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowHoverGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(30, 58, 80)')
    await page.mouse.down()
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowHoverGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(13, 27, 40)')
    // Release outside the button so checking :active never submits a form.
    await page.mouse.move(1, 1)
    await page.mouse.up()
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-light.png`, fullPage: true })

    await settings.click()
    if (app.product) {
      await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
      await settings.click()
    }
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(250, 250, 250)')
    // Approved glass identity fields mix 88% raised #27272A and 12% #141416;
    // ordinary catalogue controls retain the canonical charcoal surface.
    await expect.poll(() => backgroundRgba(input)).toEqual(app.product ? [37, 37, 40, 255] : [20, 20, 22, 255])
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(216, 155, 66)')
    await primary.hover()
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowHoverGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(235, 180, 90)')
    await page.mouse.move(1, 1)
    await page.reload()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    await page.screenshot({ path: `.local/screenshots/${app.name.toLowerCase()}-palette-dark.png`, fullPage: true })

    await settings.click()
    if (app.product) {
      await page.getByRole('menuitemradio', { name: 'System', exact: true }).click()
      await settings.click()
    }
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/)
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(11, 11, 13)')
    if (app.product) await expect(primary).toHaveCSS('background-image', arrowGradient)
    else await expect(primary).toHaveCSS('background-color', 'rgb(216, 155, 66)')

    if (app.product) {
      await page.goto(`http://127.0.0.1:${app.port}/`)
      // Preserve painted surfaces in each registered landing presentation.
      if (app.name === 'Shop') {
        await expect(page.locator('.bs-film')).toHaveCSS('background-color', 'rgb(13, 27, 40)')
        await expect(page.locator('.bs-film__stage')).toHaveCSS('background-color', 'rgb(10, 17, 26)')
      } else {
        await expect(page.locator('.ls-hero-preview').first()).toHaveCSS('background-color', 'rgb(20, 20, 22)')
        await expect(page.locator('.ls-hero-preview .bg-surface-muted, .ls-hero-preview .bs-box--surface-muted, .ls-hero-preview .ls-card-flat').first()).toHaveCSS('background-color', 'rgb(28, 28, 31)')
      }

      // Preserve the ordinary primary palette assertions on actual product
      // landing actions, alongside the explicitly branded glass auth arrow.
      const landingPrimary = page.locator('.ls-btn-primary').first()
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(216, 155, 66)')
      await landingPrimary.hover()
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(235, 180, 90)')
      await page.mouse.down()
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(200, 144, 47)')
      await page.mouse.move(1, 1)
      await page.mouse.up()
      const landingSettings = page.getByRole('banner').getByRole('button', { name: 'Language · Theme', exact: true })
      await landingSettings.click()
      await page.getByRole('menuitemradio', { name: 'Light', exact: true }).click()
      await landingSettings.click()
      await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(250, 250, 250)')
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(22, 41, 59)')
      await landingPrimary.hover()
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(30, 58, 80)')
      await page.mouse.down()
      await expect(landingPrimary).toHaveCSS('background-color', 'rgb(13, 27, 40)')
      await page.mouse.move(1, 1)
      await page.mouse.up()
    }
  })
}

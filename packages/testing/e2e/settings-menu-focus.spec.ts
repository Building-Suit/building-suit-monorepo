import { test, expect } from '@playwright/test'

for (const app of [
  { name: 'Ledger', port: 4320, path: '/login' },
  { name: 'Shop', port: 4321, path: '/auth/login' },
  { name: 'Docs', port: 4322, path: '/components' },
  { name: 'Inventory', port: 4323, path: '/' },
  { name: 'Automation', port: 4324, path: '/' },
  { name: 'Super Admin', port: 4325, path: '/' },
]) for (const width of [390, 1280]) {
  test(`${app.name} ${width}px: settings keyboard focus and locale/theme transitions`, async ({ page, context, browser }, info) => {
    const shellCycles = ['Docs', 'Inventory', 'Automation'].includes(app.name)
    const denied: string[] = []
    await page.route('**/*', route => {
      const url = new URL(route.request().url())
      if (!['127.0.0.1', 'localhost'].includes(url.hostname) || /n8n/i.test(url.pathname)) {
        denied.push(`${url.protocol}//${url.hostname}${url.pathname}`)
        return route.abort()
      }
      return route.continue()
    })
    if (width === 390) {
      const staticContext = await browser.newContext({ javaScriptEnabled: false })
      try {
        const staticPage = await staticContext.newPage()
        await staticPage.route('**/*', route => {
          const url = new URL(route.request().url())
          return ['127.0.0.1', 'localhost'].includes(url.hostname) && !/n8n/i.test(url.pathname) ? route.continue() : route.abort()
        })
        await staticPage.goto(`http://127.0.0.1:${app.port}${app.path}`)
        if (shellCycles) {
          await expect(staticPage.getByRole('button', { name: /^Theme:/ }).first()).toBeDisabled()
          await expect(staticPage.getByRole('button', { name: /^Language:/ }).first()).toBeDisabled()
        } else await expect(staticPage.getByRole('button', { name: 'Language · Theme', exact: true }).first()).toBeDisabled()
      } finally { await staticContext.close() }
    }
    await context.addCookies([{ name: 'building-suit-locale', value: 'en', url: `http://127.0.0.1:${app.port}` }])
    await page.addInitScript(() => localStorage.setItem('building-suit.theme', 'light'))
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`http://127.0.0.1:${app.port}${app.path}`)
    if (shellCycles) {
      if (width === 390) await page.getByRole('button', { name: 'Open navigation', exact: true }).first().click()
      const theme = page.getByRole('button', { name: /^(Theme|المظهر):/ }).first()
      const language = page.getByRole('button', { name: /^(Language|اللغة):/ }).first()
      await expect(theme).toBeVisible(); await expect(theme).toBeEnabled()
      await theme.focus(); await page.keyboard.press('Space')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
      await expect(theme).toBeFocused()
      await page.keyboard.press('Space')
      await expect.poll(() => page.evaluate(() => localStorage.getItem('building-suit.theme'))).toBe('system')
      await page.keyboard.press('Space')
      await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
      await language.focus(); await page.keyboard.press('Enter')
      await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
      await expect(language).toBeFocused()
      await page.screenshot({ path: info.outputPath('settings-ar-light.png') })
      await page.keyboard.press('Enter')
      await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
      await expect(language).toBeFocused()
      await page.screenshot({ path: info.outputPath('settings-en-light.png') })
      expect(denied, 'No external backend or n8n access is part of this suite').toEqual([])
      return
    }
    const root = page
    const settings = root.getByRole('button', { name: 'Language · Theme', exact: true }).first()
    await expect(settings).toBeVisible()
    await expect(settings).toBeEnabled()
    await settings.focus()
    await page.keyboard.press('Enter')
    await expect(page.getByRole('menu')).toBeVisible()
    await expect(page.getByRole('menuitemradio').first()).toBeFocused()
    await page.keyboard.press('End')
    await expect(page.getByRole('menuitemradio').last()).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(settings).toBeFocused()
    await page.screenshot({ path: info.outputPath('settings-en-light.png') })
    await page.keyboard.press('Enter')
    await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
    await page.keyboard.press('Escape')
    await expect(settings).toBeFocused()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitemradio', { name: /^(العربية|ar)$/ }).click()
    const arabicSettings = root.getByRole('button', { name: 'اللغة · المظهر', exact: true }).first()
    await expect(arabicSettings).toBeFocused()
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await page.getByRole('menuitemradio', { name: 'فاتح', exact: true }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
    await page.keyboard.press('Escape')
    await expect(arabicSettings).toBeFocused()
    await page.screenshot({ path: info.outputPath('settings-ar-light.png') })
    expect(denied, 'No external backend or n8n access is part of this suite').toEqual([])
  })
}

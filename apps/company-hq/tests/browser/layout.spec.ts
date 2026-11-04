import { expect, test } from '@playwright/test'

for (const sample of [
  { name: 'desktop', locale: 'en', theme: 'dark', width: 1600, height: 900 },
  { name: 'desktop-light-preference', locale: 'en', theme: 'light', width: 1440, height: 1000 },
  { name: 'mobile', locale: 'en', theme: 'dark', width: 390, height: 844 },
  { name: 'mobile-ar', locale: 'ar', theme: 'light', width: 390, height: 844 },
  { name: 'mobile-ar-375', locale: 'ar', theme: 'dark', width: 375, height: 812 },
  { name: 'mobile-320', locale: 'en', theme: 'light', width: 320, height: 568 },
  { name: 'desktop-ar', locale: 'ar', theme: 'dark', width: 1600, height: 900 },
]) {
  test(`empty static HQ layout: ${sample.name}`, async ({ page, context }) => {
    const errors: string[] = [], apiRequests: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) apiRequests.push(request.url())
    })
    await context.addCookies([{ name: 'building-suit-locale', value: sample.locale, domain: '127.0.0.1', path: '/' }])
    await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), sample.theme)
    await page.setViewportSize({ width: sample.width, height: sample.height })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Building Suit HQ' })).toBeVisible()
    await expect(page.getByRole('main')).toHaveAccessibleName(sample.locale === 'ar' ? 'مساحة عمل المقر الفارغة' : 'Empty HQ workspace')
    await expect(page.locator('html')).toHaveAttribute('dir', sample.locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('.bs-hq-layout__minimap')).toBeEmpty()
    await expect(page.locator('.bs-hq-layout__canvas > :not(.bs-hq-layout__footer)')).toHaveCount(0)
    await expect(page.getByRole('dialog')).toHaveCount(0)
    for (const button of await page.getByRole('button').all()) await expect(button).toBeDisabled()
    await page.evaluate(() => document.fonts.ready)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true)
    const clippedHeaderElements = await page.locator('.bs-hq-layout__header *').evaluateAll(elements => elements.filter(element => {
      const bounds = element.getBoundingClientRect()
      return bounds.width > 0 && (bounds.left < 0 || bounds.right > innerWidth)
    }).map(element => element.textContent))
    expect(clippedHeaderElements).toEqual([])
    const containedViewControls = await page.locator('.bs-hq-layout__view').evaluate(element => {
      const panel = element.getBoundingClientRect()
      return [...element.querySelectorAll('button')].every(button => {
        const bounds = button.getBoundingClientRect()
        return bounds.left >= panel.left && bounds.right <= panel.right
      })
    })
    expect(containedViewControls).toBe(true)
    await page.screenshot({ path: `test-results/hq-layout-${sample.name}.png`, fullPage: true })
    expect(apiRequests).toEqual([])
    expect(errors).toEqual([])
  })
}

test('retired HQ endpoints and sign-in are unavailable', async ({ request }) => {
  for (const path of ['/api/hq/state', '/api/hq/bridge/state', '/auth/login', '/hq-assets/office-scene.png']) {
    expect((await request.get(path)).status(), path).toBe(404)
  }
  for (const path of ['/api/mcp', '/api/hq/action', '/api/hq/bridge/action', '/api/hq/auth/login', '/api/hq/auth/logout']) {
    expect((await request.post(path, { data: {} })).status(), path).toBe(404)
  }
})

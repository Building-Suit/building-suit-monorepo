import { expect, test } from '@playwright/test'
import { expectNoPageOverflow, navigateFixture } from './browser-foundation'
export function landingBrowserMatrix(config: { login: string; backend: number; rpc: string; catalog: object[]; signup: string; yearly: { en: string; ar: string }; initialPrice: RegExp; annualPrice: RegExp }) {
  for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
    test(`shared landing pricing and trial navigation: ${locale}, ${theme}, ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.context().addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
      await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      await page.route(`http://127.0.0.1:${config.backend}/**`, async route => {
        const path = new URL(route.request().url()).pathname
        await route.fulfill({ status: path.includes('/auth/') ? 401 : 200, json: path.endsWith('/rpc/' + config.rpc) ? config.catalog : path.includes('/auth/') ? { message: 'No public session' } : [] })
      })
      await page.goto(config.login)
      await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
      await navigateFixture(page, '/')
      const pricing = page.locator('.bs-marketing-pricing')
      await expect(pricing).toContainText(config.initialPrice)
      await pricing.getByRole('radio', { name: config.yearly[locale], exact: true }).check()
      await expect(pricing).toContainText(config.annualPrice)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expectNoPageOverflow(page)
      await page.evaluate(() => document.fonts.ready)
      const heroTitle = page.locator('.ls-landing-hero-title')
      await expect(heroTitle).toBeVisible()
      if (locale === 'ar') expect(await heroTitle.evaluate(element => getComputedStyle(element).letterSpacing)).toBe('normal')
      if (width >= 1024) {
        const titleBounds = await heroTitle.boundingBox()
        const previewBounds = await page.locator('[data-landing-preview]').boundingBox()
        expect(titleBounds).not.toBeNull()
        expect(previewBounds).not.toBeNull()
        const separated = titleBounds!.x + titleBounds!.width <= previewBounds!.x || previewBounds!.x + previewBounds!.width <= titleBounds!.x
        expect(separated).toBe(true)
      }

      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/landing-${config.backend}-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
      const action = pricing.locator(`a[href="${config.signup}"]`).first()
      await expect(action).toBeVisible()
      await action.click()
      await expect(page).toHaveURL(new RegExp(config.signup + '$'))
    })
  }
}

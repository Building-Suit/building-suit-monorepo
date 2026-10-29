import { mkdir } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { recordShellGeometry, expectNoPageOverflow, trackRouteCoverage } from '../browser-foundation'

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`independent Inventory and Super Admin entry states: ${locale}, ${theme}, ${width}`, async ({ browser }, info) => {
  const shellGeometry = []
  for (const product of [{ name: 'inventory', port: 4323 }, { name: 'super-admin', port: 4325 }]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
   await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
   await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
   const page = await context.newPage()
   trackRouteCoverage(page)
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   let authorized = false
   await page.route('**/api/session', route => authorized ? route.fulfill({ json: { actor: { id: 'synthetic-admin' } } }) : route.fulfill({ status: 503, json: { statusCode: 503, message: 'Isolated fixture unavailable' } }))
   await page.goto(`http://127.0.0.1:${product.port}/`)
   if (product.name === 'super-admin') {
    // Server access is unavailable in this isolated fixture; the retry proves the client state transition.
    const retry = page.getByRole('button', { name: locale === 'ar' ? 'التحقق من الوصول مجددًا' : 'Check access again' })
    await expect(retry).toBeVisible()
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: unknown } | null)?.__vue_app__))
    authorized = true
    await retry.click()
   }
   await expect(page.locator('main').getByRole('heading').first()).toBeVisible()
   await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
   await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
   await expectNoPageOverflow(page)
   await recordShellGeometry(page)
   shellGeometry.push(await page.locator('.bs-side-navigation').first().evaluate(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element)
    return { width: Math.round(box.width), height: Math.round(box.height), background: style.backgroundColor, border: style.borderColor, radius: style.borderRadius }
   }))
   if (width === 390) {
    const trigger = page.locator('.bs-app-shell__mobile-trigger')
    await trigger.click()
    await expect(trigger).toHaveAttribute('aria-expanded', 'true')
    await expect(page.locator('[data-side-menu-close]')).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(trigger).toHaveAttribute('aria-expanded', 'false')
    await expect(trigger).toBeFocused()
   }
   await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
   const screenshot = `.local/atomic-template-evidence/screenshots/${product.name}-entry-${locale}-${theme}-${width}.png`
   await page.screenshot({ path: screenshot, fullPage: true })
   await info.attach(product.name, { path: screenshot, contentType: 'image/png' })
   expect(errors).toEqual([])
   await context.close()
  }
  expect(shellGeometry[0]).toEqual(shellGeometry[1])
 })
}

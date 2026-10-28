import { expect, test } from '@playwright/test'
import { atomicAuthPorts, expectNoPageOverflow, trackRouteCoverage } from '../browser-foundation'
const [ledgerPort, shopPort] = atomicAuthPorts()

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
 test(`public legal, contact, invitation and recovery adapters: ${locale}, ${theme}, ${width}`, async ({ browser }) => {
  // Seventeen real SSR navigations across both products need a journey budget;
  // individual actions and assertions keep their normal timeouts.
  test.setTimeout(90000)
  for (const product of [{ port: ledgerPort, extra: ['/accept-invitation', '/verify-email?email=fixture@example.invalid'] }, { port: shopPort, extra: ['/auth/forgot-password', '/auth/reset-password', '/auth/team-invitation'] }]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
   await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
   await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
   const page = await context.newPage()
   trackRouteCoverage(page)
   const errors: string[] = []
   page.on('pageerror', error => errors.push(error.message))
   // No remote contact, authentication or membership operations are permitted in this fixture.
   await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }))
   await page.route('**/auth/v1/**', route => route.fulfill({ status: 400, json: { message: 'Synthetic request rejected' } }))
   for (const path of ['/about', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation', '/contact', ...product.extra]) {
    await page.goto(`http://127.0.0.1:${product.port}${path}`)
    await expect(page).toHaveURL(new RegExp(path.split('?')[0] + '(?:\\?|$)'))
    await expect(page.getByRole('heading').first()).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await expectNoPageOverflow(page)
    if (path === '/contact') {
     await expect(page.locator('form')).toBeVisible()
     await expect(page.getByRole('checkbox')).toBeVisible()
    }
   }
   expect(errors).toEqual([])
   await context.close()
  }
 })
}

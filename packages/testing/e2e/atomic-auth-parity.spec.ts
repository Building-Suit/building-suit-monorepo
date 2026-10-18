import { mkdir } from 'node:fs/promises'
import { test, expect, type Locator } from '@playwright/test'
import { atomicAuthPorts, expectNoPageOverflow, trackRouteCoverage } from '../browser-foundation'
const [ledgerPort, shopPort] = atomicAuthPorts()

async function expectBorderToken(control: Locator, token: '--bs-border' | '--bs-focus-ring') {
  const expected = await control.evaluate((element, property) => {
    const probe = document.createElement('span')
    probe.hidden = true
    probe.style.color = property === '--bs-border'
      ? 'color-mix(in srgb, var(--bs-border) 70%, transparent)'
      : getComputedStyle(element).getPropertyValue(property)
    document.body.append(probe)
    const color = getComputedStyle(probe).color
    probe.remove()
    return color
  }, token)
  // Reduced-motion transitions still take a render frame to finish. Compare
  // the canonical state, rather than whichever blur-transition frame won.
  await expect.poll(() => control.evaluate(element => getComputedStyle(element).borderColor)).toBe(expected)
}

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`shared sign-in parity: ${locale}, ${theme}, ${width}`, async ({ browser }, testInfo) => {
    const geometries = []
    for (const product of [{ name: 'ledger', port: ledgerPort, path: '/login' }, { name: 'shop', port: shopPort, path: '/auth/login' }]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
      await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
      await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      const page = await context.newPage()
      trackRouteCoverage(page)
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      let release: () => void = () => {}
      const gate = new Promise<void>(resolve => { release = resolve })
      await page.route('**/auth/v1/token*', async route => {
        await gate
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'invalid_credentials', message: 'Invalid login credentials' }) })
      })
      await page.route('**/api/auth/email-step', route => route.fulfill({ json: { canContinue: route.request().postDataJSON()?.email === 'parity@example.invalid' } }))
      await page.goto(`http://127.0.0.1:${product.port}${product.path}`)
      await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const email = page.locator('input[type=email]')
      const password = page.locator('input[type=password]')
      await expect(email).toBeVisible()
      await expect(password).toHaveCount(0)
      await expectNoPageOverflow(page)
      await email.focus()
      await expect(email).toBeFocused()
      await expectBorderToken(email, '--bs-focus-ring')
      geometries.push(await email.evaluate(element => {
        const box = element.getBoundingClientRect()
        const style = getComputedStyle(element)
        return { width: Math.round(box.width), height: Math.round(box.height), font: style.fontFamily, size: style.fontSize, radius: style.borderRadius, background: style.backgroundColor, border: style.borderColor }
      }))
      await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
      const screenshot = `.local/atomic-template-evidence/screenshots/${product.name}-sign-in-${locale}-${theme}-${width}.png`
      await page.screenshot({ path: screenshot, fullPage: true })
      await testInfo.attach(`${product.name}-${locale}-${theme}-${width}`, { path: screenshot, contentType: 'image/png' })
      await email.fill('parity@example.invalid')
      // Both Suits use the real glass email-first stage. Shop validates the
      // synthetic address through its own endpoint; Ledger advances locally.
      await email.press('Enter')
      await expect(password).toBeVisible()
      await expect(password).toBeFocused()
      await expect(email).toHaveAttribute('readonly', '')
      await expect(email).not.toBeFocused()
      await expectBorderToken(email, '--bs-border')
      await expectBorderToken(password, '--bs-focus-ring')
      await password.fill('synthetic-test-password')
      const submit = page.locator('form button[type=submit]')
      await expect(submit).toHaveCount(1)
      await submit.click()
      await expect(submit).toBeDisabled()
      await expect(page.locator('form')).toHaveAttribute('aria-busy', 'true')
      release()
      await expect(page.getByRole('alert')).toBeVisible()
      await expect(submit).toBeEnabled()
      expect(errors).toEqual([])
      await context.close()
    }
    expect(geometries[0]).toEqual(geometries[1])
  })
}

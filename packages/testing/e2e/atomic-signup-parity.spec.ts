import { mkdir } from 'node:fs/promises'
import { test, expect } from '@playwright/test'
import { atomicAuthPorts, expectNoPageOverflow, trackRouteCoverage } from '../browser-foundation'
const [ledgerPort, shopPort] = atomicAuthPorts()

for (const locale of ['en', 'ar']) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`shared signup account, workspace and invalid OTP: ${locale}, ${theme}, ${width}`, async ({ browser }, testInfo) => {
    const controls = []
    for (const product of [{ name: 'ledger', port: ledgerPort, path: '/signup' }, { name: 'shop', port: shopPort, path: '/auth/signup' }]) {
      const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
      await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
      await context.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
      const page = await context.newPage()
      trackRouteCoverage(page)
      const errors: string[] = []
      const commands: { name: string; body: object }[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.route('**/rest/v1/rpc/*', route => {
        const name = new URL(route.request().url()).pathname.split('/').pop()!
        commands.push({ name, body: route.request().postDataJSON() })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(name === 'check_owner_availability' ? { email_taken: false, phone_taken: false } : name === 'check_legal_name_availability' ? true : null) })
      })
      await page.route('**/auth/v1/signup*', route => {
        commands.push({ name: 'signup', body: route.request().postDataJSON() })
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'synthetic-signup-user', email: 'parity@example.invalid', identities: [{ id: 'synthetic-identity' }], user_metadata: {} }) })
      })
      await page.route('**/auth/v1/verify*', route => {
        commands.push({ name: 'verify', body: route.request().postDataJSON() })
        return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ code: 'otp_invalid', msg: 'Invalid verification code' }) })
      })
      await page.goto(`http://127.0.0.1:${product.port}${product.path}`)
      await page.waitForFunction(() => {
        const root = document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: { config?: { globalProperties?: { $nuxt?: { isHydrating?: boolean } } } } }
        return root?.__vue_app__?.config?.globalProperties?.$nuxt?.isHydrating === false
      })
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
      const email = page.locator('input[type=email]')
      const password = page.locator('input[type=password]')
      await expect(email).toHaveAccessibleName(locale === 'ar' ? 'البريد الإلكتروني' : 'Email')
      await expect(password).toHaveAccessibleName(locale === 'ar' ? 'كلمة المرور' : 'Password')
      expect(await email.evaluate(input => (input as HTMLInputElement).labels?.length)).toBe(1)
      expect(await password.evaluate(input => (input as HTMLInputElement).labels?.length)).toBe(1)
      await email.focus(); await page.keyboard.press('Tab'); await expect(password).toBeFocused()
      await email.evaluate(async element => { await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {}))) })
      controls.push(await email.evaluate(element => {
        const style = getComputedStyle(element)
        return { height: Math.round(element.getBoundingClientRect().height), font: style.fontFamily, size: style.fontSize, radius: style.borderRadius, background: style.backgroundColor, border: style.borderColor }
      }))
      await page.locator('form input[autocomplete=name]').fill('Parity owner')
      await email.fill('parity@example.invalid')
      await password.fill('synthetic-test-password')
      if (product.name === 'ledger') {
        await page.locator('input[type=tel]').fill('01012345678')
        await page.locator('form input').nth(2).fill('Accountant')
      }
      await page.locator('form button[type=submit]').click()
      await expect(page.locator('input[autocomplete=name]')).toHaveCount(0)
      const chosenWorkspaceField = page.locator('form input').nth(1)
      await chosenWorkspaceField.focus()
      await expect(page.locator('.bs-auth-wizard-stage-enter-active')).toHaveCount(0)
      await expect(chosenWorkspaceField, 'Completing a step transition must retain the field already selected by the user').toBeFocused()
      await page.locator('form input').nth(0).fill('Parity workspace')
      await page.locator('form input').nth(1).fill(product.name === 'ledger' ? 'Parity legal name' : 'Main location')
      if (product.name === 'ledger') {
        await expect(page.locator('form button[type=submit]')).toBeDisabled()
        await page.getByRole('checkbox').check()
      }
      await expect(page.locator('form button[type=submit]')).toBeEnabled()
      await expectNoPageOverflow(page)
      await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
      const screenshot = `.local/atomic-template-evidence/screenshots/${product.name}-signup-workspace-${locale}-${theme}-${width}.png`
      await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' })
      await testInfo.attach(`${product.name}-workspace`, { path: screenshot, contentType: 'image/png' })
      await page.locator('form button[type=submit]').click()
      await expect(page.locator('input[inputmode=numeric]').first()).toBeVisible()
      const signup = commands.find(command => command.name === 'signup')!
      expect(signup.body).toMatchObject({ email: 'parity@example.invalid', password: 'synthetic-test-password' })
      expect(JSON.stringify(await page.evaluate(() => ({ ...sessionStorage })))).not.toContain('synthetic-test-password')
      await expect(page.locator('form button[type=submit]')).toBeDisabled()
      for (const [index, digit] of [...'123456'].entries()) await page.locator('input[inputmode=numeric]').nth(index).fill(digit)
      await expect(page.locator('form button[type=submit]')).toBeEnabled()
      await page.locator('form button[type=submit]').click()
      await expect(page.getByRole('alert').first()).toBeVisible()
      expect(commands.find(command => command.name === 'verify')?.body).toMatchObject({ email: 'parity@example.invalid', token: '123456', type: 'email' })
      await expectNoPageOverflow(page)
      expect(errors).toEqual([])
      await context.close()
    }
    expect(controls[0]).toEqual(controls[1])
  })
}

import { advanceEmailFirstLogin } from '../../../../packages/testing/email-first-login'
import { expect, test, type Page } from '@playwright/test'

type TestApp = {
  isHydrating: boolean
  payload: { data: Record<string, unknown>, state: Record<string, unknown> }
}

async function sessionState(page: Page, seed = false) {
  return page.evaluate((seed) => {
    const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__: { config: { globalProperties: { $nuxt: TestApp } } } }
    const app = root.__vue_app__.config.globalProperties.$nuxt
    if (seed) {
      app.payload.data['shop-data:logout-test'] = { secret: 'synthetic-shop-data' }
      app.payload.data['platform-admin:logout-test'] = { secret: 'synthetic-admin-data' }
      sessionStorage.setItem('shop-suit.pending-onboarding', 'synthetic-draft')
    }
    return {
      shop: app.payload.data['shop-data:logout-test'] ?? null,
      admin: app.payload.data['platform-admin:logout-test'] ?? null,
      shops: app.payload.state['$sshop:shops'],
      current: app.payload.state['$sshop:current-id'],
      draft: sessionStorage.getItem('shop-suit.pending-onboarding'),
      selectionCookies: document.cookie.split(';').filter(cookie => /shop-suit\.(shop|location)=/.test(cookie)),
    }
  }, seed)
}

async function expectLogin(page: Page) {
  await expect(page).toHaveURL(/\/auth\/login$/)
  const email = page.getByRole('textbox', { name: 'Email', exact: true })
  await expect(email).toHaveCount(1)
  await expect(email).toBeVisible()
  await expect(page.getByRole('button', { name: 'Continue', exact: true })).toBeVisible()
  await expect(page.locator('input[type=password]')).toHaveCount(0)
  await expect(page.getByText('Private shop a', { exact: true })).toHaveCount(0)
}

test('logout renders login repeatedly and history cannot restore private pages', async ({ page, context }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await context.addCookies([{ name: 'building-suit-locale', value: 'en', domain: '127.0.0.1', path: '/' }])
  await page.goto('/auth/login')
  await page.waitForFunction(() => {
    const root = document.querySelector('#__nuxt') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $nuxt: TestApp } } } }
    return root?.__vue_app__?.config.globalProperties.$nuxt.isHydrating === false
  })
  for (let attempt = 0; attempt < 3; attempt++) {
    await expectLogin(page)
    await advanceEmailFirstLogin(page, 'a@example.test')
    await page.locator('input[type=password]').fill('synthetic-password')
    await page.getByRole('button', { name: 'Log in', exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole('banner').getByRole('combobox', { name: 'Shop', exact: true })).toContainText('Private shop a')
    await sessionState(page, true)
    await page.getByRole('button', { name: 'Account', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click()
    await expectLogin(page)
    expect(await sessionState(page)).toEqual({ shop: null, admin: null, shops: [], current: null, draft: null, selectionCookies: [] })
    if (attempt === 0) {
      await page.screenshot({ path: test.info().outputPath('login-after-logout.png') })
      await page.goBack()
      await expectLogin(page)
      await page.goForward()
      await expectLogin(page)
    }
    await page.reload()
    await expectLogin(page)
  }
  await page.goto('/about')
  await page.getByRole('link', { name: /Log in|Login|Sign in/ }).first().click()
  await expectLogin(page)
  await page.goBack()
  await expect(page).toHaveURL(/\/about$/)
  await page.goForward()
  await expectLogin(page)
  await page.goto('/dashboard')
  await expectLogin(page)
  expect(errors).toEqual([])
})

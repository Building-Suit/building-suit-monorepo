import { expect, test, type Page } from '@playwright/test'
import { pilotFixture } from './pilot-fixture'

const routes = [
  ['/about', 'About Us', 'من نحن'],
  ['/contact', 'Contact Us', 'تواصل معنا'],
  ['/terms', 'Terms & Conditions', 'الشروط والأحكام'],
  ['/privacy', 'Privacy Policy', 'سياسة الخصوصية'],
  ['/delivery-shipping', 'Delivery & Shipping Policy', 'سياسة التسليم والشحن'],
  ['/refund-cancellation', 'Refund & Cancellation Policy', 'سياسة الاسترداد والإلغاء'],
] as const

async function publicBackend(page: Page, support: { response?: 'success' | 'rate' | 'error'; calls: number }) {
  await page.route('http://127.0.0.1:61321/**', async (route) => {
    const url = new URL(route.request().url())
    if (url.pathname.endsWith('/rpc/submit_support_request')) {
      support.calls += 1
      if (support.response === 'rate') {
        await route.fulfill({ status: 400, json: { message: 'SUPPORT_RATE_LIMITED' } })
      }
      else if (support.response === 'error') {
        await route.fulfill({ status: 500, json: { message: 'temporarily unavailable' } })
      }
      else await route.fulfill({ json: { ok: true, accepted: true } })
      return
    }
    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({ status: 401, json: { message: 'no public session' } })
      return
    }
    await route.fulfill({ json: [] })
  })
}

for (const locale of ['en', 'ar'] as const) {
  test(`public/legal routes, metadata, and links: ${locale}`, async ({ page, context }) => {
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    await publicBackend(page, { calls: 0 })
    for (const [path, en, ar] of routes) {
      const heading = locale === 'ar' ? ar : en
      await page.goto(path)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible()
      await expect(page).toHaveTitle(`${heading} · Shop Suit`)
      await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Shop Suit/)
    }

    await page.goto('/')
    const expected = routes.map(([path]) => path)
    const publicLinks = await page.locator('footer a').evaluateAll(links => links.map(link => new URL((link as HTMLAnchorElement).href).pathname))
    expect([...new Set(publicLinks)].sort()).toEqual([...expected].sort())
  })
}

test('contact validation, consent, honeypot, success, rate-limit, and error paths', async ({ page }) => {
  const support = { response: 'success' as 'success' | 'rate' | 'error', calls: 0 }
  await publicBackend(page, support)
  await page.goto('/contact')
  const main = page.getByRole('main')
  const submit = main.getByRole('button', { name: 'Submit request' })

  await submit.click()
  await expect(main.getByRole('alert')).toContainText('Enter a valid reply email')
  expect(support.calls).toBe(0)

  await main.getByLabel('Reply email').fill('visitor@example.test')
  await main.getByLabel('Subject').fill('Product question')
  await main.getByLabel('Message').fill('Please help with this product question.')
  await main.getByLabel(/I agree/).check()
  await submit.click()
  await expect(main.getByRole('status')).toContainText('request was recorded')
  expect(support.calls).toBe(1)

  await main.getByLabel('Subject').fill('Bot-shaped request')
  await main.getByLabel('Message').fill('This should take the protected honeypot path.')
  await main.getByLabel(/I agree/).check()
  await main.locator('label[aria-hidden="true"] input').evaluate((input: HTMLInputElement) => { input.value = 'filled'; input.dispatchEvent(new Event('input', { bubbles: true })) })
  await submit.click()
  await expect(main.getByRole('status')).toContainText('request was recorded')

  support.response = 'rate'
  await main.getByLabel('Subject').fill('Repeated request')
  await main.getByLabel('Message').fill('This should show the rate-limit message.')
  await main.getByLabel(/I agree/).check()
  await main.locator('label[aria-hidden="true"] input').evaluate((input: HTMLInputElement) => { input.value = ''; input.dispatchEvent(new Event('input', { bubbles: true })) })
  await submit.click()
  await expect(main.getByRole('alert')).toContainText('wait a few minutes')

  support.response = 'error'
  await submit.click()
  await expect(main.getByRole('alert')).toContainText('could not record your request')
})

for (const theme of ['light', 'dark'] as const) {
  test(`canonical Shop logos render on landing, auth, and legal surfaces: ${theme}`, async ({ page }) => {
    await publicBackend(page, { calls: 0 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    for (const path of ['/', '/auth/login', '/terms']) {
      await page.goto(path)
      const logo = page.locator('[role="img"][aria-label="Shop Suit by Building Suit"]:visible').first()
      await expect(logo).toBeVisible()
      // The desktop auth showcase has a dark background in both themes.
      const tone = path === '/auth/login' || theme === 'dark' ? 'light' : 'dark'
      await expect(logo.locator('img:visible')).toHaveAttribute('src', `/brand/shop-suit-wordmark-${tone}.svg`)
      await expect(logo.locator('span span')).toHaveCount(0)
    }
  })
}

test('paid-plan submission boundary links to all applicable policies', async ({ page }) => {
  await pilotFixture(page, 'en')
  await page.locator('#__nuxt').evaluate(async (root) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__
    await app?.config.globalProperties.$router?.push('/billing')
  })
  await expect(page).toHaveURL(/\/billing$/)
  const main = page.getByRole('main')
  await expect(main.getByRole('link', { name: 'Terms & Conditions' })).toHaveAttribute('href', '/terms')
  await expect(main.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')
  await expect(main.getByRole('link', { name: 'Refund & Cancellation Policy' })).toHaveAttribute('href', '/refund-cancellation')
})

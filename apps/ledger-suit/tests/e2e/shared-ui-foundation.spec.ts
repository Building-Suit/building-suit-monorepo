import { expect, test, type Page } from '@playwright/test'

const entitlements = {
  max_members: { limit_value: 3 }, max_monthly_transactions: { limit_value: 500 },
  core_reports: { is_enabled: true }, imports: { is_enabled: true }, multi_currency: { is_enabled: false },
}
const catalog = [
  { plan_key: 'solo', name: 'Solo', description: 'For solo operators', display_order: 1, is_purchasable: true, prices: { monthly: { amount_minor: 39900 }, yearly: { amount_minor: 325584 } }, entitlements },
  { plan_key: 'starter', name: 'Starter', description: 'For growing teams', display_order: 2, is_purchasable: true, prices: { monthly: { amount_minor: 59900 }, yearly: { amount_minor: 488784 } }, entitlements },
  { plan_key: 'business', name: 'Business', description: 'For established teams', display_order: 3, is_purchasable: true, prices: { monthly: { amount_minor: 109900 }, yearly: { amount_minor: 896784 } }, entitlements },
  { plan_key: 'scale', name: 'Scale', description: 'For larger organizations', display_order: 4, is_purchasable: false, prices: {}, entitlements: {} },
]

async function mockPublicBackend(page: Page) {
  await page.route('http://127.0.0.1:60321/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/rpc/subscription_plan_catalog')) await route.fulfill({ json: catalog })
    else if (path.includes('/auth/v1/')) await route.fulfill({ status: 401, json: { message: 'no public session' } })
    else await route.fulfill({ json: [] })
  })
}

async function openLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/login')
  await expect.poll(() => page.locator('#__nuxt').evaluate((root) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: unknown } } } }).__vue_app__
    return Boolean(app?.config.globalProperties.$router)
  })).toBe(true)
  await page.locator('#__nuxt').evaluate(async (root) => {
    const app = (root as HTMLElement & { __vue_app__?: { config: { globalProperties: { $router?: { push: (to: string) => Promise<unknown> } } } } }).__vue_app__
    await app?.config.globalProperties.$router?.push('/')
  })
  await expect(page).toHaveURL(/\/$/)
  const pricing = page.locator('.bs-marketing-pricing')
  await pricing.scrollIntoViewIfNeeded()
  await expect(pricing).toBeVisible()
}

test('Ledger consumes the shared responsive marketing frame and plan presentation', async ({ page }) => {
  await mockPublicBackend(page)
  await page.addInitScript(() => localStorage.setItem('building-suit.theme', 'dark'))
  await page.setViewportSize({ width: 390, height: 844 })
  await openLanding(page)

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('.bs-marketing-header')).toBeVisible()
  await expect(page.locator('.ls-landing-hero')).toBeVisible()
  await expect(page.locator('#features')).toBeVisible()
  await expect(page.locator('#workflow')).toBeVisible()
  const menu = page.locator('button[aria-controls="marketing-mobile-navigation"]')
  await menu.click()
  await expect(page.locator('#marketing-mobile-navigation')).toBeVisible()

  const pricing = page.getByTestId('plan-pricing-grid')
  await pricing.scrollIntoViewIfNeeded()
  await expect(pricing.locator('article')).toHaveCount(4)
  await pricing.getByRole('radio', { name: 'Yearly' }).check()
  await expect(pricing.locator('[data-plan="starter"]')).toContainText('EGP 4,887.84')
  await expect(pricing.locator('[data-plan="scale"]').getByRole('button')).toBeDisabled()
  await expect(page.locator('.bs-marketing-footer')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('Ledger shared landing remains accessible in Arabic RTL', async ({ page, context }) => {
  await mockPublicBackend(page)
  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await openLanding(page)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.ls-landing-hero h1')).toBeVisible()
  await expect(page.getByTestId('plan-pricing-grid').getByRole('radio', { name: 'سنوي' })).toBeVisible()
})

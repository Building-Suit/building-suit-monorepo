import { expect, test, type Page } from '@playwright/test'

const limits = { active_locations: 1, active_members: 2, active_products: 250, active_services: 50, active_customers: 500, active_suppliers: 50 }
const catalog = [
  ['solo', 'standard', 'monthly', 349], ['solo', 'standard', 'annual', 2847.84],
  ['team', 'standard', 'monthly', 699], ['team', 'standard', 'annual', 5703.84],
  ['multi', 'multi_2', 'monthly', 999], ['multi', 'multi_2', 'annual', 8151.84],
  ['multi', 'multi_3', 'monthly', 1199], ['multi', 'multi_3', 'annual', 9783.84],
].map(([slug, planVariant, billingInterval, priceAmount]) => ({
  id: `plan-${slug}`, name: String(slug), slug, catalog_terms_id: `terms-${slug}-${planVariant}-${billingInterval}`,
  plan_variant: planVariant, variant_name: String(slug), price_amount: priceAmount, currency: 'EGP', billing_interval: billingInterval,
  trial_days: 7, features: {}, resource_limits: limits, is_purchasable: true, is_coming_soon: false,
}))

async function mockPublicBackend(page: Page) {
  await page.route('http://127.0.0.1:61321/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/rpc/shop_public_plan_catalog')) await route.fulfill({ json: catalog })
    else if (path.includes('/auth/v1/')) await route.fulfill({ status: 401, json: { message: 'no public session' } })
    else await route.fulfill({ json: [] })
  })
}

async function openLanding(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/auth/login')
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

test('Shop consumes the shared responsive marketing frame and plan presentation', async ({ page }) => {
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

  const pricing = page.getByTestId('shop-plan-cards')
  await pricing.scrollIntoViewIfNeeded()
  await expect(pricing.locator('article')).toHaveCount(3)
  await pricing.getByRole('radio', { name: 'Yearly' }).check()
  await expect(pricing.locator('[data-plan="solo"]')).toContainText('2,847.84')
  await expect(page.locator('.bs-marketing-footer')).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('Shop shared landing remains accessible in Arabic RTL', async ({ page, context }) => {
  await mockPublicBackend(page)
  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await openLanding(page)
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.ls-landing-hero h1')).toBeVisible()
  await expect(page.getByTestId('shop-plan-cards').getByRole('radio', { name: 'سنوي' })).toBeVisible()
})

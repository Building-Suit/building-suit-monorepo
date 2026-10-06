import { expect, test, type Page } from '@playwright/test'
import { ledgerFoundationFixture } from './foundation-fixture'
import { captureFoundation, expectChromeFree, expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'

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

async function openAuthenticatedShell(page: Page) {
  const id = 'd0000000-0000-4000-8000-000000000004'
  const user = { id, aud: 'authenticated', role: 'authenticated', email: 'operator@example.test', app_metadata: {}, user_metadata: { full_name: 'Ledger Operator' } }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.mock`
  await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/token') ? { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh', user } : user }))
  await page.route('**/rest/v1/**', async (route) => {
    const url = route.request().url()
    const args = route.request().postDataJSON() ?? {}
    if (url.endsWith('/rpc/subscription_plan_catalog')) await route.fulfill({ json: catalog })
    else if (url.endsWith('/rpc/platform_admin_read')) {
      const data = args.p_resource === 'identity'
        ? [{ id, role: 'platform_admin' }]
        : args.p_resource === 'status'
          ? [{ id: 'ledger', pending_payments: 0, unprocessed_billing_events: 0, failed_billing_events: 0, open_support_requests: 0, suspended_organizations: 0, support_reminder_delivery: 'not_configured' }]
          : args.p_resource === 'organizations'
            ? [
                { id: 'organization-2', name: 'Zeta ledger', status: 'trial', access_state: 'active', operator_suspended: false, plan_key: 'starter', subscription_status: 'trialing', member_count: 1, pending_payment_count: 0, open_support_count: 0 },
                { id: 'organization-1', name: 'Foundation ledger', status: 'active', access_state: 'active', operator_suspended: false, plan_key: 'solo', subscription_status: 'active', member_count: 2, pending_payment_count: 0, open_support_count: 0 },
              ].filter(organization => (!args.p_search || organization.name.toLowerCase().includes(String(args.p_search).toLowerCase())) && (!args.p_status || organization.status === args.p_status))
          : []
      await route.fulfill({ json: { ok: true, data } })
    }
    else await route.fulfill({ json: [] })
  })
  await page.goto('/platform-admin')
  await expect(page).toHaveURL(/\/login\?operator=1/)
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  // Label text includes BsField's aria-hidden required marker.
  await page.getByLabel(/^Email\s*\*?$/).fill(user.email)
  await page.getByLabel(/^Password\s*\*?$/).fill('synthetic-password')
  await page.locator('button[type=submit]').click()
  await expect(page).toHaveURL('/platform-admin')
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

test('Ledger auth uses the shared split frame, login shell, and responsive RTL signup wizard', async ({ page, context }) => {
  await mockPublicBackend(page)
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/login')
  await expect(page.locator('.bs-auth-layout')).toBeVisible()
  await expect(page.locator('.ls-auth-showcase')).toBeVisible()
  await expect(page.locator('.bs-auth-form')).toBeVisible()
  const loginShell = await page.locator('.bs-auth-layout__form-shell').boundingBox()
  expect(loginShell?.width).toBeLessThanOrEqual(432)

  await context.addCookies([{ name: 'building-suit-locale', value: 'ar', domain: '127.0.0.1', path: '/' }])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/signup')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('.ls-auth-showcase')).toBeHidden()
  await expect(page.locator('.bs-auth-form')).toBeVisible()
  await expect(page.locator('.bs-signup-wizard__step')).toHaveCount(2)
  await expect(page.locator('.bs-signup-wizard__step').first()).toHaveAttribute('aria-current', 'step')
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
})

test('Ledger authenticated shell shares mobile drawer, user menu, settings, and focus behavior', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAuthenticatedShell(page)

  const navigationTrigger = page.getByRole('button', { name: 'Open navigation' })
  await navigationTrigger.click()
  const navigation = page.locator('#bs-primary-navigation')
  await expect(navigation).toBeVisible()
  await expect(page.locator('.ls-scrim')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(navigation).toBeHidden()
  await expect(navigationTrigger).toBeFocused()

  await page.getByRole('button', { name: 'Account menu' }).click()
  const userMenu = page.getByRole('menu', { name: 'Account menu' })
  await expect(userMenu).toBeVisible()
  await expect(userMenu.getByText('operator@example.test')).toBeVisible()
  await userMenu.getByRole('menuitemradio', { name: 'Dark' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.keyboard.press('Escape')
  await expect(userMenu).toBeHidden()
  await expect(page.getByRole('button', { name: 'Account menu' })).toBeFocused()
})

test('Ledger shared table sorts, searches, filters, and opens the canonical record modal', async ({ page }) => {
  await openAuthenticatedShell(page)
  await page.getByLabel('View').selectOption('organizations')
  const table = page.locator('.bs-data-table')
  await expect(table).toBeVisible()
  await expect(table).toContainText('Foundation ledger')
  await expect(table).toContainText('Zeta ledger')

  await table.getByRole('columnheader', { name: 'Name' }).click()
  await expect(table.locator('tbody tr').first()).toContainText('Foundation ledger')

  await page.getByLabel('Search').fill('Foundation')
  await page.getByLabel('Search').press('Enter')
  await expect(table).not.toContainText('Zeta ledger')
  await expect(table).toContainText('Foundation ledger')

  await page.getByLabel('Status or role').selectOption('active')
  await page.getByRole('button', { name: 'Apply' }).click()
  await expect(table).toContainText('Foundation ledger')

  await table.locator('tbody tr', { hasText: 'Foundation ledger' }).getByRole('button', { name: 'Suspend' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeVisible()
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toBeHidden()
})


test('Ledger workspace dashboard, account hierarchy/detail, table pagination and record actions', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  const { calls } = await ledgerFoundationFixture(page, catalog)
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.getByText('Total assets', { exact: true })).toBeVisible()
  const context = page.getByRole('combobox', { name: 'Organization', exact: true })
  await expect(context).toContainText('Foundation ledger')
  await context.focus()
  await page.keyboard.press('ArrowDown')
  await expect(page.getByRole('option', { name: /Foundation ledger/ })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(context).toBeFocused()
  await expectNoPageOverflow(page)
  await captureFoundation(page, testInfo, 'ledger-dashboard-desktop-light-en')

  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await page.getByRole('menuitem', { name: /Foundation notification/ }).click()
  await expect.poll(() => calls.some(call => call.name === 'mark_notification_read')).toBe(true)
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()

  await page.getByRole('link', { name: 'Accounts', exact: true }).first().click()
  const tree = page.locator('#accounts-tree')
  await expect(tree).toContainText('Operating cash group')
  await page.getByLabel('Search accounts', { exact: true }).fill('Branch cash 01')
  const detailTrigger = tree.getByRole('button', { name: 'Branch cash 01', exact: true })
  await detailTrigger.click()
  const detail = page.getByRole('dialog')
  await expect(detail.getByTestId('activity-closing')).toContainText('10.00')
  await page.keyboard.press('Escape')
  await expect(detail).toBeHidden()
  await expect(detailTrigger).toBeFocused()
  await page.getByLabel('Search accounts', { exact: true }).fill('')
  const tableView = page.getByRole('button', { name: 'Table view', exact: true })
  await expectChromeFree(tableView)
  await tableView.click()
  const assets = page.getByRole('tab', { name: 'Assets', exact: true })
  await expectChromeFree(assets)
  await expect(assets).toHaveAttribute('aria-selected', 'true')
  const table = page.locator('#accounts-table')
  await expect(table.locator('tbody tr')).toHaveCount(25)
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(table.locator('tbody tr')).toHaveCount(2)
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await table.getByRole('columnheader', { name: 'Account', exact: true }).click()
  await expect(table.locator('tbody tr').first()).toContainText('Branch cash 01')
  await page.getByLabel('Search accounts', { exact: true }).fill('Branch cash 01')
  await expect(table.locator('tbody tr')).toHaveCount(1)
  const create = page.getByRole('tabpanel', { name: 'Assets', exact: true }).getByRole('button', { name: 'Add account', exact: true })
  await create.click()
  await expect(page.getByRole('dialog').getByLabel('Account name')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
  await expect(create).toBeFocused()
  await table.getByRole('button', { name: 'Edit', exact: true }).click()
  await expect(page.getByRole('dialog').getByLabel('Account name')).toHaveValue('Branch cash 01')
  await page.keyboard.press('Escape')
  await captureFoundation(page, testInfo, 'ledger-accounts-desktop-light-en')
})

test('Ledger subscription usage and shell context remain usable on narrow dark RTL screens', async ({ page }, testInfo) => {
  await ledgerFoundationFixture(page, catalog)
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Subscription', exact: true }).click()
  await expect(page.locator('#usage .bs-usage-meter')).toContainText('26 / 100')
  await page.getByRole('button', { name: 'Account menu', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'Dark', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'العربية', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('#usage .bs-usage-meter')).toBeVisible()
  await expectNoPageOverflow(page)
  await captureFoundation(page, testInfo, 'ledger-billing-mobile-dark-ar')
})

test('Ledger verification shell handles invalid synthetic OTP without leaving the form', async ({ page }) => {
  await mockPublicBackend(page)
  await page.route('**/auth/v1/verify', route => route.fulfill({ status: 400, json: { message: 'Invalid synthetic code', error_code: 'otp_expired' } }))
  await page.goto('/verify-email?email=foundation@example.test')
  const form = page.locator('.bs-verification-form')
  await expect(form).toContainText('foundation@example.test')
  const code = form.getByRole('textbox').first()
  for (let index = 0; index < 6; index++) await form.getByRole('textbox').nth(index).fill(String(index + 1))
  await form.locator('button[type=submit]').click()
  await expect(form.getByRole('alert')).toBeVisible()
  await expect(code).toHaveValue('')
  await expectNoPageOverflow(page)
})


test('Ledger signup wizard advances and preserves owner details when returning', async ({ page }) => {
  await mockPublicBackend(page)
  await page.route('http://127.0.0.1:60321/rest/v1/rpc/check_owner_availability', route => route.fulfill({ json: { email_taken: false, phone_taken: false } }))
  await page.goto('/signup')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel(/^Full name\s*\*?$/).fill('Foundation owner')
  await page.getByLabel(/^Phone number\s*\*?$/).fill('+201000000000')
  await page.getByLabel(/^Job title\s*\*?$/).fill('Owner')
  await page.getByLabel(/^Email\s*\*?$/).fill('signup@example.test')
  await page.getByLabel(/^Password\s*\*?$/).fill('synthetic-password')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.locator('.bs-signup-wizard__step').nth(1)).toHaveAttribute('aria-current', 'step')
  await expect(page.getByLabel(/^Legal business name\s*\*?$/)).toBeVisible()
  await page.getByRole('button', { name: 'Previous', exact: true }).click()
  await expect(page.getByLabel(/^Full name\s*\*?$/)).toHaveValue('Foundation owner')
  await expect(page.locator('.bs-signup-wizard__step').first()).toHaveAttribute('aria-current', 'step')
})

test('Ledger public desktop light frame keeps navigation links and pricing geometry', async ({ page }, testInfo) => {
  await mockPublicBackend(page)
  await page.addInitScript(() => localStorage.setItem('building-suit.theme', 'light'))
  await page.setViewportSize({ width: 1440, height: 900 })
  await openLanding(page)
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  const header = page.locator('.bs-marketing-header')
  await expect(header.getByRole('link', { name: 'Pricing', exact: true })).toHaveAttribute('href', /#pricing/)
  const grid = page.getByTestId('plan-pricing-grid')
  const first = await grid.locator('article').first().boundingBox()
  const second = await grid.locator('article').nth(1).boundingBox()
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect(Math.abs(first!.y - second!.y)).toBeLessThanOrEqual(1)
  expect(second!.x).toBeGreaterThan(first!.x + first!.width)
  await expectNoPageOverflow(page)
  await captureFoundation(page, testInfo, 'ledger-public-desktop-light-en')
})

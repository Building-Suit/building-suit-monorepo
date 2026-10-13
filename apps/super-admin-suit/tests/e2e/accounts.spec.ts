import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

// Controlled browser presentation/transport coverage. These responses do not prove real Auth/SQL.
const ids = { userId: randomUUID(), authorityEnvironmentId: randomUUID(), bindingId: randomUUID(), shopId: randomUUID(), subscriptionId: randomUUID(), planId: randomUUID() }
const snapshot = { id: ids.subscriptionId, status: 'trialing', planId: ids.planId, planName: 'Team fixture', trialStartAt: '2026-10-10T00:00:00Z', trialEndAt: '2026-10-17T00:00:00Z', periodStart: null, periodEnd: null }
for (const locale of ['en', 'ar']) {
  for (const mobile of [false, true]) {
    test(`early activation and reload retry ${locale} ${mobile ? 'mobile dark' : 'desktop light'}`, async ({ page }) => {
      await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 })
      await page.context().addCookies([{ name: 'building-suit-locale', value: locale, url: 'http://127.0.0.1:4324' }])
      await page.addInitScript(theme => localStorage.setItem('building-suit.theme', theme), mobile ? 'dark' : 'light')
      const fulfill = (route: Parameters<Parameters<typeof page.route>[1]>[0], data: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) })
      await page.route('**/api/session', route => fulfill(route, { userId: ids.userId, authorityEnvironmentId: ids.authorityEnvironmentId, role: 'owner' }))
      await page.route('**/api/accounts/context', route => fulfill(route, { modules: [{ bindingId: ids.bindingId, label: { en: 'Accounts', ar: 'الحسابات' } }] }))
      await page.route('**/api/accounts/shops?*', route => fulfill(route, { state: 'success', requestId: randomUUID(), auditId: randomUUID(), data: { items: [{ id: ids.shopId, name: 'Trial fixture', status: 'active', ownerEmail: 'owner@example.invalid', ownerName: 'Owner fixture', subscriptionStatus: 'trialing' }], total: 1 } }))
      const sent: Record<string, unknown>[] = []
      await page.route('**/api/accounts/shop?*', route => fulfill(route, { state: 'success', requestId: randomUUID(), auditId: randomUUID(), data: { subscription: { ...snapshot, status: sent.length ? 'active' : 'trialing' }, availablePlans: [{ planId: ids.planId, planName: 'Team fixture', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 123, blockers: [] }] } }))
      await page.route('**/api/accounts/activate', async route => {
        const input = route.request().postDataJSON()
        sent.push(input)
        await fulfill(route, sent.length === 1 ? { state: 'outcome_unknown', requestId: input.requestId } : { state: 'success', requestId: input.requestId, auditId: randomUUID(), replayed: true, data: { ...snapshot, status: 'active', periodStart: '2026-10-13T08:00:00Z', periodEnd: '2026-11-13T08:00:00Z' } })
      })
      await page.goto(`/accounts?bindingId=${ids.bindingId}`)
      await expect(page.locator('#sas-account')).toBeVisible()
      await page.locator('#sas-account').click()
      await page.getByRole('option', { name: /Trial fixture/ }).click()
      await page.getByRole('button', { name: locale === 'en' ? 'Choose plan and activate' : 'اختيار الباقة وتفعيلها', exact: true }).click()
      const dialog = page.getByRole('dialog')
      await dialog.locator('#sas-plan').click()
      await page.getByRole('option', { name: /Team fixture/ }).click()
      await dialog.locator('#sas-reason').fill('Owner approved immediate access')
      await dialog.getByRole('button', { name: locale === 'en' ? 'Activate now' : 'تفعيل الآن', exact: true }).click()
      await expect(dialog.locator('#sas-reason')).toBeDisabled()
      expect(sent).toHaveLength(1)
      expect(sent[0]).toMatchObject({ bindingId: ids.bindingId, shopId: ids.shopId, subscriptionId: ids.subscriptionId, planId: ids.planId })
      expect(sent[0]).not.toHaveProperty('payment')
      // A lost response can follow a committed activation. Reload must retry even when the refreshed account is active.
      await page.reload()
      await expect(dialog.locator('#sas-reason')).toHaveValue('Owner approved immediate access')
      await expect(dialog.locator('#sas-reason')).toBeDisabled()
      await dialog.getByRole('button', { name: locale === 'en' ? 'Retry the same request' : 'إعادة محاولة الطلب نفسه', exact: true }).click()
      await expect(dialog).toHaveCount(0)
      await expect(page.getByText(locale === 'en' ? 'Plan activation confirmed' : 'تم تأكيد تفعيل الباقة', { exact: true })).toBeVisible()
      expect(sent).toHaveLength(2)
      expect(sent[1]).toEqual(sent[0])
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
      await page.screenshot({ path: `/tmp/sas-activation-${locale}-${mobile}.png` })
    })
  }
}

test('missing database module renders no activation controls', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ userId: ids.userId, authorityEnvironmentId: ids.authorityEnvironmentId, role: 'owner' }) }))
  await page.route('**/api/accounts/context', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ modules: [] }) }))
  await page.goto(`/accounts?bindingId=${ids.bindingId}`)
  await expect(page.getByText('No account module is configured for this environment.', { exact: true })).toBeVisible()
  await expect(page.locator('#sas-account')).toHaveCount(0)
})

test('account endpoints reject unauthenticated calls and cross-origin writes before dispatch', async ({ request }) => {
  for (const path of ['/api/accounts/context', `/api/accounts/shops?bindingId=${ids.bindingId}`, `/api/accounts/shop?bindingId=${ids.bindingId}&shopId=${ids.shopId}`]) {
    const response = await request.get(path)
    expect(response.status()).toBe(401)
    expect(response.headers()['cache-control']).toContain('no-store')
  }
  const noOrigin = await request.post('/api/accounts/activate', { data: {} })
  expect(noOrigin.status()).toBe(403)
  const foreignOrigin = await request.post('/api/accounts/activate', { data: {}, headers: { origin: 'https://other.example' } })
  expect(foreignOrigin.status()).toBe(403)
  const unauthenticated = await request.post('/api/accounts/activate', { data: {}, headers: { origin: 'http://127.0.0.1:4324' } })
  expect(unauthenticated.status()).toBe(401)
  expect(unauthenticated.headers()['cache-control']).toContain('no-store')
})

import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

const org = '47000000-0000-4000-8000-000000000011'
const actor = '47000000-0000-4000-8000-000000000012'
async function mockApi(page: Page, state: 'ready' | 'empty' | 'error' | 'denied' = 'ready') {
  const workspace = { as_of_date: '2034-12-31', currency: 'EGP', accounts: [], total: 1, offset: 0, limit: 25,
    sources: [{ id: 'source-1', source_key: 'Inventory Suit fixture', actor_id: actor, effective_from: '2034-01-01',
      inventory_minor: '5300', inventory_gl_minor: '5300', inventory_variance_minor: '0', cogs_minor: '3000', cogs_gl_minor: '3000',
      cogs_variance_minor: '0', cogs_closing_minor: '0', source_inventory_variance_minor: '0', source_cogs_variance_minor: '0', latest_sequence: '6', status: 'reconciled' }],
    facts: [{ id: 'fact-1', source_id: 'source-1', sequence: '1', movement_id: 'MOVE-1', movement_version: 1, valuation_id: 'VALUE-1', valuation_version: 1,
      costing_method: 'source-approved-method', policy_version: 'policy-1', kind: 'purchase', effective_date: '2034-02-01', accounting_date: '2034-02-02',
      inventory_delta_minor: '10000', cogs_delta_minor: '0', transaction_id: 'tx-1', journal_reference: 'JRN-FIXTURE1', related_fact_id: null, reason: null }] }
  const capabilities = ['inventory.read', 'reports.read']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'inventory@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'Inventory workspace', slug: 'inventory-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = state === 'denied' ? [] : capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_inventory_workspace')) {
      if (state === 'error') { await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Fixture failure' }) }); return }
      body = state === 'empty' ? { ...workspace, sources: [], facts: [], total: 0 } : workspace
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

for (const locale of ['en', 'ar'] as const) test(`${locale}: inventory source reconciliation and journal trace`, async ({ page, context }) => {
  const copy = locale === 'en' ? en : ar
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await mockApi(page)
  await page.goto('/login')
  await page.getByLabel(copy.auth.email).fill('inventory@test.local')
  await page.getByLabel(copy.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await page.goto('/inventory-accounting')
  await expect(page.getByRole('heading', { name: copy.inventory.title, exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(page.getByRole('note')).toContainText(copy.inventory.boundary)
  await expect(page.locator('[data-inventory-status="reconciled"]')).toContainText(copy.inventory.status.reconciled)
  await expect(page.getByRole('table', { name: copy.inventory.facts })).toContainText('VALUE-1')
  await expect(page.getByRole('link', { name: 'JRN-FIXTURE1' })).toHaveAttribute('href', '/transactions?q=JRN-FIXTURE1')
  await expect(page.getByRole('button', { name: copy.inventory.configure, exact: true })).toHaveCount(0)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: copy.inventory.facts })).toBeVisible()
})

for (const state of ['empty', 'error', 'denied'] as const) test(`inventory ${state} state`, async ({ page }) => {
  await mockApi(page, state)
  await page.goto('/login')
  await page.getByLabel(en.auth.email).fill('inventory@test.local')
  await page.getByLabel(en.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: en.auth.signIn, exact: true }).click()
  await page.goto('/inventory-accounting')
  if (state === 'empty') await expect(page.getByText(en.inventory.noSource)).toBeVisible()
  if (state === 'error') {
    await expect(page.getByRole('alert')).toContainText(en.inventory.loadError)
    await expect(page.getByRole('button', { name: en.common.retry })).toBeVisible()
  }
  if (state === 'denied') await expect(page.getByText(en.inventory.denied)).toBeVisible()
})

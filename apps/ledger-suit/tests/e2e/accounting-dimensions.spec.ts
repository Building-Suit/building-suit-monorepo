import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

const org = '46000000-0000-4000-8000-000000000001'
const actor = '46000000-0000-4000-8000-000000000002'
async function mockApi(page: Page) {
  const workspace = {
    values: [{ id: 'cc-1', kind: 'cost_center', code: 'CC-CAI', name: 'Cairo', description: null, status: 'active', created_at: '2026-01-01', updated_at: '2026-01-01', archived_at: null }, { id: 'pr-1', kind: 'project', code: 'PR-1', name: 'Implementation', description: null, status: 'inactive', created_at: '2026-01-01', updated_at: '2026-02-01', archived_at: '2026-02-01' }],
    accounts: [{ id: 'account-1', code: '5000', name: 'Operating expense', role: 'posting', archived: false }], policies: [], legacy_uncontrolled_count: 2, allocation_count: 3,
  }
  const report = { groups: [{ dimension_value_id: null, code: 'UNASSIGNED', name: 'Unassigned', opening_debit_minor: '0', opening_credit_minor: '0', period_debit_minor: '0', period_credit_minor: '1000', closing_debit_minor: '0', closing_credit_minor: '1000', entry_count: 1 }, { dimension_value_id: 'cc-1', code: 'CC-CAI', name: 'Cairo', opening_debit_minor: '0', opening_credit_minor: '0', period_debit_minor: '1000', period_credit_minor: '0', closing_debit_minor: '1000', closing_credit_minor: '0', entry_count: 1 }], details: [], reconciliation_difference: { opening_debit_minor: '0', opening_credit_minor: '0', period_debit_minor: '0', period_credit_minor: '0' } }
  const capabilities = ['dimensions.read', 'dimensions.manage', 'dimensions.configure', 'dimensions.allocate', 'reports.read']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'dimensions@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'Dimension workspace', slug: 'dimension-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_dimension_workspace')) body = workspace
    else if (path.endsWith('/report_by_accounting_dimension')) body = report
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

for (const locale of ['en', 'ar'] as const) test(`${locale}: dimensions expose controlled values, legacy warning, and reconciled Unassigned reporting`, async ({ page, context }) => {
  const copy = locale === 'en' ? en : ar
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await mockApi(page)
  await page.goto('/login')
  await page.getByLabel(copy.auth.email).fill('dimensions@test.local')
  await page.getByLabel(copy.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await page.goto('/accounting-dimensions')
  await expect(page.getByRole('heading', { name: copy.dimensions.title, exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(page.getByRole('table', { name: copy.dimensions.values })).toContainText('CC-CAI')
  await expect(page.getByRole('status')).toContainText('2')
  await page.getByRole('button', { name: copy.dimensions.tabs.reports }).click()
  await page.getByRole('button', { name: copy.dimensions.run }).click()
  await expect(page.getByRole('table', { name: copy.dimensions.grouped })).toContainText(copy.dimensions.unassigned)
  await expect(page.locator('[data-dimension-reconciled="true"]')).toContainText(copy.dimensions.reconciled)
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: copy.dimensions.grouped })).toBeVisible()
})

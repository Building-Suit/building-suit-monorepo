import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

const org = '47000000-0000-4000-8000-000000000011'
const actor = '47000000-0000-4000-8000-000000000012'
async function mockApi(page: Page) {
  const report = { from_date: '2034-01-01', to_date: '2034-12-31', registration_number: 'EG-VAT-12345', jurisdiction: 'EG', currency: 'EGP', output_tax_minor: '14000', input_tax_minor: '1400', net_vat_minor: '12600', output_taxable_base_minor: '100000', input_taxable_base_minor: '10000', output_gl_minor: '14000', input_gl_minor: '1400', output_difference_minor: '0', input_difference_minor: '0', reconciled: true, documents: [{ id: 'vat-1', direction: 'output', kind: 'invoice', document_date: '2034-02-01', tax_point_date: '2034-02-02', reference: 'SALE-1', counterparty_id: null, base_account_id: 'revenue', gross_account_id: 'receivable', tax_account_id: 'output', taxable_base_minor: '100000', tax_minor: '14000', gross_minor: '114000', rate_basis_points: 1400, transaction_id: 'tx-1', adjusts_document_id: null, reason: null }] }
  const workspace = { profiles: [{ id: 'profile', registration_number: 'EG-VAT-12345', effective_from: '2034-01-01', output_vat_account_id: 'output', input_vat_account_id: 'input' }], rules: [{ id: 'rule', code: 'EG_STANDARD_DOMESTIC', name_en: 'Egypt standard domestic VAT 14%', name_ar: 'ضريبة القيمة المضافة المصرية القياسية ١٤٪', rate_basis_points: 1400, effective_from: '2017-07-01', evidence_verified_on: '2026-09-25', evidence_uri: 'https://eta.gov.eg', scope_note: 'bounded' }], accounts: [], counterparties: [], report }
  const capabilities = ['tax.read', 'tax.post', 'tax.adjust', 'tax.reverse', 'reports.read']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'vat@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'VAT workspace', slug: 'vat-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_egypt_vat_workspace')) body = workspace
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}

for (const locale of ['en', 'ar'] as const) test(`${locale}: scoped VAT report shows dates, boundary wording and exact reconciliation`, async ({ page, context }) => {
  const copy = locale === 'en' ? en : ar
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  await mockApi(page)
  await page.goto('/login')
  await page.getByLabel(copy.auth.email).fill('vat@test.local')
  await page.getByLabel(copy.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await page.goto('/tax-vat')
  await expect(page.getByRole('heading', { name: copy.vat.title, exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(page.getByRole('note')).toContainText(copy.vat.scopeWarning)
  await expect(page.locator('[data-vat-reconciled="true"]')).toContainText(copy.vat.reconciled)
  await expect(page.getByRole('table', { name: copy.vat.documents })).toContainText('SALE-1')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: copy.vat.documents })).toBeVisible()
})

import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { navigateFixture, expectNoPageOverflow } from '../../../../packages/testing/browser-foundation'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }

const org = '47000000-0000-4000-8000-000000000011'
const actor = '47000000-0000-4000-8000-000000000012'
async function mockApi(page: Page) {
  const report = { from_date: '2034-01-01', to_date: '2034-12-31', registration_number: 'EG-VAT-12345', jurisdiction: 'EG', currency: 'EGP', output_tax_minor: '14000', input_tax_minor: '1400', net_vat_minor: '12600', output_taxable_base_minor: '100000', input_taxable_base_minor: '10000', output_gl_minor: '14000', input_gl_minor: '1400', output_difference_minor: '0', input_difference_minor: '0', reconciled: true, documents: [{ id: 'vat-1', direction: 'output', kind: 'invoice', document_date: '2034-02-01', tax_point_date: '2034-02-02', reference: 'SALE-1', counterparty_id: null, base_account_id: 'revenue', gross_account_id: 'receivable', tax_account_id: 'output', taxable_base_minor: '100000', tax_minor: '14000', gross_minor: '114000', rate_basis_points: 1400, transaction_id: 'tx-1', adjusts_document_id: null, reason: null }] }
  const workspace = { profiles: [{ id: 'profile', registration_number: 'EG-VAT-12345', effective_from: '2034-01-01', output_vat_account_id: 'output', input_vat_account_id: 'input' }], rules: [{ id: 'rule', code: 'EG_STANDARD_DOMESTIC', name_en: 'Egypt standard domestic VAT 14%', name_ar: 'ضريبة القيمة المضافة المصرية القياسية ١٤٪', rate_basis_points: 1400, effective_from: '2017-07-01', evidence_verified_on: '2026-09-25', evidence_uri: 'https://eta.gov.eg', scope_note: 'bounded' }], accounts: [{ id: 'revenue', code: '4000', name: 'Fixture revenue', type: 'revenue', subtype: 'sales', role: 'posting', currency: 'EGP', archived: false }, { id: 'receivable', code: '1100', name: 'Fixture receivable', type: 'asset', subtype: 'receivables', role: 'posting', currency: 'EGP', archived: false }], counterparties: [], report }
  const capabilities = ['tax.read', 'tax.post', 'tax.adjust', 'tax.reverse', 'reports.read']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'vat@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01' }
  const calls: { name: string; args: Record<string, unknown> }[] = []
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    const name = path.split('/').pop()!
    if (path.includes('/rpc/')) calls.push({ name, args: route.request().postDataJSON() ?? {} })
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'VAT workspace', slug: 'vat-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_egypt_vat_workspace')) body = workspace
    else if (name === 'reverse_egypt_vat_document') { report.documents.push({ ...report.documents[0], id: 'vat-reversal', kind: 'reversal', adjusts_document_id: 'vat-1', reason: String(route.request().postDataJSON().p_reason) }); body = 'vat-reversal' }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return { calls, report }
}

for (const locale of ['en', 'ar'] as const) for (const theme of ['light', 'dark']) for (const width of [390, 768, 1440]) {
  test(`VAT reconciliation and immutable reversal: ${locale}, ${theme}, ${width}`, async ({ page, context }) => {
    const copy = locale === 'ar' ? ar : en
    await page.setViewportSize({ width, height: 1000 })
    await page.addInitScript(value => localStorage.setItem('building-suit.theme', value), theme)
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    const { calls, report } = await mockApi(page)
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-client-ready', 'true')
    await page.getByLabel(copy.auth.email).fill('vat@test.local')
    await page.getByLabel(copy.auth.password).fill('fixture-password')
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
    await expect(page).toHaveURL(/\/dashboard/)
    await navigateFixture(page, '/tax-vat')
    await expect(page.locator('[data-vat-reconciled="true"]')).toContainText(copy.vat.reconciled)
    await expect(page.getByRole('table')).toContainText('SALE-1')
    await page.getByRole('button', { name: copy.vat.reverse, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel(copy.vat.reference, { exact: true })).toBeDisabled()
    await expect(dialog.getByLabel(copy.vat.base, { exact: true })).toHaveValue('1000.00')
    await expect(dialog.getByLabel(copy.vat.base, { exact: true })).toBeDisabled()
    await dialog.getByLabel(copy.vat.reversalReason, { exact: true }).fill('Correct original tax document')
    await expectNoPageOverflow(page)
    await mkdir('.local/atomic-template-evidence/screenshots', { recursive: true })
    await page.screenshot({ path: `.local/atomic-template-evidence/screenshots/vat-${locale}-${theme}-${width}.png`, fullPage: true, animations: 'disabled' })
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect(calls.find(call => call.name === 'reverse_egypt_vat_document')?.args).toMatchObject({ p_organization_id: org, p_document_id: 'vat-1', p_reason: 'Correct original tax document' })
    expect(report.documents[0]).toMatchObject({ id: 'vat-1', kind: 'invoice', taxable_base_minor: '100000', tax_minor: '14000', adjusts_document_id: null })
    expect(report.documents[1]).toMatchObject({ kind: 'reversal', adjusts_document_id: 'vat-1' })
    await expect(page.getByRole('table')).toContainText(copy.vat.kinds.reversal)
    await expect(page.getByRole('button', { name: copy.vat.reverse, exact: true })).toHaveCount(0)
  })
}

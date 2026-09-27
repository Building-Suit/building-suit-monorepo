import { expect, test, type Locator, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import type { FxWorkspace } from '../../app/utils/fxSubledger'

const org = '71000000-0000-4000-8000-000000000001'
const actor = '71000000-0000-4000-8000-000000000002'
const controls = { customer: 'ar-control', supplier: 'ap-control' }

// Independent test oracle: preserve currency/scale/sign, accepting localized digits.
function displayedMoneyNumber(text: string) {
  const normalized = text
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/\u066b/g, '.')
    .replace(/[\u066c,]/g, '')
    .replace(/[\u200e\u200f\u061c\u202a-\u202e\u2066-\u2069]/g, '')
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/\u2212/g, '-')
  const numbers = normalized.match(/-?\d+(?:\.\d+)?/g) ?? []
  // More than one numeric value in a cell is not an acceptable match.
  return numbers.length === 1 ? numbers[0]! : normalized
}

async function expectMoneyCell(cell: Locator, expected: string) {
  await expect(cell).toBeVisible()
  await expect.poll(async () => displayedMoneyNumber(await cell.innerText())).toBe(expected)
}

// USD 60 at 50 -> EGP 3,000; revalued at 55 -> EGP 3,300.
// All API values below are minor units: the difference is 30,000 minor = 300.00 EGP.
const revaluationPreview = {
  open_item_id: 'usd-1', reference: 'USD-100', currency_code: 'USD',
  outstanding_minor: '6000', current_carrying_base_minor: '300000',
  closing_rate: '55', closing_base_minor: '330000', delta_base_minor: '30000',
  rate_reference: 'CLOSE-55',
}

async function mockApi(page: Page, subledger: 'customer' | 'supplier') {
  const control = controls[subledger]
  const party = subledger === 'customer' ? 'customer' : 'supplier'
  const fx: FxWorkspace = {
    currencies: [{ code: 'EGP', minor_unit: 2, name: 'Egyptian Pound' }, { code: 'EUR', minor_unit: 2, name: 'Euro' }, { code: 'USD', minor_unit: 2, name: 'US Dollar' }],
    mapping: { realized_gain_account_id: 'gain', realized_loss_account_id: 'loss', unrealized_gain_account_id: 'ugain', unrealized_loss_account_id: 'uloss' },
    counterparties: [{ id: party, name: subledger === 'customer' ? 'Global Customer' : 'Global Supplier' }],
    accounts: [
      { id: control, name: subledger === 'customer' ? 'AR Control' : 'AP Control', type: subledger === 'customer' ? 'asset' : 'liability', subtype: subledger === 'customer' ? 'accounts_receivable' : 'accounts_payable', role: 'control', subledger, currency: 'EGP' },
      { id: 'offset', name: subledger === 'customer' ? 'Revenue' : 'Purchases', type: subledger === 'customer' ? 'revenue' : 'expense', subtype: subledger === 'customer' ? 'service_revenue' : 'other_expense', role: 'posting', subledger: null, currency: 'EGP' },
      { id: 'cash', name: 'EUR bank', type: 'asset', subtype: 'bank', role: 'posting', subledger: null, currency: 'EUR' },
      { id: 'gain', name: 'Realized gain', type: 'revenue', subtype: 'other_income', role: 'posting', subledger: null, currency: 'EGP' },
      { id: 'loss', name: 'Realized loss', type: 'expense', subtype: 'other_expense', role: 'posting', subledger: null, currency: 'EGP' },
      { id: 'ugain', name: 'Unrealized gain', type: 'revenue', subtype: 'other_income', role: 'posting', subledger: null, currency: 'EGP' },
      { id: 'uloss', name: 'Unrealized loss', type: 'expense', subtype: 'other_expense', role: 'posting', subledger: null, currency: 'EGP' },
    ],
    items: [
      { id: 'usd-1', counterparty_id: party, counterparty_name: 'Global', control_account_id: control, reference: 'USD-100', document_date: '2026-01-01', due_date: '2026-01-31', currency_code: 'USD', original_minor: '10000', outstanding_minor: '6000', recognition_rate: '50', carrying_base_minor: '300000', rate_source: 'Manual worksheet', rate_reference: 'USD-50' },
      { id: 'usd-2', counterparty_id: party, counterparty_name: 'Global', control_account_id: control, reference: 'USD-40', document_date: '2026-01-02', due_date: '2026-02-01', currency_code: 'USD', original_minor: '4000', outstanding_minor: '4000', recognition_rate: '50', carrying_base_minor: '200000', rate_source: 'Manual worksheet', rate_reference: 'USD-50-B' },
    ],
    settlements: [{ id: 'settled', date: '2026-02-10', reference: 'EUR-90', currency_code: 'EUR', gross_minor: '9000', rate: '60', rate_source: 'Manual worksheet', rate_reference: 'EUR-60', carrying_base_minor: '500000', settlement_base_minor: '540000', realized_fx_base_minor: '40000', reverses_settlement_id: null }],
    allocations: [{ id: 'allocation', settlement_reference: 'EUR-90', item_reference: 'USD-100', document_currency: 'USD', settlement_currency: 'EUR', document_amount_minor: '10000', settlement_amount_minor: '9000', allocation_rate: '0.9', conversion_evidence: 'AGREED', carrying_base_minor: '500000', settlement_base_minor: '540000', realized_fx_base_minor: '40000', rounding_residual_base_minor: '0' }],
    revaluations: [],
  }
  const requests: Record<string, unknown>[] = []
  let rejectOnce = true
  const capabilities = ['fx.read', 'fx.manage', 'fx.revalue', subledger === 'customer' ? 'ar.read' : 'ap.read', subledger === 'customer' ? 'ar.receive' : 'ap.receive', 'controls.reconcile']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'fx@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) {
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      body = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user }
    }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'FX workspace', slug: 'fx-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_fx_workspace')) body = fx
    else if (path.endsWith('/preview_fx_revaluation')) body = [revaluationPreview]
    else if (path.endsWith('/post_fx_settlement')) {
      requests.push(route.request().postDataJSON())
      if (rejectOnce) { rejectOnce = false; await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'FX_ALLOCATION_CONVERSION_MISMATCH', code: '23514' }) }); return }
      body = 'settlement-id'
    }
    else if (path.endsWith('/confirm_fx_revaluation')) { requests.push(route.request().postDataJSON()); body = 'batch-id' }
    else if (path.endsWith(subledger === 'customer' ? '/read_ar_workspace' : '/read_ap_workspace')) {
      body = subledger === 'customer'
        ? { customers: [{ id: party, name: 'Global', archived: false }], accounts: [], items: [], statement: null, reconciliation: [{ control_account_id: control, account_name: 'AR Control', gl_balance_minor: '500000', subledger_balance_minor: '500000', variance_minor: '0', status: 'reconciled', explanation_reason: null }], legacy: [] }
        : { suppliers: [{ id: party, name: 'Global', archived: false }], accounts: [], items: [], statement: null, reconciliation: [{ control_account_id: control, account_name: 'AP Control', gl_balance_minor: '500000', subledger_balance_minor: '500000', variance_minor: '0', status: 'reconciled', explanation_reason: null }], legacy: [] }
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return requests
}

for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: real FX panel allocates, previews, recovers, and exposes reconciliation`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'en' ? en : ar
    const subledger = locale === 'en' ? 'customer' : 'supplier'
    const route = subledger === 'customer' ? '/receivables' : '/payables'
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    const requests = await mockApi(page, subledger)
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
    await page.getByLabel(copy.auth.email).fill('fx@test.local'); await page.getByLabel(copy.auth.password).fill('fixture-password')
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click(); await expect(page).toHaveURL('/dashboard'); await page.goto(route)
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    const panel = page.getByTestId('fx-panel')
    await expect(panel.getByRole('table', { name: copy.fx.openItems })).toContainText('USD-100')
    await expect(panel.getByRole('table', { name: copy.fx.settlementHistory })).toContainText('EUR-90')
    const historyRow = panel.getByRole('table', { name: copy.fx.settlementHistory, exact: true }).getByRole('row').filter({ hasText: 'EUR-90' })
    await expectMoneyCell(historyRow.getByRole('cell').nth(5), '400.00')
    await expect(page.getByRole('table', { name: copy.controls.reconciliation })).toContainText(copy.controls.statuses.reconciled)

    await panel.getByRole('button', { name: copy.fx.tabs.settlement, exact: true }).click()
    const settlementForm = panel.locator('form')
    await settlementForm.getByRole('combobox', { name: copy.fx.counterparty, exact: true }).selectOption(subledger === 'customer' ? 'customer' : 'supplier')
    await settlementForm.getByRole('combobox', { name: copy.fx.control, exact: true }).selectOption(controls[subledger]); await settlementForm.getByRole('combobox', { name: copy.fx.cash, exact: true }).selectOption('cash')
    const settlementCurrency = settlementForm.getByRole('combobox', { name: copy.fx.currency, exact: true })
    await expect(settlementCurrency).toHaveCount(1)
    await settlementCurrency.selectOption('EUR')
    await expect(settlementCurrency).toHaveValue('EUR')
    await settlementForm.getByLabel(copy.fx.reference, { exact: true }).fill('UI-EUR-90')
    await settlementForm.getByLabel(copy.fx.gross, { exact: true }).fill('90.00'); await settlementForm.getByLabel(copy.fx.baseRate, { exact: true }).fill('60')
    await settlementForm.getByLabel(copy.fx.rateSource, { exact: true }).fill('Approved worksheet'); await settlementForm.getByLabel(copy.fx.rateEvidence, { exact: true }).fill('EUR-60')
    const documentAmounts = settlementForm.getByLabel(copy.fx.documentAmount, { exact: true }); const settlementAmounts = settlementForm.getByLabel(copy.fx.settlementAmount, { exact: true }); const crossRates = settlementForm.getByLabel(copy.fx.crossRate, { exact: true }); const evidence = settlementForm.getByLabel(copy.fx.conversionEvidence, { exact: true })
    await documentAmounts.nth(0).fill('60.00'); await settlementAmounts.nth(0).fill('54.00'); await crossRates.nth(0).fill('0.9'); await evidence.nth(0).fill('AGREED-A')
    await documentAmounts.nth(1).fill('40.00'); await settlementAmounts.nth(1).fill('36.00'); await crossRates.nth(1).fill('0.9'); await evidence.nth(1).fill('AGREED-B')
    await panel.getByRole('button', { name: copy.fx.postSettlement, exact: true }).click(); await expect(panel.getByRole('alert')).toContainText('FX_ALLOCATION_CONVERSION_MISMATCH')
    await expect(settlementForm.getByLabel(copy.fx.gross, { exact: true })).toHaveValue('90.00')
    await panel.getByRole('button', { name: copy.fx.postSettlement, exact: true }).click(); await expect(panel.getByRole('status')).toHaveText(copy.fx.saved)
    expect(requests[0]?.p_gross_settlement_minor).toBe('9000'); expect(requests[0]?.p_allocations).toHaveLength(2)

    await panel.getByRole('button', { name: copy.fx.tabs.revaluation, exact: true }).click()
    const revaluationForm = panel.locator('form')
    await revaluationForm.getByRole('combobox', { name: copy.fx.control, exact: true }).selectOption(controls[subledger])
    await revaluationForm.getByLabel(copy.fx.reference, { exact: true }).fill('MONTH-CLOSE'); await revaluationForm.getByLabel(copy.fx.rateSource, { exact: true }).fill('Closing worksheet')
    await revaluationForm.getByLabel(`USD · ${copy.fx.closingRate}`, { exact: true }).fill('55'); await revaluationForm.getByLabel(copy.fx.rateEvidence, { exact: true }).fill('CLOSE-55')
    expect(BigInt(revaluationPreview.outstanding_minor) * 55n).toBe(BigInt(revaluationPreview.closing_base_minor))
    expect(BigInt(revaluationPreview.closing_base_minor) - BigInt(revaluationPreview.current_carrying_base_minor)).toBe(BigInt(revaluationPreview.delta_base_minor))
    await panel.getByRole('button', { name: copy.fx.preview, exact: true }).click()
    const previewTable = panel.getByRole('table', { name: copy.fx.preview, exact: true })
    const previewRow = previewTable.getByRole('row').filter({ hasText: 'USD-100' })
    await expect(previewRow).toHaveCount(1)
    const previewCells = previewRow.getByRole('cell')
    await expect(previewCells.nth(1)).toHaveText('USD')
    await expectMoneyCell(previewCells.nth(2), '60.00')
    await expectMoneyCell(previewCells.nth(3), '3000.00')
    await expectMoneyCell(previewCells.nth(4), '3300.00')
    await expectMoneyCell(previewCells.nth(5), '300.00')
    await panel.getByRole('button', { name: copy.fx.confirm, exact: true }).click(); await expect(panel.getByRole('status')).toHaveText(copy.fx.saved)
    const revaluationRequest = requests.find(request => request.p_reference === 'MONTH-CLOSE')
    expect(revaluationRequest?.p_rates).toEqual({ USD: { rate: '55', reference: 'CLOSE-55' } })
  })
}

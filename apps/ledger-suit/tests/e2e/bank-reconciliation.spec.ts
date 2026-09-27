import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import type { BankWorkspace } from '../../app/utils/bankReconciliation'

const org = '43000000-0000-4000-8000-000000000001'
const actor = '43000000-0000-4000-8000-000000000002'
async function mockApi(page: Page) {
  const requests: Record<string, unknown>[] = []
  const workspace: BankWorkspace = {
    accounts: [{ id: 'bank', name: 'Operating bank / البنك التشغيلي', type: 'asset', subtype: 'bank', currency: 'EGP', role: 'posting' }, { id: 'expense', name: 'Bank fees', type: 'expense', subtype: 'bank_fees', currency: 'EGP', role: 'posting' }],
    reconciliations: [{ id: 'reconciliation', bank_account_id: 'bank', currency_code: 'EGP', statement_start: '2026-09-01', statement_end: '2026-09-30', opening_balance_minor: '0', closing_balance_minor: '7000', file_name: 'september.csv', status: 'review', import_errors: [], completed_at: null }],
    selected_id: 'reconciliation',
    lines: [{ id: 'line-1', source_row: 1, date: '2026-09-10', amount_minor: '10000', description: 'Customer deposit', external_reference: 'DEP-1', status: 'unmatched', validation_error: null, duplicate_of_line_id: null }, { id: 'line-2', source_row: 2, date: null, amount_minor: null, description: 'Bad row', external_reference: null, status: 'unresolved', validation_error: 'INVALID_DATE', duplicate_of_line_id: null }],
    candidates: [{ id: 'journal-1', date: '2026-09-10', description: 'Customer receipt', reference: 'RCPT-1', effect_minor: '10000', type: 'income' }],
    matches: [], outstanding: [{ id: 'out-1', transaction_id: 'journal-out', bank_effect_minor: '2000', reason: 'Deposit in transit', active: true, created_at: '2026-09-30T00:00:00Z', removal_reason: null }],
    events: [{ id: 1, event_type: 'statement.imported', statement_line_id: null, match_group_id: null, transaction_id: null, reason: null, before_data: null, after_data: {}, occurred_at: '2026-09-30T00:00:00Z' }],
    equation: { statement_minor: '7000', outstanding_minor: '2000', ledger_minor: '9000', difference_minor: '0' },
  }
  const capabilities = ['bank.read', 'bank.import', 'bank.match', 'bank.adjust', 'bank.complete', 'bank.reopen']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'bank@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) { const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url'); body = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user } }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'Bank workspace', slug: 'bank-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_bank_reconciliation_workspace')) body = workspace
    else if (path.endsWith('/match_bank_items')) { requests.push(route.request().postDataJSON()); body = 'match-1' }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return requests
}

for (const locale of ['en', 'ar'] as const) test(`${locale}: exact bank matching workspace is directional, traceable, and responsive`, async ({ page, context }) => {
  const copy = locale === 'en' ? en : ar
  await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
  const requests = await mockApi(page)
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel(copy.auth.email).fill('bank@test.local')
  await page.getByLabel(copy.auth.password).fill('fixture-password')
  await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await page.goto('/bank-reconciliation')
  await expect(page.getByRole('heading', { name: copy.bank.title, exact: true })).toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  await expect(page.getByRole('table', { name: copy.bank.statementLines })).toContainText(copy.bank.lineStatuses.unmatched)
  await expect(page.getByRole('table', { name: copy.bank.statementLines })).toContainText(copy.bank.lineStatuses.unresolved)
  await expect(page.locator('[data-bank-difference]')).toContainText('0')
  await page.getByLabel(copy.bank.selectLine.replace('{row}', '1')).check()
  await page.getByLabel(copy.bank.selectTransaction.replace('{reference}', 'RCPT-1')).check()
  await page.getByRole('button', { name: copy.bank.matchExact, exact: true }).click()
  await expect.poll(() => requests.length).toBe(1)
  expect(requests[0]).toMatchObject({ p_reconciliation_id: 'reconciliation', p_statement_line_ids: ['line-1'], p_transaction_ids: ['journal-1'] })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('heading', { name: copy.bank.equation, exact: true })).toBeVisible()
})

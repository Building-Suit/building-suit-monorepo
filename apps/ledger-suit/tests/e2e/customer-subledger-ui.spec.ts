import { expect, test, type Page } from '@playwright/test'
import en from '../../i18n/locales/en.json' with { type: 'json' }
import ar from '../../i18n/locales/ar.json' with { type: 'json' }
import type { ArWorkspace } from '../../app/utils/customerSubledger'

const org = '40000000-0000-4000-8000-000000000001'
const actor = '40000000-0000-4000-8000-000000000002'
async function mockApi(page: Page) {
  const payload: ArWorkspace = {
    customers: [{ id: 'customer', name: 'Customer / العميل', archived: false }],
    accounts: [
      { id: 'control', name: 'AR Control', type: 'asset', subtype: 'accounts_receivable', role: 'control', subledger: 'customer' },
      { id: 'revenue', name: 'Service revenue', type: 'revenue', subtype: 'service_revenue', role: 'posting', subledger: null },
      { id: 'cash', name: 'Cash', type: 'asset', subtype: 'cash', role: 'posting', subledger: null },
    ],
    items: [{ invoice_id: 'invoice', customer_id: 'customer', customer_name: 'Customer / العميل', control_account_id: 'control', reference: 'INV-100', issue_date: '2026-01-01', due_date: '2026-01-31', original_minor: '10000', outstanding_minor: '6000', aging_bucket: '91_plus' }],
    statement: { opening_minor: '0', charges_minor: '10000', receipts_minor: '4000', adjustments_minor: '0', closing_minor: '6000', movements: [
      { id: 'invoice', kind: 'invoice', date: '2026-01-01', reference: 'INV-100', effect_minor: '10000', balance_minor: '10000', transaction_id: 'journal-invoice', reason: null, reverses_document_id: null, reversed: false },
      { id: 'receipt', kind: 'receipt', date: '2026-02-01', reference: 'RCPT-100', effect_minor: '-4000', balance_minor: '6000', transaction_id: 'journal-receipt', reason: null, reverses_document_id: null, reversed: false },
    ] },
    reconciliation: [{ control_account_id: 'control', account_name: 'AR Control', gl_balance_minor: '6000', subledger_balance_minor: '6000', variance_minor: '0', status: 'reconciled', explanation_reason: null }], legacy: [],
  }
  let failSave = true
  const requests: Record<string, unknown>[] = []
  const capabilities = ['ar.read', 'ar.issue', 'ar.receive', 'ar.credit', 'ar.adjust', 'ar.reverse', 'controls.reconcile', 'commitments.read']
  const user = { id: actor, aud: 'authenticated', role: 'authenticated', email: 'ar@test.local', email_confirmed_at: '2026-01-01', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  await page.route('http://127.0.0.1:60321/**', async route => {
    const path = new URL(route.request().url()).pathname
    let body: unknown = []
    if (path.includes('/auth/v1/token')) {
      const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      body = { access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: actor, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })}.fixture`, refresh_token: 'fixture', expires_in: 3600, token_type: 'bearer', user }
    }
    else if (path.endsWith('/auth/v1/user')) body = user
    else if (path.endsWith('/organization_members')) body = [{ role: 'owner', role_id: null, organizations: { id: org, name: 'AR workspace', slug: 'ar-test', base_currency: 'EGP', timezone: 'UTC', status: 'active' } }]
    else if (path.endsWith('/my_capabilities')) body = capabilities
    else if (path.endsWith('/subscription_access_state')) body = 'active'
    else if (path.endsWith('/subscriptions')) body = { status: 'active', cancel_at_period_end: false }
    else if (path.endsWith('/read_ar_workspace')) body = { ...payload, statement: route.request().postDataJSON().p_customer_id ? payload.statement : null }
    else if (path.endsWith('/post_ar_document')) {
      requests.push(route.request().postDataJSON())
      if (failSave) {
        failSave = false
        await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'AR_OVERPAYMENT: fixture changed', code: '23514' }) })
        return
      }
      body = 'posted-document'
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  return requests
}
for (const locale of ['en', 'ar'] as const) {
  test(`${locale}: reports, allocations, recoverable save and exact retry`, async ({ page, context }) => {
    test.setTimeout(90_000)
    const copy = locale === 'en' ? en : ar
    await context.addCookies([{ name: 'building-suit-locale', value: locale, domain: '127.0.0.1', path: '/' }])
    const requests = await mockApi(page)
    await page.goto('/login')
    await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
    await page.getByLabel(copy.auth.email).fill('ar@test.local')
    await page.getByLabel(copy.auth.password).fill('fixture-password')
    await page.getByRole('button', { name: copy.auth.signIn, exact: true }).click()
    await expect(page).toHaveURL('/dashboard')
    await page.goto('/receivables')
    await expect(page.getByRole('heading', { name: copy.ar.title, exact: true })).toBeVisible()
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
    await expect(page.getByRole('table', { name: copy.ar.openItems })).toContainText('INV-100')
    await page.locator('#ar-customer-filter').selectOption('customer')
    await expect(page.getByRole('table', { name: copy.ar.statement })).toContainText('RCPT-100')
    await expect(page.getByRole('table', { name: copy.controls.reconciliation })).toContainText(copy.controls.statuses.reconciled)
    await page.getByRole('button', { name: copy.ar.actions.receipt, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await dialog.locator('#ar-offset').selectOption('cash')
    await dialog.locator('#ar-reference').fill('UI-RECEIPT')
    await dialog.locator('#ar-amount').fill('20.00')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText(copy.ar.errors.allocation)
    expect(requests).toHaveLength(0)
    await dialog.locator('#ar-allocation-invoice').fill('20.00')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(dialog.getByRole('alert')).toHaveText(copy.ar.errors.overpayment)
    await expect(dialog.locator('#ar-amount')).toHaveValue('20.00')
    await dialog.getByRole('button', { name: copy.common.save, exact: true }).click()
    await expect(dialog).toBeHidden()
    expect(requests).toHaveLength(2)
    expect(requests[0]).toEqual(requests[1])
    expect(requests[0]!.p_amount_minor).toBe('2000')
    expect(requests[0]!.p_allocations).toEqual([{ invoice_id: 'invoice', amount_minor: '2000' }])
    await page.reload()
    await expect(page.getByRole('heading', { name: copy.ar.title, exact: true })).toBeVisible()
    // A full reload must hydrate the shell without covering the page actions.
    await page.getByRole('button', { name: copy.ar.actions.receipt, exact: true }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: copy.common.cancel, exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.getByRole('button', { name: copy.ar.actions.invoice, exact: true })).toBeVisible()
  })
}

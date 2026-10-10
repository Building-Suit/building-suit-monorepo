import { expect, type Page } from '@playwright/test'

const organizationId = '00000000-0000-4000-8000-000000000010'
const account = (index: number) => ({ organization_id: organizationId, account_id: `account-${index}`, code: String(100 + index),
  name: index === 0 ? 'Operating cash group' : `Branch cash ${String(index).padStart(2, '0')}`, type: 'asset', subtype: 'cash', currency: 'EGP',
  account_role: index === 0 ? 'group' : 'posting', parent_account_id: index === 0 ? null : 'account-0',
  control_subledger_type: null, control_binding_locked: false, normal_balance: 'debit', contra_account_id: null,
  is_system: false, classification_locked: false, net_debit_minor: '1000', statement_balance_minor: '1000',
  entry_count: 1, is_archived: false, is_liquid: true })

/** Only browser-intercepted local responses. No backend or financial write is executed. */
export async function ledgerFoundationFixture(page: Page, catalog: unknown[]) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const user = { id: '00000000-0000-4000-8000-000000000001', email: 'foundation@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} }
  const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.mock`
  let notificationRead = false
  await page.route('http://127.0.0.1:60321/**', async route => {
    const url = new URL(route.request().url())
    if (url.pathname.includes('/auth/v1/')) {
      await route.fulfill({ json: url.pathname.endsWith('/token') ? { access_token: token, token_type: 'bearer', expires_in: 3600, refresh_token: 'mock', user } : user })
      return
    }
    const name = url.pathname.split('/').at(-1)!
    const args = route.request().postDataJSON() ?? {}
    calls.push({ name, args })
    let data: unknown = []
    switch (name) {
      case 'organization_members': data = [{ role: 'owner', role_id: null, organizations: { id: organizationId, name: 'Foundation ledger', legal_name: 'Foundation Ltd', slug: 'foundation', base_currency: 'EGP', timezone: 'Africa/Cairo', status: 'active' } }]; break
      case 'subscription_plan_catalog': data = catalog; break
      case 'profiles': data = { full_name: 'Foundation owner' }; break
      // Account activity requires report access as well as account/transaction access.
      case 'my_capabilities': data = ['accounts.read', 'accounts.create', 'accounts.update', 'reports.read', 'transactions.read', 'transactions.create', 'billing.read', 'billing.manage']; break
      case 'subscription_access_state': data = 'active'; break
      case 'subscriptions': data = { status: 'active', billing_interval: 'monthly', current_period_end: '2099-01-01', cancel_at_period_end: false }; break
      case 'subscription_usage_summary': data = [{ plan_key: 'starter', subscription_status: 'active', writes_allowed: true, quota_key: 'max_accounts', used_value: 26, limit_value: 100, remaining_value: 74, is_unlimited: false, is_at_limit: false, is_over_limit: false }]; break
      case 'notifications': data = [{ id: 'notice-1', title: 'Foundation notification', body: 'Synthetic workspace notice', read_at: notificationRead ? '2026-10-01' : null }]; break
      case 'mark_notification_read': notificationRead = true; data = null; break
      case 'read_account_balances': data = Array.from({ length: 27 }, (_, index) => account(index)); break
      case 'read_account_activity': data = { account: { id: args.p_account_id, name: 'Branch cash 01', code: '101', type: 'asset', normal_balance: 'debit', is_archived: false }, currency: 'EGP', from_date: '2026-10-01', to_date: '2026-10-31', opening_minor: '0', debit_minor: '1000', credit_minor: '0', closing_minor: '1000', total: 0, rows: [] }; break
      case 'search_transactions': data = [{ id: 'transaction-1', organization_id: organizationId, description: 'Foundation receipt', transaction_date: '2026-10-01', type: 'income', status: 'posted', amount_minor: 1000, currency_code: 'EGP', total_count: 1 }]; break
      case 'dashboard_summary': data = { base_currency: 'EGP', total_assets_minor: 1000, total_liabilities_minor: 0, net_worth_minor: 1000, cash_and_bank_minor: 1000, accounts_receivable_minor: 0, accounts_payable_minor: 0, revenue_this_month_minor: 1000, expenses_this_month_minor: 0, net_profit_this_month_minor: 1000, revenue_previous_month_minor: 0, expenses_previous_month_minor: 0, net_profit_previous_month_minor: 0 }; break
      case 'plan_has_feature': data = false; break
      case 'currencies': data = [{ code: 'EGP', name: 'Egyptian pound' }]; break
    }
    await route.fulfill({ json: data })
  })
  await page.goto('/login')
  await expect(page.locator('form')).toHaveAttribute('data-hydrated', 'true')
  await page.getByLabel(/^Email\s*\*?$/).fill(user.email)
  await page.getByLabel(/^Password\s*\*?$/).fill('synthetic-password')
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('main')).toContainText('Foundation receipt')
  return { calls }
}

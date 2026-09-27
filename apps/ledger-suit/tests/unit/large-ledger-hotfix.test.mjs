import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const accounts = await readFile(new URL('../../app/pages/accounts.vue', import.meta.url), 'utf8')
const reports = await readFile(new URL('../../app/pages/reports.vue', import.meta.url), 'utf8')
const migration = await readFile(new URL('../../supabase/migrations/20260928010000_accounts_reports_large_ledger_hotfix.sql', import.meta.url), 'utf8')

test('Accounts uses the bounded exact RPC instead of the generic balance view', () => {
  assert.match(accounts, /\.rpc\('read_account_balances'/)
  assert.doesNotMatch(accounts, /\.from\('account_balances'/)
  assert.match(migration, /perform app\.require_capability\(p_organization_id, 'accounts\.read'\)/)
  assert.match(migration, /where entry\.organization_id = p_organization_id/)
})

test('Reports only request the active surface and Overview uses one aggregate RPC', () => {
  assert.match(reports, /tab\.value !== 'profit-loss'.*return \[\]/s)
  assert.match(reports, /tab\.value !== 'balance-sheet'.*return \{ scope, rows: \[\]/s)
  assert.match(reports, /tab\.value !== 'cash-flow'.*return null/s)
  assert.match(reports, /tab\.value !== 'ledger'.*return \[\]/s)
  assert.match(reports, /tab\.value !== 'overview'.*payload: null/s)
  assert.equal(reports.match(/\.rpc\('report_financial_overview'/g)?.length, 1)
  assert.doesNotMatch(reports, /\.rpc\('report_statement_reconciliation'/)
  assert.doesNotMatch(reports, /\.rpc\('check_balance_sheet_integrity'/)
})

test('failures retain explicit retry states instead of rendering empty financial data', () => {
  for (const error of ['overviewError', 'profitLossError', 'balanceSheetError', 'cashFlowError', 'ledgerError']) {
    assert.match(reports, new RegExp(`v-if="[^"]*${error}`))
  }
  assert.match(reports, /refreshOverview/)
  assert.match(reports, /refreshProfitLoss/)
  assert.match(reports, /refreshBalanceSheet/)
  assert.match(reports, /refreshCashFlowSurface/)
  assert.match(reports, /refreshLedger/)
})

test('trusted reads retain explicit authorization and do not weaken database limits', () => {
  assert.match(migration, /create function public\.report_financial_overview[\s\S]*security definer/)
  assert.match(migration, /perform app\.require_capability\(p_organization_id, 'reports\.read'\)/)
  assert.doesNotMatch(migration, /set\s+statement_timeout/i)
  assert.doesNotMatch(migration, /disable\s+row\s+level\s+security/i)
  assert.doesNotMatch(migration, /materialized\s+view/i)
})

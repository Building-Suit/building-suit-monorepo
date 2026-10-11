import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929090000_owner_operating_reports.sql', import.meta.url), 'utf8')
const fullMigration = await readFile(new URL('../../supabase/migrations/20260929170000_full_operational_reporting.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_operating_reports.sql', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../../app/pages/dashboard.vue', import.meta.url), 'utf8')
const reports = await readFile(new URL('../../app/pages/reports/index.vue', import.meta.url), 'utf8')
const sales = await readFile(new URL('../../app/pages/sales/index.vue', import.meta.url), 'utf8')

test('operating report is server-side, permission and location scoped, and excludes corrected sales', () => {
  for (const evidence of [
    "assert_team_permission(p_shop_id, 'reports.view')", "has_permission(p_shop_id, 'reports.cost_profit.view')", 'user_can_access_location',
    'sale_corrections', 'allocation_remaining', 'cash_sessions', 'pos_sale_contexts',
    "at time zone 'Africa/Cairo'", 'security definer', "set search_path = ''",
  ]) assert.match(migration, new RegExp(evidence.replace(/[()]/g, '\\$&')))
})

test('dashboard supports three periods, all locations, source drill-through, and operational-only wording', () => {
  for (const evidence of [
    'shop_operating_report', 'allLocations', "'day', 'week', 'month'", 'salesMix',
    'paymentMix', 'outstanding', 'busiestTimes', 'cashVariance', 'staffPerformance',
    'branchComparison', 'BsDataTable', ':columns="2"', ':columns="4"',
    'not accounting profit or a financial statement', 'مش حساب للربح المحاسبي',
  ]) assert.match(dashboard, new RegExp(evidence))
  assert.match(sales, /route\.query\.from/)
})

test('known SQL fixtures reconcile every metric and deny an ordinary barber', () => {
  for (const evidence of [
    "'sales')::numeric <> 150", "'{expenses,operatingBalance}'", "'{outstanding,amount}'",
    "'{appointments,busiestTimes,0,count}'", "'{cash,variance}'", "'salesMix'",
    "'paymentMix'", 'branch report was not isolated', 'ordinary barber viewed owner operating metrics',
    'invalid report period accepted',
  ]) assert.ok(databaseTest.includes(evidence), `missing SQL evidence: ${evidence}`)
})

test('full reports are server-paginated, location scoped, and reconcile every required family', () => {
  for (const evidence of [
    "'sales', 'collections', 'receivables', 'suppliers', 'expenses', 'inventory', 'margin', 'activity'",
    "assert_team_permission(p_shop_id, 'reports.view')", "has_permission(p_shop_id, 'reports.cost_profit.view')",
    'assert_location_access', 'user_can_access_location', "at time zone 'Africa/Cairo'",
    'offset (p_page - 1) * p_page_size limit p_page_size', 'purchase_payable',
    'allocation_remaining', 'remaining_quantity * batch.unit_cost', 'movement.invoice_item_id',
    "movement.movement_type = 'out'", 'cost_defined', 'excludedLineCount',
    'not formal financial statements', 'security definer', "set search_path = ''",
  ]) assert.ok(fullMigration.includes(evidence), `missing full report evidence: ${evidence}`)
})

test('report screen uses the authoritative RPC for screen and escaped CSV export', () => {
  for (const evidence of [
    'shop_operational_report', 'queryArgs(page.value)', 'queryArgs(1, 500)', '{ ...args, p_page: exportPage }',
    'encodeCsv(headers, rows)', 'downloadCsv', 'source_path', 'BsDataTable',
    'All locations', 'كل الفروع', 'not a P&L', 'مش قائمة دخل',
  ]) assert.ok(reports.includes(evidence), `missing report screen evidence: ${evidence}`)
})

test('known fixtures reconcile sales, collections, payables, expenses, stock, FIFO margin, pagination and export parity', () => {
  for (const evidence of [
    "'{summary,sales}'", "'{summary,collected}'", "'{summary,payable}'",
    "'{summary,expenses}'", "'{summary,inventoryValue}'", "'{summary,fifoCost}'",
    "jsonb_array_length(v_full -> 'items') <> 2", "v_full -> 'summary' <> v_export -> 'summary'",
    'full branch report leaked another location', 'invalid full report page size accepted',
    'ordinary barber viewed full operational reports',
  ]) assert.ok(databaseTest.includes(evidence), `missing full fixture evidence: ${evidence}`)
})

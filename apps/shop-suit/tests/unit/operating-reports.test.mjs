import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929090000_owner_operating_reports.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_operating_reports.sql', import.meta.url), 'utf8')
const dashboard = await readFile(new URL('../../app/pages/dashboard.vue', import.meta.url), 'utf8')
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
    'branchComparison', 'BsDataTable', 'sm:grid-cols-2', 'xl:grid-cols-4',
    'not accounting profit or a financial statement', 'ليس ربحًا محاسبيًا',
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

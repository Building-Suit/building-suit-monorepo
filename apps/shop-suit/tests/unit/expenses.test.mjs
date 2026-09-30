import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929150000_expense_history_delegation.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_crm_expense_ledger.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/expenses/index.vue', import.meta.url), 'utf8')
const rpc = await readFile(new URL('../../app/types/shopCrmRpc.ts', import.meta.url), 'utf8')

test('expense mutations preserve original rows and append trace evidence', () => {
  assert.match(migration, /create table public\.expense_events/)
  assert.match(migration, /trg_expense_events_immutable/)
  assert.match(migration, /trg_expenses_preserve_history/)
  assert.match(migration, /corrects_expense_id/)
  assert.match(migration, /replaced_by_expense_id/)
  assert.match(migration, /EXPENSE_REQUEST_CONFLICT/)
  assert.doesNotMatch(migration, /delete from public\.expenses/)
})

test('expense query is permission and location checked with bounded server pages', () => {
  assert.match(migration, /create function shop_private\.list_expenses/)
  assert.match(migration, /has_permission\(p_shop_id, 'expenses\.view'\)/)
  assert.match(migration, /assert_location_access\(p_shop_id, p_location_id, false\)/)
  assert.match(migration, /p_page_size > 100/)
  assert.match(migration, /offset \(p_page - 1\) \* p_page_size limit p_page_size/)
  assert.match(rpc, /list_expenses:/)
})

test('expense SQL coverage exercises delegation, pagination, retries, closure, and history', () => {
  for (const evidence of [
    'server expense pagination/filtering failed',
    'delegated expense permission failed',
    'expense replay changed history',
    'correction history is incomplete',
    'closed-period correction accepted',
    'void replay duplicated history',
    'void overwrote correction evidence',
    'second void request accepted',
    'expense event mutation accepted',
    'expense history deletion accepted',
    'expired-subscription expense accepted',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('expense UI uses the server contract and exposes bilingual traceable correction', () => {
  assert.match(page, /rpc\.rpc\('list_expenses'/)
  assert.match(page, /lazy paginator/)
  assert.match(page, /p_correction_reason/)
  assert.match(page, /p_reason: reason/)
  assert.match(page, /سبب التصحيح/)
  assert.match(page, /Correction reason/)
  assert.match(page, /Record money the shop spends here, such as rent, supplies, and utilities/)
  assert.match(page, /Sales income is recorded automatically from Sales or POS/)
  assert.match(page, /سجّل هنا الأموال التي ينفقها المتجر/)
  assert.match(page, /expensePage\.value\.canManage/)
  assert.doesNotMatch(page, /shop-data:expense-permissions/)
  assert.doesNotMatch(page, /isOwner/)
  assert.doesNotMatch(page, /\.limit\(100\)/)
})

test('expense UI keeps operational failures distinct and extracts structured RPC errors', () => {
  for (const code of [
    'SHOP_PERMISSION_DENIED',
    'SHOP_SUBSCRIPTION_INACTIVE',
    'LOCATION_ACCESS_DENIED',
    'ACCOUNTING_PERIOD_CLOSED',
    'INVALID_EXPENSE',
    'INVALID_EXPENSE_QUERY',
    'EXPENSE_REQUEST_CONFLICT',
    'EXPENSE_NOT_FOUND',
  ]) assert.match(page, new RegExp(code))
  assert.match(page, /typeof value === 'object' && value && 'message' in value/)
  assert.match(page, /Ask the owner to add it to your role/)
  assert.match(page, /review Subscription and billing/)
  assert.match(page, /Choose a location assigned to you/)
  assert.doesNotMatch(page, /permission, or the subscription/)
})

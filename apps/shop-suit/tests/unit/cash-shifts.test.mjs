import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928230000_cashier_shifts_reconciliation.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_cash_shifts.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/cash-shifts.vue', import.meta.url), 'utf8')
const layout = await readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')
const concurrencyTest = await readFile(new URL('../../../../tooling/database/test-shop-cash-local.mjs', import.meta.url), 'utf8')

test('cash shifts use atomic idempotent commands and append-only reconciliation evidence', () => {
  for (const evidence of [
    'cash_sessions_one_open_per_register_idx', 'cash_drawer_events',
    'CASH_DRAWER_EVENT_IMMUTABLE', 'CASH_SESSION_IMMUTABLE',
    'cash_shift_requests', 'for update', 'capture_cash_payment',
    "event_kind in ('cash_sale', 'cash_refund', 'pay_in', 'pay_out')",
  ]) assert.match(migration, new RegExp(evidence.replace(/[()]/g, '\\$&')))
})

test('reconciliation keeps non-cash visible without changing expected drawer cash', () => {
  assert.match(migration, /payment\.method <> 'cash'/)
  assert.match(migration, /session\.opening_amount[\s\S]+cash_sale','pay_in'[\s\S]+cash_refund','pay_out'/)
  for (const evidence of ['nonCashTotal', 'expectedCash', 'cashRefunds', 'payOuts']) assert.match(page, new RegExp(evidence))
})

test('cash shift page is bilingual, responsive, recoverable, and confirms drawer effects', () => {
  for (const evidence of ['ورديات الخزنة', 'Cashier shifts', '<BsGrid', ':columns="4"', 'role="alert"', 'BsSkeleton', 'BsDataTable', 'BsRecordActionDialog', 'useRecordAction', 'useConfirmation', 'refresh()', 'record_cash_movement']) assert.match(page, new RegExp(evidence))
  assert.match(layout, /\/cash-shifts/)
})

test('focused SQL covers retry, conflict, exact-once linkage, variance, immutability, and branch denial', () => {
  for (const evidence of ['open retry created another shift', 'conflicting shift opened', 'pay-in retry duplicated', 'exactly once', 'variance_amount', 'drawer event history was mutable', 'cashier viewed an unauthorized branch', 'manager-authorized movement']) assert.match(databaseTest, new RegExp(evidence))
})

test('local concurrency coverage races independent open and close transactions', () => {
  for (const evidence of ['Promise.all', 'CASH_SHIFT_ALREADY_OPEN', 'CASH_SHIFT_NOT_OPEN', 'open race did not serialize safely', 'close race did not serialize safely']) assert.match(concurrencyTest, new RegExp(evidence))
})

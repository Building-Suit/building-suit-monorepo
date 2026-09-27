import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928150000_migration_open_items.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/74_migration_open_items_test.sql', import.meta.url), 'utf8')

test('open-item migration keeps the Opening Trial Balance as the only GL effect', () => {
  assert.match(migration, /control_boundary','opening_trial_balance'/)
  assert.match(migration, /v_opening\.posted_transaction_id/)
  assert.doesNotMatch(migration, /app\.create_and_post\([^\n]*migration_open/i)
  assert.match(databaseTest, /acceptance creates no duplicate GL transaction or entry/)
  assert.match(databaseTest, /never recognize historical P&L/)
})

test('customer and supplier opening evidence is immutable and reconciled', () => {
  for (const table of [
    'migration_open_items',
    'migration_open_allocations',
    'migration_open_validation_runs',
    'migration_counterparty_acceptances',
    'migration_open_acceptances',
  ]) {
    assert.match(migration, new RegExp(`create trigger ${table}_immutable before update or delete`))
  }
  assert.match(migration, /MIGRATION_AR_CONTROL_VARIANCE/)
  assert.match(migration, /MIGRATION_AP_CONTROL_VARIANCE/)
  assert.match(migration, /MIGRATION_ALLOCATION_RECONCILIATION_FAILED/)
  assert.match(migration, /MIGRATION_CURRENCY_POLICY_VIOLATION|MIGRATION_OPEN_ITEM_POLICY_VIOLATION/)
})

test('accepted invoices and bills remain allocatable through existing subledger commands', () => {
  assert.match(migration, /insert into public\.ar_documents/)
  assert.match(migration, /insert into public\.ap_documents/)
  assert.match(migration, /migration_open_item_id/)
  assert.match(databaseTest, /ordinary receipt reduces a migrated invoice/)
  assert.match(databaseTest, /ordinary payment reduces a migrated bill/)
  assert.match(databaseTest, /existing AR correction flow remains traceable/)
  assert.match(databaseTest, /existing AP correction flow remains traceable/)
  assert.match(databaseTest, /cross-tenant open-item reader is denied/)
})

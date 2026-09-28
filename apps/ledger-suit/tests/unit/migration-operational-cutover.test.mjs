import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928180000_migration_operational_cutover.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/75_migration_operational_cutover_test.sql', import.meta.url), 'utf8')

test('operational cutover detail reconciles every applicable module to its designated GL account', () => {
  for (const code of [
    'MIGRATION_ASSET_GL_VARIANCE',
    'MIGRATION_BANK_GL_VARIANCE',
    'MIGRATION_INVENTORY_GL_VARIANCE',
    'MIGRATION_TAX_GL_VARIANCE',
    'MIGRATION_OPEN_ITEMS_NOT_ACCEPTED',
  ]) assert.match(migration, new RegExp(code))
  assert.match(migration, /'control_boundary','opening_trial_balance'/)
  assert.match(migration, /'gl_effect','none'/)
  assert.match(databaseTest, /every applicable operational register reconciles to its designated GL balance/)
})

test('asset, bank, inventory, and VAT evidence preserve approved source semantics', () => {
  assert.match(migration, /net_book_value_minor=cost_minor-accumulated_depreciation_minor/)
  assert.match(migration, /statement_balance_minor\+coalesce\(sum\(item\.signed_bank_effect_minor\)/)
  assert.match(migration, /source_system='inventory-suit'/)
  assert.match(migration, /schema_version=1/)
  assert.match(migration, /evidence_scope='approved_egypt_vat'/)
  assert.match(migration, /evidence_type in \('return_summary','ledger_opening_schedule'\)/)
  assert.doesNotMatch(migration, /insert into public\.(?:transactions|transaction_entries|vat_documents)/)
})

test('approved operational evidence is immutable and acceptance cannot duplicate the ledger', () => {
  for (const table of [
    'migration_asset_openings',
    'migration_bank_positions',
    'migration_bank_outstanding_items',
    'migration_inventory_openings',
    'migration_tax_openings',
    'migration_operational_validation_runs',
  ]) assert.match(migration, new RegExp(`create trigger ${table}_immutable before update or delete`))
  assert.match(migration, /MIGRATION_DUPLICATE_GL_EFFECT/)
  assert.match(migration, /guard_operational_opening_reversal/)
  assert.match(databaseTest, /acceptance preserves the cross-module GL digest/)
  assert.match(databaseTest, /accepted source evidence cannot be edited/)
  assert.match(databaseTest, /cross-tenant operational reader is denied/)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928120000_migration_project_foundation.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/73_migration_project_foundation_test.sql', import.meta.url), 'utf8')

test('migration foundation supports generic cutover sources and defaults to Fast Cutover', () => {
  assert.match(migration, /'excel_csv', 'other_system_export', 'accountant_paper_workbook'/)
  assert.match(migration, /migration_depth public\.migration_depth not null default 'fast_cutover'/)
  assert.match(migration, /cutover_date date not null/)
  assert.match(migration, /revision integer not null default 1/)
})

test('source, mapping, and normalized evidence are append-only and tenant-authorized', () => {
  for (const table of [
    'migration_source_revisions',
    'migration_original_rows',
    'migration_mapping_revisions',
    'migration_mapping_entries',
    'migration_staging_batches',
    'migration_normalized_rows',
    'migration_validation_runs',
  ]) {
    assert.match(migration, new RegExp(`create trigger ${table}_immutable before update or delete`))
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`))
  }
  assert.match(migration, /perform app\.require_capability\(v_project\.organization_id, 'migrations\.manage'\)/)
  assert.match(migration, /perform app\.require_capability\(v_project\.organization_id, 'migrations\.review'\)/)
  assert.match(migration, /content_sha256 text not null/)
  assert.match(migration, /source_identity jsonb not null/)
})

test('mapping is explicit and migration staging has no posting path', () => {
  assert.match(migration, /'existing_record', 'reviewed_creation'/)
  assert.match(migration, /MIGRATION_MAPPING_AMBIGUOUS/)
  assert.match(migration, /MIGRATION_ACCOUNT_TARGET_INELIGIBLE/)
  assert.doesNotMatch(migration, /app\.create_and_post/)
  assert.doesNotMatch(migration, /insert into public\.(?:transactions|transaction_entries)/)
  assert.match(migration, /references public\.opening_balance_batches/)
  assert.match(migration, /create or replace function public\.link_migration_opening_balance_batch/)
})

test('database acceptance fixture covers both source journeys and unchanged ledger counts', () => {
  assert.match(databaseTest, /another-system CSV reaches validated staging/)
  assert.match(databaseTest, /accountant-prepared workbook reaches validated staging through reviewed creation/)
  assert.match(databaseTest, /create no transactions or entries/)
  assert.match(databaseTest, /another tenant cannot read migration projects/)
})

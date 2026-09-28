import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

// Fixed local container: this runner cannot take a hosted connection/ref.
const psqlArgs = (role) => ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', role, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const args = psqlArgs('postgres')
// Only fixture repair needs to disable triggers. Supabase's postgres role is
// not a superuser; keep application suites on it and use the local admin here.
const cleanupArgs = psqlArgs('supabase_admin')
const fixtureCleanup = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_orphan_fixture_cleanup.sql', import.meta.url), 'utf8')
const cleanup = spawnSync('docker', cleanupArgs, {
  input: `BEGIN;\n${fixtureCleanup}\nSELECT pg_temp.cleanup_shop_orphan_fixtures();\nCOMMIT;`, encoding: 'utf8',
})
if (cleanup.status !== 0) {
  console.error(`shop_orphan_fixture_cleanup: failed\n${cleanup.stderr || cleanup.error}`)
  process.exit(1)
}

const migration = spawnSync('pnpm', ['db', 'shop-suit', 'migration', 'up', '--local'], { stdio: 'inherit' })
if (migration.status !== 0) process.exit(migration.status ?? 1)

const suites = ['shop_crm_owner_bootstrap', 'shop_crm_product_catalog', 'shop_crm_inventory_adjustments', 'shop_crm_service_catalog', 'shop_crm_expense_ledger', 'shop_crm_supplier_purchases', 'shop_business_mode', 'shop_public_privileges', 'shop_safe_supported_commands', 'shop_stock_counts_corrections', 'shop_locations', 'shop_platform_admin', 'shop_billing', 'shop_team_management', 'shop_orphan_fixture_cleanup_test']
for (const suite of suites) {
  const sql = await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
  const isCleanupSuite = suite === 'shop_orphan_fixture_cleanup_test'
  const setup = isCleanupSuite ? fixtureCleanup : ''
  const result = spawnSync('docker', isCleanupSuite ? cleanupArgs : args, { input: `BEGIN;\n${setup}\n${sql.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) { console.error(`${suite}: failed\n${result.stderr || result.error}`); process.exit(1) }
  console.log(`${suite}: passed; fixtures rolled back`)
}

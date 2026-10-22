import { readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'

// Fixed local container: this runner cannot take a hosted connection/ref.
const psqlArgs = (role) => ['exec', '-i', 'supabase_db_building-suit-shop', 'psql', '-U', role, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1']
const args = psqlArgs('postgres')
// Only fixture repair needs to disable triggers. Supabase's postgres role is
// not a superuser; keep application suites on it and use the local admin here.
const cleanupArgs = psqlArgs('supabase_admin')
const fixtureCleanup = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_orphan_fixture_cleanup.sql', import.meta.url), 'utf8')
const legacyBillingFixture = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_legacy_billing_fixture.sql', import.meta.url), 'utf8')
const cleanup = spawnSync('docker', cleanupArgs, {
  input: `BEGIN;\n${fixtureCleanup}\nSELECT pg_temp.cleanup_shop_orphan_fixtures();\nCOMMIT;`, encoding: 'utf8',
})
if (cleanup.status !== 0) {
  console.error(`shop_orphan_fixture_cleanup: failed\n${cleanup.stderr || cleanup.error}`)
  process.exit(1)
}

const migration = spawnSync('pnpm', ['db', 'shop-suit', 'migration', 'up', '--local'], { stdio: 'inherit' })
if (migration.status !== 0) process.exit(migration.status ?? 1)

const suites = ['shop_crm_owner_bootstrap', 'shop_crm_product_catalog', 'shop_measurement_foundation', 'shop_crm_inventory_adjustments', 'shop_crm_service_catalog', 'shop_crm_expense_ledger', 'shop_crm_supplier_purchases', 'shop_business_mode', 'shop_trial_onboarding', 'shop_public_privileges', 'shop_safe_supported_commands', 'shop_stock_counts_corrections', 'shop_locations', 'shop_profile_settings', 'shop_document_settings', 'shop_business_currency', 'shop_platform_admin', 'shop_billing', 'shop_plan_catalog', 'shop_plan_catalog_v2', 'shop_plan_limits', 'shop_plan_admin', 'shop_subscription_lifecycle', 'shop_team_management', 'shop_barber_service_scheduling', 'shop_appointments', 'shop_pos_checkout', 'shop_cash_shifts', 'shop_sale_corrections', 'shop_catalog_import', 'shop_catalog_media', 'shop_catalog_image_upload', 'shop_support_submission', 'shop_orphan_fixture_cleanup_test']
// Trial activation must prove target guards, history preservation and no false payment evidence.
suites.push('shop_trial_admin_activation', 'shop_xpay_payments', 'shop_proration_quotes', 'shop_proration_settlement', 'shop_proration_checkout_details', 'shop_proration_journeys', 'shop_proration_checkout_windows', 'shop_proration_staging_activation', 'shop_scheduled_billing_policy')
const activationMigration = await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261014063640_staging_proration_activation.sql', import.meta.url), 'utf8')
const historicalOrder = (await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261014051811_checkout_recovery_proration_integration.sql', import.meta.url), 'utf8'))
  .replace('create or replace function public.shop_xpay_order_create(', 'create function pg_temp.historical_order_create(')
const priorQuoteMigration = await readFile(new URL('../../apps/shop-suit/supabase/migrations/20261013190345_proration_checkout_windows.sql', import.meta.url), 'utf8')
const historicalQuote = priorQuoteMigration.slice(priorQuoteMigration.indexOf('create or replace function public.shop_xpay_proration_quote('), priorQuoteMigration.indexOf('create or replace function public.shop_xpay_proration_order('))
  .replace('create or replace function public.shop_xpay_proration_quote(', 'create function pg_temp.historical_quote_create(')
  .replace('on conflict(subscription_id) do nothing', 'on conflict(subscription_id,currency) do nothing')
const journeys = await readFile(new URL('../../apps/shop-suit/supabase/tests/shop_proration_journeys.sql', import.meta.url), 'utf8')
const journeySetup = journeys.slice(0, journeys.indexOf('\nDO $$'))
const privateSetup = journeys.slice(journeys.indexOf('-- Issue secure terms'), journeys.indexOf('DO $$declare f journey_bridge;'))
for (const suite of suites) {
  let sql = (await readFile(new URL(`../../apps/shop-suit/supabase/tests/${suite}.sql`, import.meta.url), 'utf8')).replaceAll('-- APPLY_REVIEWED_ACTIVATION_MIGRATION', activationMigration)
  const isHistoricalQuote = ['shop_proration_settlement', 'shop_proration_journeys'].includes(suite)
  if (isHistoricalQuote) sql = sql.replaceAll('public.shop_xpay_proration_quote(', 'pg_temp.historical_quote_create(')
  const isCleanupSuite = suite === 'shop_orphan_fixture_cleanup_test'
  const setup = (isHistoricalQuote ? historicalQuote : '') + (suite === 'shop_scheduled_billing_policy' ? historicalOrder + journeySetup + privateSetup : ['shop_xpay_payments', 'shop_proration_journeys'].includes(suite) ? historicalOrder : isCleanupSuite ? fixtureCleanup : ['shop_billing', 'shop_plan_catalog_v2', 'shop_subscription_lifecycle'].includes(suite) ? legacyBillingFixture : '')
  const result = spawnSync('docker', isCleanupSuite ? cleanupArgs : args, { input: `BEGIN;\n${setup}\n${sql.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`, encoding: 'utf8' })
  if (result.status !== 0) { console.error(`${suite}: failed\n${result.stderr || result.error}`); process.exit(1) }
  console.log(`${suite}: passed; fixtures rolled back`)
}

const correctionConcurrency = spawnSync('node', [
  new URL('./test-shop-sale-correction-local.mjs', import.meta.url).pathname,
  '--concurrency-only',
], { stdio: 'inherit' })
if (correctionConcurrency.status !== 0) process.exit(correctionConcurrency.status ?? 1)

const planLimitConcurrency = spawnSync('node', [
  new URL('./test-shop-plan-limits-local.mjs', import.meta.url).pathname,
], { stdio: 'inherit' })
if (planLimitConcurrency.status !== 0) process.exit(planLimitConcurrency.status ?? 1)

const planBillingConcurrency = spawnSync('node', [
  new URL('./test-shop-plan-billing-local.mjs', import.meta.url).pathname,
], { stdio: 'inherit' })
if (planBillingConcurrency.status !== 0) process.exit(planBillingConcurrency.status ?? 1)

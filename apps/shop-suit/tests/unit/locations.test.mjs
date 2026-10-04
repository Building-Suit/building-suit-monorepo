import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928120000_first_class_locations.sql', import.meta.url), 'utf8')
const lifecycleMigration = await readFile(new URL('../../supabase/migrations/20260930160000_complete_location_lifecycle.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_locations.sql', import.meta.url), 'utf8')
const shopContext = await readFile(new URL('../../app/composables/useShop.ts', import.meta.url), 'utf8')
const shell = await readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')
const sales = await readFile(new URL('../../app/pages/sales/index.vue', import.meta.url), 'utf8')
const settings = await readFile(new URL('../../app/pages/settings.vue', import.meta.url), 'utf8')

test('location migration keeps tenant/location identity explicit and historical', () => {
  assert.match(migration, /create table public\.shop_locations/)
  assert.match(migration, /shop_locations_one_default_idx/)
  assert.match(migration, /membership_location_assignments/)
  assert.match(migration, /references public\.shop_locations \(id, shop_id\) on delete restrict/)
  assert.match(migration, /OPERATIONAL_LOCATION_IMMUTABLE/)
  assert.match(migration, /create table public\.appointments/)
  assert.match(migration, /create table public\.cash_sessions/)
  assert.match(migration, /location_operational_report/)
  assert.doesNotMatch(migration, /delete from public\.(invoices|payments|appointments)/)
})

test('location lifecycle supports atomic onboarding and bounded restore', () => {
  assert.match(lifecycleMigration, /shop_locations_default_must_be_active/)
  assert.match(lifecycleMigration, /create function public\.create_owner_shop\([\s\S]*p_main_location_name text/)
  assert.match(lifecycleMigration, /create function public\.restore_shop_location/)
  assert.match(lifecycleMigration, /lock_plan_resource\(p_shop_id, 'active_locations'\)/)
  assert.match(lifecycleMigration, /location\.id = p_location_id and location\.shop_id = p_shop_id/)
  assert.match(settings, /rpc\('shop_plan_usage'/)
  assert.match(settings, /locationCapacityFull/)
  assert.match(settings, /rpc\('restore_shop_location'/)
  assert.match(settings, /p_location_id: editingLocationId/)
})

test('location database regression covers required authorization boundaries', () => {
  for (const evidence of [
    'owner cannot view both locations',
    'staff location restriction failed',
    'suspended membership retained location access',
    'cross-shop location isolation failed',
    'location archival hid or changed historical operations',
    'existing shop/operation compatibility backfill incomplete',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('location switching clears shop data before changing context', () => {
  const switchBody = shopContext.match(/async function selectLocation[\s\S]*?\n {2}}/)?.[0] ?? ''
  assert.match(switchBody, /clearShopScopedData\(\)[\s\S]*currentLocationId\.value = locationId/)
  assert.match(switchBody, /selectedLocationCookie\.value = locationId/)
  assert.match(switchBody, /refreshNuxtData\(\)/)
  assert.match(shell, /activeLocations/)
  assert.match(shell, /selectLocation/)
  assert.match(sales, /list_location_sales/)
  assert.match(sales, /save_location_sale_draft/)
})

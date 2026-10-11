import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929190000_canonical_plan_catalog.sql', import.meta.url), 'utf8')
const trialMigration = await readFile(new URL('../../supabase/migrations/20260930180000_seven_day_shop_trials.sql', import.meta.url), 'utf8')
const catalogV2Migration = await readFile(new URL('../../supabase/migrations/20260930210000_commercial_plan_catalog_v2.sql', import.meta.url), 'utf8')
const limitsMigration = await readFile(new URL('../../supabase/migrations/20260929200000_atomic_plan_resource_limits.sql', import.meta.url), 'utf8')
const adminMigration = await readFile(new URL('../../supabase/migrations/20260929220000_platform_plan_catalog_subscription_controls.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_plan_catalog.sql', import.meta.url), 'utf8')
const limitsDatabaseTest = await readFile(new URL('../../supabase/tests/shop_plan_limits.sql', import.meta.url), 'utf8')
const plans = await readFile(new URL('../../app/composables/usePlans.ts', import.meta.url), 'utf8')

test('SUB-D08 catalog is canonical and publicly selects only purchasable plans', () => {
  for (const [slug, name, price] of [
    ['solo', 'Solo', 349],
    ['team', 'Team', 699],
    ['multi', 'Multi', 1099],
  ]) {
    assert.match(migration, new RegExp(`'${name}', '${slug}', ${price}, 'EGP', 'monthly', 14`))
  }
  assert.match(trialMigration, /trial_days = 7/)
  assert.match(plans, /rpc\('shop_public_plan_catalog'\)/)
  assert.match(adminMigration, /plan\.is_active and plan\.is_public and plan\.is_purchasable/)
  assert.match(migration, /slug in \('basic', 'pro'\)/)
  assert.match(migration, /strategy text not null check \(strategy = 'grandfather'\)/)
})

test('HOT-11 publishes exact monthly and yearly offers without changing plan family identity', () => {
  for (const [variant, monthly, yearly] of [
    ['standard', '349.00', '2847.84'],
    ['standard', '699.00', '5703.84'],
    ['multi_2', '999.00', '8151.84'],
    ['multi_3', '1199.00', '9783.84'],
  ]) {
    assert.match(catalogV2Migration, new RegExp(`'${variant}'[\\s\\S]+${monthly}`))
    assert.match(catalogV2Migration, new RegExp(`'${variant}'[\\s\\S]+${yearly}`))
  }
  assert.match(catalogV2Migration, /catalog_generation integer not null default 1/)
  assert.match(catalogV2Migration, /p_requested_catalog_terms_id uuid/)
  assert.match(catalogV2Migration, /plan_variant_snapshot/)
  assert.match(catalogV2Migration, /shop_private\.current_plan_offers/)
})

test('resource limits and commercial history are server-owned snapshots', () => {
  for (const resource of [
    'active_locations',
    'active_members',
    'active_products',
    'active_services',
  ]) assert.match(migration, new RegExp(resource))
  assert.match(migration, /create table public\.plan_catalog_terms/)
  assert.match(migration, /create table public\.subscription_commercial_periods/)
  assert.match(migration, /BILLING_NOTICE_COMMERCIAL_TERMS_IMMUTABLE/)
  assert.match(migration, /PLAN_RESOURCE_LIMIT_EXCEEDED/)
  assert.doesNotMatch(migration, /active_(customers|sales|appointments)/)
})

test('database regression covers migration, trial, quota, downgrade, and idempotency', () => {
  assert.match(databaseTest, /legacy active\/trial subscriptions were rewritten/)
  assert.match(databaseTest, /catalog reconciliation was not idempotent/)
  assert.match(databaseTest, /interval '7 days'/)
  assert.match(databaseTest, /Solo accepted a second active location/)
  assert.match(databaseTest, /Solo accepted a second active member/)
  assert.match(databaseTest, /over-limit downgrade succeeded/)
  assert.match(databaseTest, /submitted notice or approved paid period was rewritten/)
})

test('atomic resource engine shares one resolver, usage predicate, and lock boundary', () => {
  assert.match(limitsMigration, /create function shop_private\.resolve_plan_entitlement/)
  assert.match(limitsMigration, /create function shop_private\.plan_resource_usage/)
  assert.match(limitsMigration, /pg_catalog\.pg_advisory_xact_lock/)
  assert.match(limitsMigration, /create trigger shop_team_invitations_plan_limit/)
  assert.match(limitsMigration, /update public\.shop_team_invitations set status = 'accepted'[\s\S]+insert into public\.shop_memberships/)
  assert.match(limitsMigration, /create function public\.shop_plan_change_validation/)
  assert.match(limitsMigration, /'remaining'/)
  assert.doesNotMatch(limitsMigration, /active_(customers|sales|payments|appointments)/)
})

test('resource-limit regression covers reservations, retries, reactivation, expiry, and isolation', () => {
  assert.match(limitsDatabaseTest, /live invitation did not reserve member capacity/)
  assert.match(limitsDatabaseTest, /idempotent invitation retry consumed capacity twice/)
  assert.match(limitsDatabaseTest, /invitation reservation was not exchanged for one member seat/)
  assert.match(limitsDatabaseTest, /member reactivated over reserved seat limit/)
  assert.match(limitsDatabaseTest, /archived product reactivated over limit/)
  assert.match(limitsDatabaseTest, /archived service reactivated over limit/)
  assert.match(limitsDatabaseTest, /archived location reactivated over limit/)
  assert.match(limitsDatabaseTest, /downgrade validation lacked blockers or mutated customer data/)
  assert.match(limitsDatabaseTest, /expired subscription accepted a product mutation/)
  assert.match(limitsDatabaseTest, /expired subscription accepted a quota-increasing location mutation/)
  assert.match(limitsDatabaseTest, /cross-shop usage was disclosed/)
})

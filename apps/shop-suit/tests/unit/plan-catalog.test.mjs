import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929190000_canonical_plan_catalog.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_plan_catalog.sql', import.meta.url), 'utf8')
const plans = await readFile(new URL('../../app/composables/usePlans.ts', import.meta.url), 'utf8')

test('SUB-D08 catalog is canonical and publicly selects only purchasable plans', () => {
  for (const [slug, name, price] of [
    ['solo', 'Solo', 349],
    ['team', 'Team', 699],
    ['multi', 'Multi', 1099],
  ]) {
    assert.match(migration, new RegExp(`'${name}', '${slug}', ${price}, 'EGP', 'monthly', 14`))
  }
  assert.match(plans, /\.eq\('is_purchasable', true\)/)
  assert.match(migration, /slug in \('basic', 'pro'\)/)
  assert.match(migration, /strategy text not null check \(strategy = 'grandfather'\)/)
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
  assert.match(databaseTest, /interval '14 days'/)
  assert.match(databaseTest, /Solo accepted a second active location/)
  assert.match(databaseTest, /Solo accepted a third active member/)
  assert.match(databaseTest, /over-limit downgrade succeeded/)
  assert.match(databaseTest, /submitted notice or approved paid period was rewritten/)
})

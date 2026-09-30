import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260929220000_platform_plan_catalog_subscription_controls.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_plan_admin.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/platform-admin.vue', import.meta.url), 'utf8')
const component = await readFile(new URL('../../app/components/PlatformPlanAdmin.vue', import.meta.url), 'utf8')

test('catalog mutations append versions and preserve referenced history', () => {
  assert.match(migration, /create table public\.platform_plan_events/)
  assert.match(migration, /create trigger platform_plan_events_immutable/)
  assert.match(migration, /insert into public\.plan_catalog_terms/)
  assert.match(migration, /effective_from <= p_at/)
  assert.match(migration, /HISTORICAL_PLAN_DELETE_FORBIDDEN/)
  assert.doesNotMatch(migration, /update public\.plan_catalog_terms/)
  assert.match(databaseTest, /future catalog version became current early/)
  assert.match(databaseTest, /referenced historical plan was deleted/)
})

test('observer/operator boundaries and reasons are enforced server-side', () => {
  assert.match(migration, /assert_platform_admin\(true\)/)
  assert.match(migration, /length\(btrim\(p_reason\)\) not between 2 and 1000/)
  assert.match(migration, /PLATFORM_PLAN_COMMAND_KEY_REUSED/)
  assert.match(databaseTest, /observer mutated plan catalog/)
  assert.match(databaseTest, /tenant owner read platform plan controls/)
  assert.match(component, /v-if="canMutate"/)
})

test('subscription controls expose exact blockers and bounded commercial actions', () => {
  for (const action of ['change_subscription', 'renew_subscription', 'suspend_subscription', 'set_price_override', 'remove_price_override']) {
    assert.match(migration, new RegExp(`'${action}'`))
  }
  assert.match(migration, /plan_change_blockers/)
  assert.match(migration, /subscription_plan_change_requests/)
  assert.match(migration, /subscription_price_override_revocations/)
  assert.match(databaseTest, /over-limit downgrade was forced/)
  assert.match(databaseTest, /removed negotiated price remained effective/)
  assert.match(component, /pendingBillingRequests/)
  assert.match(component, /pendingPlanChange/)
})

test('the dedicated bilingual plan view replaces arbitrary subscription row edits', () => {
  assert.match(page, /view === 'plans'/)
  assert.match(page, /<PlatformPlanAdmin/)
  assert.doesNotMatch(page, /activate_subscription: 'Activate subscription'/)
  assert.doesNotMatch(page, /extend_subscription: 'Extend subscription'/)
  assert.match(component, /const en = \{/)
  assert.match(component, /const ar = \{/)
  assert.doesNotMatch(`${page}\n${component}`, /service[_-]?role/i)
})

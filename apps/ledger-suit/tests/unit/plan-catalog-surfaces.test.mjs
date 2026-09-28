import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const appRoot = new URL('../../', import.meta.url)
const read = relative => readFileSync(new URL(relative, appRoot), 'utf8')

test('all customer pricing surfaces render the shared server-catalog component', () => {
  assert.match(read('app/pages/index.vue'), /<BillingCheckout surface="public"/)
  assert.match(read('app/components/SubscriptionGate.vue'), /<BillingCheckout\s*\/>/)
  assert.match(read('app/pages/billing.vue'), /<BillingCheckout :surface="pricingSurface"/)

  const pricing = read('app/components/BillingCheckout.vue')
  assert.match(pricing, /rpc\('subscription_plan_catalog'\)/)
  assert.match(pricing, /const plans = computed\(\(\) => catalog\.value \?\? \[\]\)/)
  assert.doesNotMatch(pricing, /\b(?:39900|325584|59900|488784|109900|896784)\b/)
  assert.doesNotMatch(pricing, /plans\.enterprise|plans\.future\./)
  assert.doesNotMatch(pricing, /included\(plan, 'priority_support'\)/)
})

test('usage guidance and platform administration resolve plans from the safe catalog', () => {
  const usage = read('app/composables/usePlanUsage.ts')
  assert.match(usage, /rpc\('subscription_plan_catalog'\)/)
  assert.doesNotMatch(usage, /provider_price_id/)

  const admin = read('app/pages/platform-admin.vue')
  assert.match(admin, /rpc\('subscription_plan_catalog'\)/)
  assert.match(admin, /purchasablePlans/)
  assert.doesNotMatch(admin, /v-for="plan in \['solo', 'starter', 'business'\]"/)
})

test('the public catalog projection never returns provider mappings', () => {
  const migration = read('supabase/migrations/20260911090000_launch_plan_catalog.sql')
  const projection = migration.slice(migration.indexOf('create or replace function public.subscription_plan_catalog()'))
  assert.match(projection, /prices jsonb,\s+entitlements jsonb/)
  assert.doesNotMatch(projection, /jsonb_build_object\([\s\S]*provider_price_id/)
  assert.match(projection, /revoke select on public\.subscription_plans,[\s\S]*from anon, authenticated/)
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const root = new URL('../../', import.meta.url)
const read = path => readFile(new URL(path, root), 'utf8')

test('SS-SUB-001 acceptance package covers every approved requirement and decision', async () => {
  const verification = await read('docs/SS-SUB-001-verification.md')
  const requirements = Array.from({ length: 12 }, (_, index) => `SUB-${String(index + 1).padStart(2, '0')}`)
    .concat(['VAL-10', 'VAL-13'])
  const decisions = [
    'ADMIN-D01', 'BILL-D01', 'BILL-D02', 'BILL-D03', 'BILL-D04',
    'SUB-D01', 'SUB-D04', 'SUB-D05', 'SUB-D06', 'SUB-D07', 'UI-D01',
  ]
  const prerequisites = [
    'SS-PILOT-001', 'SS-PLAN-CATALOG-001', 'SS-PLAN-LIMITS-001',
    'SS-PLAN-BILLING-001', 'SS-PLAN-ADMIN-001', 'SS-PLAN-UI-001',
  ]
  for (const id of [...requirements, ...decisions, ...prerequisites]) assert.match(verification, new RegExp(`\\b${id}\\b`), `${id} is not traced`)
})

test('full Shop regression owns the lifecycle suite and all required races', async () => {
  const runner = await read('../../tooling/database/test-shop-local.mjs')
  const limitRace = await read('../../tooling/database/test-shop-plan-limits-local.mjs')
  const lifecycle = await read('supabase/tests/shop_subscription_lifecycle.sql')
  for (const suite of ['shop_subscription_lifecycle', 'shop_plan_catalog', 'shop_plan_limits', 'shop_billing', 'shop_plan_admin']) {
    assert.match(runner, new RegExp(`["']${suite}["']`))
  }
  assert.match(runner, /test-shop-plan-limits-local\.mjs/)
  assert.match(runner, /test-shop-plan-billing-local\.mjs/)
  for (const resource of ['active_locations', 'active_members', 'active_products', 'active_services']) assert.match(limitRace, new RegExp(resource))
  assert.match(lifecycle, /trial_end_at <> v_subscription\.trial_start_at \+ interval '7 days'/)
  assert.match(lifecycle, /First barber legacy fixture/)
  assert.match(lifecycle, /perform shop_private\.reconcile_plan_catalog\(\)/)
  assert.match(lifecycle, /instapay_manual/)
  assert.doesNotMatch(lifecycle, /automaticVerification["']?\s*[:,=]\s*true/i)
})

test('commercial runbook includes every supported operator recovery path', async () => {
  const runbook = await read('docs/SS-SUB-001-runbook.md')
  for (const heading of [
    'Create or change plan terms', 'Provision or revoke negotiated/founder pricing',
    'Approve an InstaPay transfer', 'Resolve a downgrade blocker',
    'Support an expired or suspended customer', 'Local qualification gate',
  ]) assert.match(runbook, new RegExp(`## ${heading}`))
  for (const state of ['Code implemented', 'Automated tests passed', 'Manually verified', 'Deployed', 'Commercially approved']) {
    assert.match(runbook, new RegExp(`\\*\\*${state}\\*\\*`))
  }
  assert.match(runbook, /--workers=1 --retries=0/)
  assert.match(runbook, /pnpm db:test:shop/)
})

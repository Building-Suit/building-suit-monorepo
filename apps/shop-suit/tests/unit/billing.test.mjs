import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928200000_manual_instapay_billing.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_billing.sql', import.meta.url), 'utf8')
const customerPage = await readFile(new URL('../../app/pages/billing.vue', import.meta.url), 'utf8')
const adminPage = await readFile(new URL('../../app/pages/platform-admin.vue', import.meta.url), 'utf8')

test('new trials are 14 days without rewriting existing trial deadlines', () => {
  assert.match(migration, /alter table public\.plans alter column trial_days set default 14/)
  assert.match(migration, /set trial_days = 14/)
  assert.match(migration, /plans_shop_trial_policy/)
  assert.match(migration, /SHOP_TRIAL_DAYS_MUST_BE_14/)
  assert.doesNotMatch(migration, /update public\.subscriptions[^;]*trial_end_at/i)
  assert.match(databaseTest, /v_trial_end <> v_trial_start \+ interval '14 days'/)
  assert.match(databaseTest, /exact expiry still allowed writes/)
})

test('customer notices are owner-only, idempotent, and cannot activate access', () => {
  assert.match(migration, /not shop_private\.is_owner\(p_shop_id\)/)
  assert.match(migration, /shop_billing_submissions_request_idx/)
  assert.match(migration, /BILLING_NOTICE_KEY_REUSED/)
  assert.match(databaseTest, /no-self-activation invariant failed/)
  assert.match(databaseTest, /outsider submitted billing/)
  assert.doesNotMatch(customerPage, /platform_admin_billing_command/)
})

test('manual operator approval is terminal, atomic, and audited', () => {
  assert.match(migration, /where submission\.id = p_submission_id for update/)
  assert.match(migration, /v_submission\.status not in \('submitted', 'under_review'\)/)
  assert.match(migration, /update public\.subscriptions set plan_id = v_submission\.plan_id, status = 'active'/)
  assert.match(migration, /create table public\.platform_billing_events/)
  assert.match(migration, /platform_billing_events_immutable/)
  assert.match(databaseTest, /approval did not activate exactly once/)
  assert.match(databaseTest, /second approval extended subscription/)
})

test('billing surfaces are bilingual and make manual verification explicit', () => {
  assert.match(customerPage, /This is not automatic bank verification/)
  assert.match(customerPage, /لا توجد مطابقة بنكية تلقائية/)
  assert.match(customerPage, /const ar = \{/)
  assert.match(adminPage, /platform_admin_billing_read/)
  assert.match(adminPage, /platform_admin_billing_command/)
  assert.doesNotMatch(`${migration}\n${customerPage}\n${adminPage}`, /paymob|webhook|automaticVerification[^\n]*true/i)
})

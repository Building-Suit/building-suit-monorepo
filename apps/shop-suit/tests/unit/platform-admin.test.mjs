import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928183000_platform_admin_dashboard_audit_tenant_control.sql', import.meta.url), 'utf8')
const sqlSuite = await readFile(new URL('../../supabase/tests/shop_platform_admin.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/platform-admin.vue', import.meta.url), 'utf8')
const layout = await readFile(new URL('../../app/layouts/platform-admin.vue', import.meta.url), 'utf8')

test('platform authority is explicitly provisioned and never tenant-derived', () => {
  assert.match(migration, /create table public\.platform_admins/)
  assert.match(migration, /where admin\.user_id = auth\.uid\(\)[\s\S]*admin\.enabled[\s\S]*auth\.role\(\) = 'authenticated'/)
  assert.doesNotMatch(migration, /insert into public\.platform_admins[\s\S]*shop_memberships/i)
  assert.match(migration, /revoke all on table public\.platform_admins,[\s\S]*from public, anon, authenticated/)
  assert.match(sqlSuite, /tenant owner self-granted platform authority/)
  assert.match(sqlSuite, /outsider read cross-tenant administration data/)
})

test('admin mutations are bounded, reasoned, idempotent and append-only', () => {
  for (const action of [
    'suspend_shop', 'reactivate_shop', 'extend_trial', 'end_trial',
    'activate_subscription', 'extend_subscription', 'suspend_subscription',
    'correct_billing_metadata', 'add_support_note',
  ]) assert.match(migration, new RegExp(`'${action}'`))
  assert.match(migration, /length\(btrim\(p_reason\)\) not between 2 and 1000/)
  assert.match(migration, /request_id uuid not null unique/)
  assert.match(migration, /before_state jsonb[\s\S]*after_state jsonb not null/)
  assert.match(migration, /before update or delete or truncate on public\.platform_admin_events/)
  assert.match(migration, /after insert or update or delete on public\.shop_memberships/)
  assert.match(migration, /before update or delete or truncate on public\.shop_membership_events/)
  assert.match(sqlSuite, /admin command idempotency failed/)
  assert.match(sqlSuite, /platform audit was mutable/)
})

test('operator surface uses only authenticated RPCs and clears on identity changes', () => {
  assert.match(page, /rpc\('platform_admin_session'\)/)
  assert.match(page, /rpc\('platform_admin_read'/)
  assert.match(page, /rpc\('platform_admin_command'/)
  assert.match(page, /watch\(userId,[\s\S]*session\.value = null/)
  assert.match(page, /await confirmation\.ask/)
  assert.match(page, /const ar = \{/)
  assert.match(layout, /SettingsMenu/)
  assert.doesNotMatch(`${page}\n${layout}`, /service[_-]?role/i)
  assert.doesNotMatch(`${migration}\n${page}`, /impersonat/i)
})

test('suspension blocks access without deleting tenant or operational history', () => {
  assert.match(migration, /shop\.status = 'active'::public\.shop_status/g)
  assert.match(migration, /update public\.shops set status = 'suspended'/)
  assert.doesNotMatch(migration, /delete from public\.(shops|invoices|payments|inventory_movements|shop_memberships)/i)
  assert.match(sqlSuite, /suspension deleted tenant history/)
  assert.match(sqlSuite, /operator role can directly edit operational history/)
})

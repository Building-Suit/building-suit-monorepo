import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260930170000_editable_shop_profile.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_profile_settings.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/settings.vue', import.meta.url), 'utf8')
const shopContext = await readFile(new URL('../../app/composables/useShop.ts', import.meta.url), 'utf8')

test('Shop profile command is permission checked, tenant scoped, and audited', () => {
  assert.match(migration, /has_permission\(p_shop_id, 'settings\.manage'\)/)
  assert.match(migration, /profile\.user_id = auth\.uid\(\)/)
  assert.match(migration, /membership\.shop_id = shop\.id/)
  assert.match(migration, /shop_profile_changes/)
  assert.match(migration, /SHOP_PROFILE_CHANGE_IMMUTABLE/)
  assert.match(migration, /length\(v_new_name\) not between 2 and 120/)
})

test('Shop profile coverage protects account, location, and historical identities', () => {
  for (const evidence of [
    'owner Shop profile update failed',
    'settings manager Shop profile update failed',
    'ordinary employee Shop profile update accepted',
    'cross-shop profile update accepted',
    'Shop profile update changed personal account identity',
    'Shop profile update rewrote historical receipt snapshots',
    'Shop profile update duplicated or changed main-location contact data',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('Business settings exposes a bilingual responsive Shop profile form and refreshes shared context', () => {
  assert.match(page, /profileTitle: 'ملف المتجر'/)
  assert.match(page, /profileTitle: 'Shop profile'/)
  assert.match(page, /id="shop-profile"/)
  assert.match(page, /autocomplete="organization"/)
  assert.match(page, /save_shop_profile/)
  assert.match(page, /await reload\(\)/)
  assert.match(page, /href="#locations"/)
  assert.match(page, /لا يغيّر اسم حسابك الشخصي أو بريدك الإلكتروني/)
  assert.match(page, /does not change your personal account name or email/)
  assert.match(page, /p-5 sm:p-6/)
  assert.match(shopContext, /\.select\('id,name,status,business_mode,created_at'\)/)
})

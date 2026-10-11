import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migration = await readFile(new URL('../../supabase/migrations/20260928213000_team_roles_invitations_suspension.sql', import.meta.url), 'utf8')
const databaseTest = await readFile(new URL('../../supabase/tests/shop_team_management.sql', import.meta.url), 'utf8')
const page = await readFile(new URL('../../app/pages/team.vue', import.meta.url), 'utf8')
const shell = await readFile(new URL('../../app/layouts/default.vue', import.meta.url), 'utf8')
const products = await readFile(new URL('../../app/pages/products/index.vue', import.meta.url), 'utf8')
const services = await readFile(new URL('../../app/pages/services/index.vue', import.meta.url), 'utf8')
const expenses = await readFile(new URL('../../app/pages/expenses/index.vue', import.meta.url), 'utf8')
const settings = await readFile(new URL('../../app/pages/settings.vue', import.meta.url), 'utf8')

test('team contract preserves granular authorization and history', () => {
  assert.match(migration, /shop_team_invitations/)
  assert.match(migration, /team\.permissions\.manage/)
  assert.match(migration, /inventory\.adjust/)
  assert.match(migration, /products\.manage/)
  assert.match(migration, /reports\.view/)
  assert.match(migration, /trg_shop_memberships_owner_continuity/)
  assert.match(migration, /LAST_OWNER_REQUIRED/)
  assert.match(migration, /shop_team_events/)
  assert.match(migration, /SHOP_TEAM_EVENT_IMMUTABLE/)
  assert.doesNotMatch(migration, /delete from public\.shop_memberships/)
})

test('team database coverage includes the critical boundaries', () => {
  for (const evidence of [
    'existing staff addition, role, or branch assignment failed',
    'invitation acceptance failed',
    'open-session suspension retained protected access',
    'last-owner continuity guard failed',
    'atomic ownership transfer failed',
    'outsider or cross-shop team isolation failed',
    'sensitive team audit evidence is incomplete',
  ]) assert.match(databaseTest, new RegExp(evidence))
})

test('team UI exposes bilingual responsive management and invite acceptance', () => {
  assert.match(shell, /to: '\/team'/)
  assert.match(page, /الفريق والصلاحيات/)
  assert.match(page, /Team & permissions/)
  assert.match(page, /<BsDataTable/)
  assert.match(page, /accept_shop_invitation/)
  assert.match(page, /transfer_shop_ownership/)
  assert.match(page, /:columns="\[/)
  for (const delegatedPage of [products, services, settings]) {
    assert.match(delegatedPage, /shop_permission_access/)
    assert.doesNotMatch(delegatedPage, /isOwner/)
  }
  assert.match(expenses, /expensePage\.value\.canManage/)
  assert.match(expenses, /rpc\.rpc\('list_expenses'/)
  assert.doesNotMatch(expenses, /isOwner/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { validateMigrationAccess, validateExplicitAccess } from '../check-explicit-access.mjs'
import { renderExplicitAccess } from '../explicit-access.mjs'
import { fileURLToPath } from 'node:url'

test('RLS alone does not provide API permissions after the platform change', () => {
  const sql = 'create table public.sales(id uuid); alter table public.sales enable row level security;'
  assert.match(validateMigrationAccess(sql).join(), /explicit GRANT\/REVOKE/)
  assert.deepEqual(validateMigrationAccess(`${sql} revoke all on public.sales from public,anon,authenticated;`), [])
})
test('a grant on another object or a comment cannot satisfy the new table contract', () => {
  const sql = 'create table public.sales(id uuid); alter table public.sales enable row level security;'
  for (const declaration of ['grant select on public.other_sales to authenticated;', '-- grant select on public.sales to authenticated;', '/* grant select on public.sales to authenticated; */']) assert.equal(validateMigrationAccess(`${sql}\n${declaration}`).length, 1)
})
test('new RPCs need deliberate execution and tables need explicit RLS', () => {
  assert.match(validateMigrationAccess('create function public.checkout() returns void language sql as $$select;$$;').join(), /explicit GRANT\/REVOKE/)
  assert.deepEqual(validateMigrationAccess('create function public.checkout() returns void language sql as $$select;$$; revoke all on function public.checkout() from public,anon; grant execute on function public.checkout() to authenticated;'), [])
  assert.match(validateMigrationAccess('create table public.sales(id uuid); grant select on public.sales to authenticated;').join(), /enable RLS/)
})
test('catalog exporter refuses provider schemas and unsafe privilege tokens', () => {
  assert.throws(() => renderExplicitAccess({}, ['storage']), /Provider schema/)
  assert.throws(() => renderExplicitAccess({ relations: [{ schema: 'public', name: 'sales', kind: 'r', owner: 'postgres', grants: [{ role: 'anon', privilege: 'SELECT; DROP SCHEMA public CASCADE' }] }] }, ['public']), /Unexpected relation privilege/)
})
test('all app configurations and new migrations enforce explicit access', async () => {
  assert.deepEqual(await validateExplicitAccess(fileURLToPath(new URL('../../../', import.meta.url))), [])
})

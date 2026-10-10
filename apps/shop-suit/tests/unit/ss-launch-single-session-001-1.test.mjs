import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('provider inspection record binds verified organization/projects and preserves a read-only boundary', async () => {
  const doc = await readFile(new URL('../../docs/single-session.md', import.meta.url), 'utf8')
  const map = JSON.parse(await readFile(new URL('../../../../docs/architecture/environments.json', import.meta.url), 'utf8')).products['shop-suit']
  for (const id of [map.organizationId, map.staging.projectRef, map.production.projectRef]) assert.ok(doc.includes(id))
  assert.match(doc, /plan=free/)
  assert.match(doc, /No provider configuration or database write occurred/)
  assert.match(doc, /Before any separately authorized provider change/)
  const plugin = await readFile(new URL('../../app/plugins/session-loss.client.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(plugin, /signOut|admin\.|execute_sql|apply_migration/)
})

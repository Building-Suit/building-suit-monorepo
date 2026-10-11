import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

test('handback distinguishes implemented handling from unverified provider configuration and launch gate', async () => {
  const doc = await readFile(new URL('../../docs/single-session.md', import.meta.url), 'utf8')
  assert.match(doc, /Shop handling: implemented/)
  assert.match(doc, /Provider configured: \*\*not verified \/ not enabled by this task\*\*/)
  assert.match(doc, /Launch enforcement: \*\*blocked\*\*/)
  assert.match(doc, /Already-issued JWTs can remain valid until expiry/)
  assert.match(doc, /do not prove hosted enforcement/)
})

test('all Shop logout entrypoints use local scope instead of implicit global revocation', async () => {
  for (const path of ['layouts/default.vue', 'layouts/platform-admin.vue']) {
    const source = await readFile(new URL(`../../app/${path}`, import.meta.url), 'utf8')
    assert.match(source, /signOut\(\{ scope: 'local' \}\)/)
    assert.doesNotMatch(source, /signOut\(\)/)
  }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useBlobUrl } from '../src/composables/useBlobUrl.ts'
test('scope changes, replacement and disposal revoke private previews; disposed owners reject new bytes',() => {
  const scope = effectScope(); const urls = scope.run(() => useBlobUrl())
  const original = URL.revokeObjectURL; const revoked = []
  URL.revokeObjectURL = value => { revoked.push(value); original(value) }
  try {
    urls.replace(new Blob(['synthetic first'])); const first = urls.url.value
    urls.replace(new Blob(['synthetic next'])); const next = urls.url.value; assert.ok(first && next && first!==next); assert.deepEqual(revoked,[first])
    urls.clear(); assert.equal(urls.url.value,''); assert.deepEqual(revoked,[first,next])
    urls.replace(new Blob(['synthetic final'])); const last = urls.url.value; scope.stop(); assert.equal(urls.url.value,''); assert.deepEqual(revoked,[first,next,last])
    assert.equal(urls.replace(new Blob(['stale'])),false); assert.equal(urls.url.value,'')
  } finally { scope.stop(); URL.revokeObjectURL = original }
})

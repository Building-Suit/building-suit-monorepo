import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope } from 'vue'
import { useFileUpload } from '../src/composables/useFileUpload.ts'
const file = () => new File(['image'], 'image.png', { type: 'image/png' })
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r }); return { promise, resolve } }
test('failure keeps preview for retry, duplicate submission is suppressed and dispose releases previews', async () => {
  const scope = effectScope(); let calls = 0; const complete = []
  const upload = scope.run(() => useFileUpload({ validate: async () => {}, upload: async () => { if (++calls === 1) throw Error('network'); return 'object' }, complete: result => complete.push(result) }))
  await upload.select(file()); assert.equal(upload.status.value, 'error'); assert.match(upload.preview.value, /^blob:/)
  await upload.retry(); assert.equal(upload.status.value, 'uploaded'); assert.deepEqual(complete, ['object'])
  scope.stop(); assert.equal(upload.preview.value, '')
})
test('reset prevents late upload results from entering another tenant or editor', async () => {
  const scope = effectScope(); const pending = deferred(); const complete = []
  const upload = scope.run(() => useFileUpload({ validate: async () => {}, upload: () => pending.promise, complete: result => complete.push(result) }))
  const request = upload.select(file()); await Promise.resolve(); await upload.select(file())
  upload.reset('existing'); pending.resolve('stale'); await request
  assert.deepEqual(complete, []); assert.equal(upload.preview.value, 'existing'); assert.equal(upload.status.value, 'idle'); scope.stop()
})
test('invalid files never call transport or replace the existing preview', async () => {
  const scope = effectScope(); let calls = 0
  const upload = scope.run(() => useFileUpload({ validate: async () => { throw Error('invalid') }, upload: async () => { calls++; }, complete: () => {} }))
  upload.reset('existing'); await upload.select(file())
  assert.equal(upload.status.value, 'invalid'); assert.equal(upload.preview.value, 'existing'); assert.equal(calls, 0); scope.stop()
})

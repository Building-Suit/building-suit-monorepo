import test from 'node:test'
import assert from 'node:assert/strict'
import {doctorMetaDigest, doctorMetaImages, pullPinnedDoctorMetaImage as pull} from '../pinned-meta-image.mjs'

test('successful primary pull keeps the immutable CLI-pinned release', async () => {
  const calls = []
  const selected = await pull(image => {calls.push(image); return {status: 0}})
  assert.equal(selected, doctorMetaImages[0])
  assert.deepEqual(calls, [doctorMetaImages[0]])
  for (const image of doctorMetaImages) assert.ok(image.endsWith(`:v0.98.0@${doctorMetaDigest}`))
})

test('registry throttling selects only the official mirror of the exact same digest', async () => {
  const calls = [], delays = []
  const selected = await pull(image => {
    calls.push(image)
    return calls.length === 1 ? {status: 1, stderr: 'toomanyrequests: retry-after'} : {status: 0}
  }, async ms => delays.push(ms))
  assert.equal(selected, doctorMetaImages[1])
  assert.deepEqual(calls, doctorMetaImages)
  assert.deepEqual(delays, [5000])
})

test('transient failures remain bounded to three pinned attempts and cannot waive generation', async () => {
  const calls = [], delays = []
  await assert.rejects(pull(image => {calls.push(image); return {status: 1, stderr: '503 temporary failure'}}, async ms => delays.push(ms)), /schema generation remains unverified/)
  assert.deepEqual(calls, [doctorMetaImages[0], doctorMetaImages[1], doctorMetaImages[1]])
  assert.deepEqual(delays, [5000, 15000])
})

test('authentication, access and policy denials never trigger mirror fallback', async () => {
  for (const stderr of ['unauthorized', '403 Forbidden', 'access denied', 'policy denied; 503', 'permission denied; rate exceeded']) {
    const calls = []
    await assert.rejects(pull(image => {calls.push(image); return {status: 1, stderr}}, async () => assert.fail('denial must not retry')))
    assert.deepEqual(calls, [doctorMetaImages[0]])
  }
})

test('an actual process timeout can retry but malformed or permanent failures cannot', async () => {
  let calls = 0
  assert.equal(await pull(() => ++calls === 1 ? {status: null, error: {code: 'ETIMEDOUT'}} : {status: 0}, async () => {}), doctorMetaImages[1])
  for (const result of [{status: 1, stderr: 'manifest unknown'}, {status: 1, stderr: 'private sentinel'}, {status: null}]) {
    let count = 0
    await assert.rejects(pull(() => {count++; return result}, async () => assert.fail('permanent failures must not retry')), error => !error.message.includes('private sentinel'))
    assert.equal(count, 1)
  }
})

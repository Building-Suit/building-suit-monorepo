import test from 'node:test'
import assert from 'node:assert/strict'
import { createDoctorFileSignalBuffer, doctorFileSignals, observeDoctorFileFailure } from '../../supabase/functions/_shared/operational-signals.ts'
import { createDoctorDocumentHandler } from '../../supabase/functions/doctor-documents/handler.ts'
import { createPaymentEvidenceHandler } from '../../supabase/functions/doctor-payment-evidence/handler.ts'
import { DoctorDocumentFailure, doctorDocumentHash } from '../../supabase/functions/doctor-documents/files.ts'

const id = n => `77070000-0000-4000-8000-${String(n).padStart(12, '0')}`
const marker = 'SYNTHETIC_PRIVATE_PAYLOAD_DO_NOT_CAPTURE'
const bytes = new TextEncoder().encode(`%PDF-1.7\n${marker}\n%%EOF\n`)
const count = (buffer, signal) => buffer.snapshot().counts.find(row => row.signal === signal).count

async function fixture(surface, observe) {
  const calls = [], actor = { userId: id(1), sessionId: id(2) }
  const hash = await doctorDocumentHash(bytes)
  let denied = false, corrupt = false, revokeOnRead = false, uncertainCommit = false, outage = false
  const doc = { documentId: id(5), versionId: id(6), objectPath: `${id(3)}/${id(4)}/${id(5)}/${id(6)}.pdf`, mime: 'application/pdf', size: bytes.length, sha256: hash, filename: 'synthetic.pdf', intentId: id(7), state: 'reserved', result: null }
  const payment = { id: id(5), notice_id: id(4), filename: 'synthetic.pdf', mime_type: 'application/pdf', byte_size: bytes.length, sha256: hash, object_path: `${id(1)}/${id(4)}/${id(5)}.pdf`, state: 'reserved' }
  const plan = surface === 'documents' ? doc : payment
  const authorize = () => { if (denied) throw new DoctorDocumentFailure(403, 'denied'); return { canWrite: true } }
  const backend = {
    authenticate: async () => { calls.push('authenticate'); return actor },
    authorize: async () => { calls.push('authorize'); return authorize() },
    access: async () => { calls.push('access'); authorize() },
    reserve: async () => { calls.push('reserve'); return plan },
    put: async () => { calls.push('put'); if (outage) throw new Error(marker) },
    get: async () => { calls.push('get'); if (revokeOnRead) denied = true; return corrupt ? new Uint8Array(bytes.length) : bytes },
    finalize: async () => { calls.push('finalize'); authorize(); if (uncertainCommit) throw new Error(marker); return surface === 'documents' ? { documentId: id(5), versionId: id(6), version: 1 } : payment },
    plan: async () => { calls.push('plan'); authorize(); return plan },
  }
  const handler = (surface === 'documents' ? createDoctorDocumentHandler : createPaymentEvidenceHandler)(() => backend, ['https://doctor.example.test'], observe)
  const request = (operation = 'upload', extraHeaders = {}) => {
    const meta = surface === 'documents'
      ? { practiceId: id(3), locationId: id(8), patientId: id(4), key: id(9), ...(operation === 'upload' ? { filename: 'synthetic.pdf' } : { documentId: id(5) }) }
      : { noticeId: id(4), key: id(9), ...(operation === 'upload' ? { filename: 'synthetic.pdf' } : { evidenceId: id(5) }) }
    return new Request(`https://doctor.example.test/function?op=${operation}`, { method: 'POST', headers: {
      authorization: 'Bearer synthetic.token', origin: 'https://doctor.example.test', 'content-type': 'application/pdf',
      [surface === 'documents' ? 'x-doctor-document' : 'x-doctor-payment-evidence']: encodeURIComponent(JSON.stringify(meta)), ...extraHeaders,
    }, ...(operation === 'upload' ? { body: bytes } : {}) })
  }
  return { handler, request, calls, deny: () => { denied = true }, corrupt: () => { corrupt = true }, revokeOnRead: () => { revokeOnRead = true }, unknownCommit: () => { uncertainCommit = true }, outage: () => { outage = true } }
}

test('C01 partial: fixed signal vocabulary rejects arbitrary payloads without evaluating or retaining them', () => {
  const buffer = createDoctorFileSignalBuffer()
  const hostile = new Proxy({}, { get() { throw new Error('Payload was inspected') } })
  for (const value of [null, undefined, hostile, { message: marker }, marker, `${doctorFileSignals[0]}:${marker}`, 401]) assert.equal(buffer.record(value), false)
  assert.equal(buffer.record(doctorFileSignals[0]), true)
  assert.equal(count(buffer, doctorFileSignals[0]), 1)
  assert(!JSON.stringify(buffer.snapshot()).includes(marker))
  assert.equal(buffer.snapshot().hostedTelemetry, false)
  assert.equal(buffer.snapshot().externalDelivery, false)
})

test('C01 partial: counters saturate, snapshots are immutable and instances clear independently', () => {
  const a = createDoctorFileSignalBuffer(), b = createDoctorFileSignalBuffer(), signal = doctorFileSignals[0]
  for (let n = 0; n < 65536; n++) a.record(signal)
  const old = a.snapshot()
  assert.equal(count(a, signal), 65535); assert.equal(old.saturated, true)
  assert.equal(count(b, signal), 0)
  assert.throws(() => { old.counts[0].count = 0 }, TypeError)
  a.clear(); assert.equal(count(a, signal), 0); assert.equal(a.snapshot().saturated, false)
  assert.equal(old.counts[0].count, 65535)
})

for (const surface of ['documents', 'payment_evidence']) {
  test(`C01 partial ${surface}: denied session/scope produce fixed signals and no storage writes`, async () => {
    const buffer = createDoctorFileSignalBuffer(), f = await fixture(surface, buffer.record)
    assert.equal((await f.handler(f.request('upload', { authorization: '' }))).status, 401)
    assert.deepEqual(f.calls, [])
    f.deny(); const response = await f.handler(f.request())
    assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: 'denied' })
    assert.equal(count(buffer, `${surface}.session_rejected`), 1)
    assert.equal(count(buffer, `${surface}.access_rejected`), 1)
    assert(!f.calls.includes('put')); assert(!f.calls.includes('finalize'))
    assert(!JSON.stringify(buffer.snapshot()).includes(id(1)))
  })
  test(`C01 partial ${surface}: injected storage outage and corruption remain unavailable without content capture`, async () => {
    for (const fault of ['outage', 'corrupt']) {
      const buffer = createDoctorFileSignalBuffer(), f = await fixture(surface, buffer.record); f[fault]()
      const response = await f.handler(f.request())
      assert.equal(response.status, 503); assert.deepEqual(await response.json(), { error: 'unavailable' })
      assert.equal(count(buffer, `${surface}.unavailable`), 1)
      assert(!f.calls.includes('finalize')); assert(!JSON.stringify(buffer.snapshot()).includes(marker))
    }
  })
  test(`C01 partial ${surface}: post-read revocation denies delivery; observer cannot change authority`, async () => {
    const signals = [], f = await fixture(surface, signal => { signals.push(signal); throw new Error(marker) }); f.revokeOnRead()
    const response = await f.handler(f.request('download'))
    assert.equal(response.status, 403); assert.deepEqual(await response.json(), { error: 'denied' })
    assert.deepEqual(signals, [`${surface}.access_rejected`])
    assert.equal(f.calls.filter(call => call === 'plan').length, 2)
  })
  test(`C01 partial ${surface}: unknown finalization does not retry, clean up or imply a rejected payment`, async () => {
    const buffer = createDoctorFileSignalBuffer(), f = await fixture(surface, buffer.record); f.unknownCommit()
    assert.equal((await f.handler(f.request())).status, 503)
    assert.equal(f.calls.filter(call => call === 'put').length, 1)
    assert.equal(f.calls.filter(call => call === 'finalize').length, 1)
    assert.equal(count(buffer, `${surface}.unavailable`), 1)
    assert(!JSON.stringify(buffer.snapshot()).includes('settled'))
  })
}

test('C01 partial: omitted observer records nothing and valid file delivery stays byte-identical', async () => {
  for (const surface of ['documents', 'payment_evidence']) {
    const untouched = createDoctorFileSignalBuffer(), f = await fixture(surface)
    const response = await f.handler(f.request('download'))
    assert.equal(response.status, 200); assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
    assert(untouched.snapshot().counts.every(row => row.count === 0))
  }
})

test('C01 partial: rejected or stalled observers cannot delay an unavailable response', async () => {
  for (const observer of [() => Promise.reject(new Error(marker)), () => new Promise(() => {})]) {
    const f = await fixture('documents', observer); f.outage()
    assert.equal((await f.handler(f.request())).status, 503)
    await new Promise(resolve => setImmediate(resolve)) // unhandled rejections would fail this test
  }
  const buffer = createDoctorFileSignalBuffer()
  for (const status of [200, 204, 400, 405, 409, 413, 415, 500]) observeDoctorFileFailure(buffer.record, 'documents', status)
  observeDoctorFileFailure(buffer.record, marker, 503)
  assert(buffer.snapshot().counts.every(row => row.count === 0))
})

test('C01 partial: synthetic observation has no implicit network, console or client-selected sink', async () => {
  const originalFetch = globalThis.fetch, originals = {}, calls = { network: 0, console: 0 }
  globalThis.fetch = async () => { calls.network++; throw new Error('Unexpected external delivery') }
  for (const method of ['log', 'warn', 'error', 'info', 'debug']) {
    originals[method] = console[method]; console[method] = () => { calls.console++ }
  }
  try {
    for (const surface of ['documents', 'payment_evidence']) {
      const buffer = createDoctorFileSignalBuffer(), f = await fixture(surface, buffer.record); f.outage()
      const response = await f.handler(f.request('upload', { 'x-doctor-observer': 'https://unapproved.example.test', 'x-debug-token': marker }))
      assert.equal(response.status, 503)
      assert.equal(count(buffer, `${surface}.unavailable`), 1)
      assert(!JSON.stringify(buffer.snapshot()).includes('unapproved'))
    }
    assert.deepEqual(calls, { network: 0, console: 0 })
  } finally {
    globalThis.fetch = originalFetch
    for (const [method, original] of Object.entries(originals)) console[method] = original
  }
})

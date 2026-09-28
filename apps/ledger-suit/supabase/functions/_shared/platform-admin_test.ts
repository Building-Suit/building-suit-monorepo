import { receiptRequest } from './platform-admin.ts'
const id = 'd0000000-0000-4000-8000-000000000001'
Deno.test('receipt selector accepts only an exact payment UUID', async () => {
  const result = await receiptRequest(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ requestId: id }) }))
  if (result.requestId !== id) throw new Error('Wrong request')
})
Deno.test('receipt selector rejects caller-controlled storage keys, actors, invalid IDs and oversized streams', async () => {
  for (const body of [JSON.stringify({ requestId: id, storage_key: 'other/tenant' }), JSON.stringify({ requestId: id, actor_id: id }),
    JSON.stringify({ requestId: 'not-a-uuid' }), 'null', '[]', '{', ' '.repeat(2049)]) {
    let rejected = false
    try { await receiptRequest(new Request('https://example.test', { method: 'POST', body })) }
    catch { rejected = true }
    if (!rejected) throw new Error('Unsafe receipt request accepted')
  }
})

Deno.test('receipt boundary never signs for tenants, invalid sessions or missing targets', async () => {
  const { platformReceiptHandler } = await import('./platform-admin.ts')
  let signed = 0
  for (const mode of ['tenant', 'expired', 'missing', 'rpc_failure']) {
    const handler = platformReceiptHandler({
      async authenticate() {
        if (mode === 'expired') throw new Error('Invalid session')
        return { read: () => {
          if (mode === 'rpc_failure') throw new Error('Database unavailable')
          return Promise.resolve(mode === 'tenant' ? { ok: false } : { ok: true })
        } }
      },
      sign() { signed++; return Promise.resolve('secret') },
    })
    const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ requestId: id }) }))
    if (response.status !== ({ tenant: 403, expired: 401, missing: 404, rpc_failure: 503 } as Record<string, number>)[mode]) throw new Error('Wrong denial status')
    if ((await response.text()).includes('secret')) throw new Error('Leaked receipt')
  }
  if (signed !== 0) throw new Error('Signing was reached without authority')
})
Deno.test('receipt boundary signs only the audited database key and disables caching', async () => {
  const { platformReceiptHandler } = await import('./platform-admin.ts')
  const sequence: string[] = []
  const handler = platformReceiptHandler({
    authenticate() {
      sequence.push('auth')
      return Promise.resolve({ read(requestId) {
        if (requestId !== id) throw new Error('Wrong target')
        sequence.push('audited read')
        return Promise.resolve({ ok: true, storageKey: 'verified/key', evidenceId: id })
      } })
    },
    sign(key) {
      if (key !== 'verified/key') throw new Error('Untrusted key')
      sequence.push('sign'); return Promise.resolve('https://example.test/receipt')
    },
  })
  const response = await handler(new Request('https://example.test', { method: 'POST', body: JSON.stringify({ requestId: id }) }))
  if (response.status !== 200 || response.headers.get('Cache-Control') !== 'no-store') throw new Error('Unsafe response')
  if (sequence.join(',') !== 'auth,audited read,sign') throw new Error('Authorization order changed')
  const body = await response.json()
  if (body.expiresIn !== 60 || body.evidenceId !== id) throw new Error('Wrong receipt contract')
})

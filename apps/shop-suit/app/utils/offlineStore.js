// Product-owned, bounded POS storage. No Auth tokens, customer contact data or media.
const encoder = new TextEncoder()
const decoder = new TextDecoder()
const VERSION = 1
const MAX_PENDING = 200
export const CACHE_TTL = 12 * 60 * 60 * 1000
const request = value => new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error) })
const finished = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = () => reject(tx.error); tx.onerror = () => reject(tx.error) })
const bytes = value => encoder.encode(JSON.stringify(value))
export function createOfflineStore({ scope, indexedDB = globalThis.indexedDB, crypto = globalThis.crypto, locks = globalThis.navigator?.locks, now = Date.now }) {
  if (!scope || !indexedDB || !crypto?.subtle || !locks) throw new Error('OFFLINE_STORAGE_UNAVAILABLE')
  const name = `bs-shop-pos-v${VERSION}:${scope}`
  let database
  let keys
  const exclusive = action => locks.request(name, action)
  async function open() {
    if (database) return database
    const pending = indexedDB.open(name, VERSION)
    pending.onupgradeneeded = () => { pending.result.createObjectStore('keys'); pending.result.createObjectStore('records') }
    database = await request(pending)
    database.onversionchange = () => { database.close(); database = undefined; keys = undefined }
    return database
  }
  async function rawGet(key, store = 'records') { const db = await open(); return request(db.transaction(store).objectStore(store).get(key)) }
  async function rawPut(key, value, store = 'records') {
    const db = await open(); const tx = db.transaction(store, 'readwrite'); const done = finished(tx)
    tx.objectStore(store).put(value, key); await done
  }
  async function keyPair() {
    if (!keys) {
      keys = await rawGet('local', 'keys')
      if (!keys) {
        keys = { encryption: await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']), signing: await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']) }
        await rawPut('local', keys, 'keys')
      }
    }
    return keys
  }
  async function put(key, value) {
    const pair = await keyPair(); const iv = crypto.getRandomValues(new Uint8Array(12))
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(`${scope}:${key}`) }, pair.encryption, bytes(value))
    await rawPut(key, { iv, ciphertext })
  }
  async function get(key) {
    const record = await rawGet(key); if (!record) return null
    try { return JSON.parse(decoder.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: record.iv, additionalData: encoder.encode(`${scope}:${key}`) }, (await keyPair()).encryption, record.ciphertext))) }
    catch { throw new Error('OFFLINE_STORAGE_CORRUPT') }
  }
  const commandHash = async command => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes(command)))).map(value => value.toString(16).padStart(2, '0')).join('')
  async function compactTerminal(record) {
    if (record.originalCommandHash || (record.state !== 'synced' && record.resolution?.phase !== 'reconciled')) return
    await verify(record)
    record.originalCommandHash = await commandHash(record.envelope.command)
    // Server has the immutable full command. Keep IDs/amount/status locally, not contacts, notes or references.
    const retained = new Set(['request','p_request_id','p_save_request_id','p_issue_request_id','p_payment_request_id','p_appointment_request_id','p_shop_id','p_location_id','p_shift_id','p_session_id','p_amount','p_counted_amount','p_method','p_kind'])
    record.envelope.command = { ...record.envelope.command, args: Object.fromEntries(Object.entries(record.envelope.command.args).filter(([key]) => retained.has(key))) }
    record.signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', (await keyPair()).signing, bytes(record.envelope))))
    await put(`queue:${record.envelope.localId}`, record)
  }
  async function listUnlocked() {
    const db = await open(); const all = await request(db.transaction('records').objectStore('records').getAllKeys())
    const records = await Promise.all(all.filter(key => String(key).startsWith('queue:')).map(key => get(key)))
    for (const record of records) await compactTerminal(record)
    return records.sort((a, b) => a.sequence - b.sequence)
  }
  async function verify(record) {
    const valid = await crypto.subtle.verify('HMAC', (await keyPair()).signing, new Uint8Array(record.signature), bytes(record.envelope))
    if (!valid || record.envelope.scope !== scope || record.envelope.version !== VERSION) throw new Error('OFFLINE_SIGNATURE_INVALID')
    if (record.resolution && !await crypto.subtle.verify('HMAC', (await keyPair()).signing, new Uint8Array(record.resolutionSignature), bytes(record.resolution))) throw new Error('OFFLINE_SIGNATURE_INVALID')
  }
  return {
    async cache(key, value) { return exclusive(async () => {
      // Each cache key is an owning product allowlist entry; never a URL response cache.
      if (!['catalog', 'context', 'shift', 'categories'].includes(key)) throw new Error('OFFLINE_CACHE_FORBIDDEN')
      await put(`cache:${key}`, { expires: now() + CACHE_TTL, value })
    }) },
    async cached(key) { return exclusive(async () => {
      const record = await get(`cache:${key}`)
      if (record && record.expires <= now()) {
        const db = await open(); const tx = db.transaction('records', 'readwrite'); const done = finished(tx)
        tx.objectStore('records').delete(`cache:${key}`); await done; return null
      }
      return record?.value ?? null
    }) },
    async clearCache() { return exclusive(async () => {
      const db = await open(); const tx = db.transaction('records', 'readwrite'); const done = finished(tx)
      for (const key of ['catalog', 'context', 'shift', 'categories']) tx.objectStore('records').delete(`cache:${key}`)
      await done
    }) },
    async enqueue(command, localId = crypto.randomUUID()) { return exclusive(async () => {
      const existing = await get(`queue:${localId}`)
      if (existing) { await verify(existing); if (existing.originalCommandHash ? existing.originalCommandHash !== await commandHash(command) : JSON.stringify(existing.envelope.command) !== JSON.stringify(command)) throw new Error('OFFLINE_ID_REUSED'); return existing }
      const all = await listUnlocked()
      if (all.some(record => record.envelope.command.kind === 'close' && record.state !== 'synced' && record.resolution?.phase !== 'reconciled')) throw new Error('OFFLINE_CLOSE_PENDING')
      if (all.filter(record => record.state !== 'synced' && record.resolution?.phase !== 'reconciled').length >= MAX_PENDING) throw new Error('OFFLINE_QUEUE_FULL')
      const envelope = { version: VERSION, scope, localId, createdAt: new Date(now()).toISOString(), command }
      const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', (await keyPair()).signing, bytes(envelope))))
      const record = { envelope, signature, sequence: all.reduce((maximum, record) => Math.max(maximum, record.sequence), 0) + 1, state: 'unsynced', error: null, result: null }
      await put(`queue:${localId}`, record); return record
    }) },
    list: () => exclusive(listUnlocked),
    async retry(localId) { return exclusive(async () => {
      const record = await get(`queue:${localId}`); if (!record || record.state !== 'failed' || record.resolution) return
      await verify(record); record.state = 'unsynced'; record.error = null; await put(`queue:${localId}`, record)
    }) },
    async reconcile(localId, execute) { return exclusive(async () => {
      const record = await get(`queue:${localId}`)
      if (!record) throw new Error('OFFLINE_RESOLUTION_UNAVAILABLE')
      await verify(record)
      if (record.state === 'synced' || record.resolution?.phase === 'reconciled') return record
      if (!record.resolution) record.resolution = { requestId: crypto.randomUUID(), phase: 'requested', reason: 'Operator requested cancellation of unposted offline transaction' }
      const signResolution = async () => { record.resolutionSignature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', (await keyPair()).signing, bytes(record.resolution)))) }
      await signResolution(); await put(`queue:${localId}`, record)
      if (record.resolution.phase !== 'cancelled') {
        const result = await execute(record.envelope.command, record.resolution)
        if (result.state === 'synced' && typeof result.invoiceId === 'string') {
          record.state = 'synced'; record.result = result.invoiceId; record.error = null
          record.resolution.phase = 'already-issued'
        } else if (result.state === 'cancelled' && result.resolutionRequestId === record.resolution.requestId) {
          record.resolution.phase = 'cancelled'; record.state = 'failed'; record.error = 'OFFLINE_SALE_CANCELLED'
        } else throw new Error('OFFLINE_RESOLUTION_UNCONFIRMED')
        await signResolution(); await put(`queue:${localId}`, record)
      }
      return record
    }) },
    async acknowledge(localId) { return exclusive(async () => {
      const record = await get(`queue:${localId}`); if (!record) throw new Error('OFFLINE_RESOLUTION_UNAVAILABLE')
      await verify(record)
      if (record.resolution?.phase !== 'cancelled') throw new Error('OFFLINE_RESOLUTION_UNCONFIRMED')
      record.resolution = { ...record.resolution, phase: 'reconciled', acknowledgement: 'Operator confirms customer/payment or physical cash/count reconciliation outside server posting; prior issued records remain unchanged', acknowledgedAt: new Date(now()).toISOString() }
      record.resolutionSignature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', (await keyPair()).signing, bytes(record.resolution))))
      await put(`queue:${localId}`, record); return record
    }) },
    async sync(execute, isCurrent = () => true, onChange = () => {}) { return exclusive(async () => {
      // Hold a Web Lock across network calls. A terminated tab releases it; replay uses the SAME envelope.
      for (const record of await listUnlocked()) {
        if (!isCurrent()) break
        if (record.state === 'synced' || record.resolution?.phase === 'reconciled') continue
        await verify(record)
        if (record.state === 'failed') break // A failed sale is a FIFO barrier, including before shift close.
        try {
          await verify(record); record.state = 'syncing'; await put(`queue:${record.envelope.localId}`, record); onChange(record)
          if (!isCurrent()) { record.state = 'unsynced'; await put(`queue:${record.envelope.localId}`, record); break }
          record.result = await execute(record.envelope.command)
          record.state = 'synced'; record.error = null
        } catch (error) {
          record.state = error?.retryable ? 'unsynced' : 'failed'
          record.error = error?.code || 'OFFLINE_REPLAY_REJECTED'
        }
        await put(`queue:${record.envelope.localId}`, record); onChange(record)
        if (record.state !== 'synced') break
      }
      return listUnlocked()
    }) },
    close() { database?.close(); database = undefined; keys = undefined },
  }
}

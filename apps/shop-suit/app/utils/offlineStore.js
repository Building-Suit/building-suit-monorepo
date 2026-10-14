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
  async function listUnlocked() {
    const db = await open(); const all = await request(db.transaction('records').objectStore('records').getAllKeys())
    const records = await Promise.all(all.filter(key => String(key).startsWith('queue:')).map(key => get(key)))
    return records.sort((a, b) => a.sequence - b.sequence)
  }
  async function verify(record) {
    const valid = await crypto.subtle.verify('HMAC', (await keyPair()).signing, new Uint8Array(record.signature), bytes(record.envelope))
    if (!valid || record.envelope.scope !== scope || record.envelope.version !== VERSION) throw new Error('OFFLINE_SIGNATURE_INVALID')
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
      if (existing) { await verify(existing); if (JSON.stringify(existing.envelope.command) !== JSON.stringify(command)) throw new Error('OFFLINE_ID_REUSED'); return existing }
      const all = await listUnlocked()
      if (all.some(record => record.envelope.command.kind === 'close' && record.state !== 'synced')) throw new Error('OFFLINE_CLOSE_PENDING')
      if (all.filter(record => record.state !== 'synced').length >= MAX_PENDING) throw new Error('OFFLINE_QUEUE_FULL')
      const envelope = { version: VERSION, scope, localId, createdAt: new Date(now()).toISOString(), command }
      const signature = Array.from(new Uint8Array(await crypto.subtle.sign('HMAC', (await keyPair()).signing, bytes(envelope))))
      const record = { envelope, signature, sequence: Math.max(0, ...all.map(record => record.sequence)) + 1, state: 'unsynced', error: null, result: null }
      await put(`queue:${localId}`, record); return record
    }) },
    list: () => exclusive(listUnlocked),
    async retry(localId) { return exclusive(async () => {
      const record = await get(`queue:${localId}`); if (!record || record.state !== 'failed') return
      await verify(record); record.state = 'unsynced'; record.error = null; await put(`queue:${localId}`, record)
    }) },
    async sync(execute, isCurrent = () => true, onChange = () => {}) { return exclusive(async () => {
      // Hold a Web Lock across network calls. A terminated tab releases it; replay uses the SAME envelope.
      for (const record of await listUnlocked()) {
        if (!isCurrent()) break
        if (record.state === 'synced') continue
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

// Cloud browser evidence for persistence/replay mechanics, not physical-device or real-auth UAT.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const source = await readFile(new URL('../../app/utils/offlineStore.js', import.meta.url), 'utf8')
const server = createServer((req, res) => {
  res.setHeader('content-type', req.url === '/store.js' ? 'text/javascript' : 'text/html')
  res.end(req.url === '/store.js' ? source : '<!doctype html><title>Offline counter fixture</title>')
})
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', args: ['--no-sandbox'] })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  const url = `http://127.0.0.1:${server.address().port}`
  await page.goto(url)
  const load = async page => page.evaluate(async () => {
    const { createOfflineStore } = await import('/store.js')
    window.makeStore = createOfflineStore
    window.store = createOfflineStore({ scope: 'local:owner:shop:location' })
  })
  await load(page)
  await context.setOffline(true)
  assert.equal(await page.evaluate(() => navigator.onLine), false)
  const first = await page.evaluate(() => window.store.enqueue({ kind: 'sale', args: { request: 'stable-1', amount: 20 } }, 'local-1'))
  assert.equal(first.state, 'unsynced')
  assert.equal(first.envelope.localId, 'local-1')
  // Browser document can remain open offline; restore online to reload the fixture source.
  await context.setOffline(false)
  await page.reload(); await load(page)
  assert.equal((await page.evaluate(() => window.store.list()))[0].envelope.command.args.request, 'stable-1')
  // Unknown server outcome: a committed write whose response is lost must replay identical IDs.
  const replay = await page.evaluate(async () => {
    const effects = new Set(); const ids = []; let lost = true
    const execute = async command => {
      ids.push(command.args.request); effects.add(command.args.request)
      if (lost) { lost = false; throw Object.assign(new Error('lost response'), { retryable: true, code: 'NETWORK' }) }
      return 'invoice-1'
    }
    const first = await window.store.sync(execute)
    const second = await window.store.sync(execute)
    return { first: first[0].state, second: second[0].state, effects: effects.size, ids }
  })
  assert.deepEqual(replay, { first: 'unsynced', second: 'synced', effects: 1, ids: ['stable-1','stable-1'] })
  await page.evaluate(async () => {
    await window.store.enqueue({ kind: 'sale', args: { request: 'stable-2' } }, 'local-2')
    await window.store.enqueue({ kind: 'close', args: { request: 'close-1' } }, 'local-close')
  })
  const failed = await page.evaluate(async () => {
    const calls = []
    await window.store.sync(async command => { calls.push(command.kind); throw Object.assign(new Error('stock conflict'), { code: 'INSUFFICIENT_STOCK' }) })
    let blocked = false
    try { await window.store.enqueue({ kind: 'sale', args: {} }) } catch { blocked = true }
    return { calls, states: (await window.store.list()).map(record => record.state), blocked }
  })
  assert.deepEqual(failed, { calls: ['sale'], states: ['synced','failed','unsynced'], blocked: true })
  const recovered = await page.evaluate(async () => {
    await window.store.retry('local-2')
    const calls = []
    await window.store.sync(async command => { calls.push(command.kind); return command.args.request })
    return { calls, states: (await window.store.list()).map(record => record.state) }
  })
  assert.deepEqual(recovered, { calls: ['sale','close'], states: ['synced','synced','synced'] })
  // Two actual tabs share IndexedDB and a Web Lock; execute once while both attempt replay.
  const tab = await context.newPage(); await tab.goto(url); await load(tab)
  await page.evaluate(() => window.store.enqueue({ kind: 'sale', args: { request: 'tab-1' } }, 'tab-1'))
  const concurrent = await Promise.all([page,tab].map(page => page.evaluate(async () => {
    let calls = 0
    await window.store.sync(async () => { ++calls; await new Promise(resolve => setTimeout(resolve, 30)); return 'invoice-tabs' })
    return calls
  })))
  assert.equal(concurrent.reduce((a,b) => a+b,0), 1)
  const security = await page.evaluate(async () => {
    const isolated = window.makeStore({ scope: 'other-user:shop:location' })
    const other = await isolated.list(); isolated.close()
    const db = await new Promise((resolve,reject) => { const req = indexedDB.open('bs-shop-pos-v1:local:owner:shop:location'); req.onsuccess = () => resolve(req.result); req.onerror = reject })
    const raw = await new Promise(resolve => { const req = db.transaction('records').objectStore('records').get('queue:local-1'); req.onsuccess = () => resolve(req.result) })
    const keys = await new Promise(resolve => { const req = db.transaction('keys').objectStore('keys').get('local'); req.onsuccess = () => resolve(req.result) })
    db.close()
    return { other: other.length, plain: JSON.stringify(raw).includes('stable-1'), extractable: keys.encryption.extractable || keys.signing.extractable }
  })
  assert.deepEqual(security, { other: 0, plain: false, extractable: false })
  const ttl = await page.evaluate(async () => {
    let now = 0
    const ttl = window.makeStore({ scope: 'ttl', now: () => now })
    await ttl.cache('catalog', { items: [{ id: 'p1' }] })
    const hit = await ttl.cached('catalog'); now = 12 * 60 * 60 * 1000 + 1
    const expired = await ttl.cached('catalog'); ttl.close()
    return { hit: hit.items.length, expired }
  })
  assert.deepEqual(ttl, { hit: 1, expired: null })
  const sameId = await page.evaluate(async () => {
    try { await window.store.enqueue({ kind: 'sale', args: { request: 'changed' } }, 'local-1'); return false } catch (error) { return error.message }
  })
  assert.equal(sameId, 'OFFLINE_ID_REUSED')
  const reconciliation = await page.evaluate(async () => {
    await window.store.enqueue({ kind: 'sale', args: { request: 'rejected' } }, 'rejected')
    await window.store.enqueue({ kind: 'sale', args: { request: 'following' } }, 'following')
    await window.store.sync(async () => { throw Object.assign(new Error('drawer closed'), { code: 'OFFLINE_SHIFT_CONFLICT' }) })
    let requestId; let lost = true
    const cancel = async (_command, resolution) => {
      requestId ??= resolution.requestId
      if (requestId !== resolution.requestId) throw new Error('resolution ID changed')
      if (lost) { lost = false; throw new Error('lost cancellation response') }
      return { state: 'cancelled', resolutionRequestId: requestId }
    }
    try { await window.store.reconcile('rejected', cancel) } catch { /* simulate a lost cancellation response */ }
    await window.store.reconcile('rejected', cancel)
    let callsBeforeAcknowledgement = 0
    await window.store.sync(async () => { callsBeforeAcknowledgement++; return 'unexpected' })
    const envelopeBefore = JSON.stringify((await window.store.list()).find(record => record.envelope.localId === 'rejected').envelope)
    await window.store.acknowledge('rejected')
    const calls = []
    await window.store.sync(async command => { calls.push(command.args.request); return command.args.request })
    const rejected = (await window.store.list()).find(record => record.envelope.localId === 'rejected')
    await window.store.enqueue({ kind: 'sale', args: { request: 'already-issued' } }, 'already-issued')
    const issued = await window.store.reconcile('already-issued', async () => ({ state: 'synced', invoiceId: 'existing-receipt' }))
    return { callsBeforeAcknowledgement, calls, unchanged: JSON.stringify(rejected.envelope) === envelopeBefore, state: rejected.state, resolution: rejected.resolution.phase, issuedState: issued.state, issuedReceipt: issued.result }
  })
  assert.deepEqual(reconciliation, { callsBeforeAcknowledgement: 0, calls: ['following'], unchanged: true, state: 'failed', resolution: 'reconciled', issuedState: 'synced', issuedReceipt: 'existing-receipt' })
  console.log('PASS: browser offline transition; reload persistence; lost-response stable-ID replay; conflict barrier/recovery; concurrent tabs; tenant/user isolation; encryption/non-extractable keys; cache expiry; ID reuse rejection; stable cancellation replay; explicit reconciliation barrier; already-issued resolution.')
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)) }

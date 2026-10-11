import assert from 'node:assert/strict'
import test from 'node:test'
import { downloadText } from '../src/utils/downloadText.js'

test('text downloads retain filename and content and release the object URL after success or failure', () => {
  const create = URL.createObjectURL
  const revoke = URL.revokeObjectURL
  const priorDocument = globalThis.document
  const created = []
  const revoked = []
  const link = { href: '', download: '', click() {} }
  URL.createObjectURL = blob => { created.push(blob); return 'blob:synthetic-text' }
  URL.revokeObjectURL = url => revoked.push(url)
  globalThis.document = { createElement: tag => { assert.equal(tag, 'a'); return link } }
  try {
    downloadText('catalog.csv', 'name,price\nItem,10', 'text/csv;charset=utf-8')
    assert.equal(link.download, 'catalog.csv')
    assert.equal(link.href, 'blob:synthetic-text')
    assert.equal(created[0].type, 'text/csv;charset=utf-8')
    assert.equal(created[0].size, 18)
    assert.deepEqual(revoked, ['blob:synthetic-text'])
    link.click = () => { throw new Error('Download blocked') }
    assert.throws(() => downloadText('second.csv', 'data', 'text/csv'), /Download blocked/)
    assert.equal(revoked.length, 2)
  } finally {
    URL.createObjectURL = create; URL.revokeObjectURL = revoke
    if (priorDocument === undefined) delete globalThis.document; else globalThis.document = priorDocument
  }
})

test('mounted downloads defer cleanup and retain native anchor behavior', () => {
  const prior = { create: URL.createObjectURL, revoke: URL.revokeObjectURL, document: globalThis.document, timer: globalThis.setTimeout }
  const events = [], link = { click: () => events.push('click'), remove: () => events.push('remove') }
  let cleanup
  URL.createObjectURL = () => 'blob:mounted'
  URL.revokeObjectURL = () => events.push('revoke')
  globalThis.document = { createElement: () => link, body: { append: () => events.push('append') } }
  globalThis.setTimeout = (callback, delay) => { cleanup = callback; assert.equal(delay, 1000) }
  try {
    downloadText('ledger.csv', 'data', 'text/csv', { mount: true, cleanupDelayMs: 1000 })
    assert.deepEqual(events, ['append', 'click'])
    assert.equal(link.hidden, true)
    cleanup()
    assert.deepEqual(events, ['append', 'click', 'remove', 'revoke'])
  } finally {
    URL.createObjectURL = prior.create; URL.revokeObjectURL = prior.revoke; globalThis.setTimeout = prior.timer
    if (prior.document === undefined) delete globalThis.document; else globalThis.document = prior.document
  }
})

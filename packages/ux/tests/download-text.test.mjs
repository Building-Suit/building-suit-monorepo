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

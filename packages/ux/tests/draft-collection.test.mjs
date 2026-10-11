import test from 'node:test'
import assert from 'node:assert/strict'
import { replaceDraftRow, appendDraftRow, removeDraftRow } from '../src/utils/draftCollection.ts'
test('controlled draft edits preserve frozen inputs and reject stale indexes', () => {
 const first = Object.freeze({ id: 'first', amount: '9007199254740993.25' })
 const rows = Object.freeze([first, Object.freeze({ id: 'second', amount: '1' })])
 for (const index of [-1, 2, Number.NaN, 0.5]) { assert.deepEqual(replaceDraftRow(rows, index, { id: 'bad' }), rows); assert.deepEqual(removeDraftRow(rows, index), rows) }
 const changed = replaceDraftRow(rows, 1, { id: 'second', amount: '2' })
 assert.equal(changed[0], first)
 assert.equal(rows[1].amount, '1')
 assert.deepEqual(removeDraftRow(rows, 0, 2), rows)
 assert.equal(removeDraftRow(appendDraftRow(rows, { id: 'third' }), 2, 2).length, 2)
 assert.equal(rows[0].amount, '9007199254740993.25')
})

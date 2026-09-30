import test from 'node:test'
import assert from 'node:assert/strict'
import { receiptAllocations } from '../../app/utils/receiptAllocations.ts'

test('receipt retains allocations from separate server pages without dropping earlier selections', () => {
  const invoices = { first: { outstanding: 100 }, last: { outstanding: 50 } }
  assert.deepEqual(receiptAllocations({ first: 10, last: 20 }, invoices), [
    { invoice_id: 'first', amount: 10 }, { invoice_id: 'last', amount: 20 },
  ])
  assert.deepEqual(receiptAllocations({ first: 0, last: 0.01 }, invoices), [{ invoice_id: 'last', amount: 0.01 }])
})

test('unknown, stale, empty and invalid allocations never form a receipt request', () => {
  for (const amount of [-1, 100.01, 0.001, Infinity, NaN]) {
    assert.equal(receiptAllocations({ invoice: amount }, { invoice: { outstanding: 100 } }), null)
  }
  assert.equal(receiptAllocations({ invoice: 10 }, {}), null)
  assert.equal(receiptAllocations({}, {}), null)
})

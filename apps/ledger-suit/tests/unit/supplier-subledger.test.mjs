import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizePayablesAging } from '../../app/utils/supplierSubledger.ts'

test('payables aging preserves exact bucket sums above JavaScript safe integers', () => {
  const buckets = summarizePayablesAging([
    { aging_bucket: 'current', outstanding_minor: '9007199254740993' },
    { aging_bucket: 'current', outstanding_minor: '9' },
    { aging_bucket: '1_30', outstanding_minor: '100' },
    { aging_bucket: '31_60', outstanding_minor: '200' },
    { aging_bucket: '61_90', outstanding_minor: '300' },
    { aging_bucket: '91_plus', outstanding_minor: '400' },
  ])
  assert.deepEqual(buckets.map(bucket => bucket.amount), ['9007199254741002', '100', '200', '300', '400'])
  assert.equal(buckets.reduce((sum, bucket) => sum + BigInt(bucket.amount), 0n), 9007199254742002n)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { csvCell } from '../src/index.ts'
test('CSV export neutralizes formula text and retains numeric values', () => {
  for (const value of ['=SUM(A1)', '+cmd', '-cmd', '@formula', '  =SUM(A1)']) assert.equal(csvCell(value), `'${value}`)
  assert.equal(csvCell(-25), '-25')
  assert.equal(csvCell('Product 1'), 'Product 1')
  assert.equal(csvCell(null), '')
})

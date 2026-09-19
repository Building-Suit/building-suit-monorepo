import assert from 'node:assert/strict'
import { test } from 'node:test'
import { statementLinesFor, sumStatementAmounts } from '../../app/utils/statementClassification.ts'

test('presentation totals retain bigint precision, subtract contra balances and count each row once', () => {
  const rows = [
    { section: 'asset', statement_line: 'property_equipment', amount_minor: '9223372036854775807' },
    { section: 'asset', statement_line: 'property_equipment', amount_minor: '-2' },
    { section: 'equity', statement_line: 'equity', amount_minor: '9223372036854775805' },
  ]
  assert.equal(sumStatementAmounts(rows, 'asset'), '9223372036854775805')
  assert.equal(sumStatementAmounts(rows, 'property_equipment', 'statement_line'), '9223372036854775805')
  assert.equal(sumStatementAmounts(rows, 'equity'), '9223372036854775805')
  assert.equal(sumStatementAmounts(rows, 'unclassified_asset'), '0')
})

test('balance sheet presentation choices never promote income, expenses or unknown account types', () => {
  assert.deepEqual(statementLinesFor('asset'), ['current_assets', 'property_equipment', 'other_non_current_assets'])
  assert.deepEqual(statementLinesFor('liability'), ['current_liabilities', 'non_current_liabilities'])
  assert.deepEqual(statementLinesFor('equity'), ['equity'])
  for (const type of ['revenue', 'expense', 'unknown']) assert.deepEqual(statementLinesFor(type), [])
})

test('equity presentation subtotal excludes unclassified equity and unclosed profit', () => {
  const rows = ['equity', 'unclassified_equity', 'unclosed_profit'].map(statement_line => ({ section: 'equity', statement_line, amount_minor: '100' }))
  assert.equal(sumStatementAmounts(rows, 'equity'), '300')
  assert.equal(sumStatementAmounts(rows, 'equity', 'statement_line'), '100')
})

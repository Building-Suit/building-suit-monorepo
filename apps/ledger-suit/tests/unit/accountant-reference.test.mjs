import test from 'node:test'
import assert from 'node:assert/strict'
import { journals, expectedClosing } from '../fixtures/accountant-reference.mjs'

const sum = values => values.reduce((total, value) => total + value, 0n)
const sideTotal = (entries, side) => sum(entries.flatMap(j => j.lines.filter(l => l[1] === side).map(l => BigInt(l[2]))))
const signed = line => BigInt(line[2]) * (line[1] === 'debit' ? 1n : -1n)
const closing = Object.fromEntries(Object.keys(expectedClosing).map(account => [account, sum(journals.flatMap(j => j.lines.filter(l => l[0] === account).map(signed)))]))
const cashMovement = journal => sum(journal.lines.filter(l => ['bank', 'cash'].includes(l[0])).map(signed))

test('REF-01: each of the ten reference journals balances; opening and period are distinct', () => {
  assert.equal(journals.length, 10)
  assert.equal(new Set(journals.map(j => j.id)).size, 10)
  for (const journal of journals) {
    for (const line of journal.lines) {
      assert.ok(line[0] in expectedClosing)
      assert.ok(['debit', 'credit'].includes(line[1]))
      assert.match(line[2], /^[1-9]\d*$/)
    }
    assert.equal(sideTotal([journal], 'debit'), sideTotal([journal], 'credit'), journal.id)
  }
  for (const side of ['debit', 'credit']) {
    assert.equal(sideTotal(journals.slice(0, 1), side), 15000000n)
    assert.equal(sideTotal(journals.slice(1), side), 6000000n)
    assert.equal(sideTotal(journals, side), 21000000n)
  }
})

test('REF-01: every closing balance and both net trial-balance sides match the source', () => {
  assert.deepEqual(closing, expectedClosing)
  assert.equal(sum(Object.values(closing).filter(n => n > 0n)), 16500000n)
  assert.equal(-sum(Object.values(closing).filter(n => n < 0n)), 16500000n)
})

test('REF-02: pre-closing profit appears once in equity; contra asset reduces assets', () => {
  const profit = -closing.revenue - closing.costOfSales - closing.rent - closing.depreciation
  const netAssets = closing.bank + closing.cash + closing.customers + closing.inventory + closing.equipment + closing.accumulatedDepreciation
  const liabilities = -closing.suppliers
  const capitalAndResult = -closing.capital + profit
  assert.equal(profit, 200000n)
  assert.equal(netAssets, 14800000n)
  assert.equal(liabilities, 1700000n)
  assert.equal(capitalAndResult, 13100000n)
  assert.equal(netAssets, liabilities + capitalAndResult)
})

test('REF-03: opening cash plus external flows equals closing cash, excluding transfer and depreciation', () => {
  const openingCash = cashMovement(journals[0])
  const flow = category => sum(journals.filter(j => j.cashFlow === category).map(cashMovement))
  assert.equal(openingCash, 10000000n)
  assert.equal(flow('operating'), -500000n)
  assert.equal(flow('investing'), -1200000n)
  assert.equal(flow('financing'), 0n)
  assert.equal(flow('internal'), 0n)
  assert.equal(flow('noncash'), 0n)
  assert.equal(cashMovement(journals.find(j => j.id === 'depreciation')), 0n)
  const net = flow('operating') + flow('investing') + flow('financing')
  assert.equal(net, -1700000n)
  assert.equal(closing.bank + closing.cash, 8300000n)
  assert.equal(openingCash + net, closing.bank + closing.cash)
})

// Offline evidence validation only. Does not execute or certify the application.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const root = new URL('../docs/accountant-system/', import.meta.url)
const read = path => readFileSync(new URL(path, root), 'utf8')
const matrix = JSON.parse(read('v2-acceptance/requirements.json'))
const requirements = [...read('v2-baseline/Ledger_Suit_V2_Requirements.md').matchAll(/\*\*([A-Z]+-\d{2}):\*\*/g)].map(match => match[1]).sort()
assert.equal(requirements.length, 138)
assert.deepEqual(matrix.requirements.map(row => row.id).sort(), requirements)
for (const row of matrix.requirements) {
  assert.ok(row.criterion.trim(), `${row.id}: missing measurable criterion`)
  assert.ok(['implemented', 'partial', 'missing', 'unverified'].includes(row.code_implemented))
  assert.ok(['passed', 'partial', 'failed', 'unverified'].includes(row.tests_passed))
  assert.ok(['verified', 'unverified'].includes(row.deployed))
  assert.ok(['accepted', 'rejected', 'pending'].includes(row.accountant_accepted))
  // This local review has neither deployment nor accountant evidence.
  assert.equal(row.deployed, 'unverified')
  assert.equal(row.accountant_accepted, 'pending')
}
const fixture = JSON.parse(read('v2-acceptance/expected-balances.json'))
const expected = fixture.expected
const balances = {}
let total = 0n
let period = 0n
let opening = 0n
for (const event of fixture.events) {
  assert.match(event.amount_minor, /^[1-9]\d*$/)
  const amount = BigInt(event.amount_minor)
  balances[event.debit] = (balances[event.debit] ?? 0n) + amount
  balances[event.credit] = (balances[event.credit] ?? 0n) - amount
  total += amount
  if (event.date < fixture.from) opening += amount
  else if (event.date <= fixture.to) period += amount
  else assert.fail('Worksheet includes a posting outside its cutoff')
}
assert.equal(new Set(fixture.events.map(event => event.id)).size, fixture.events.length)
assert.equal(fixture.events.length, expected.journals)
assert.equal(fixture.events.length * 2, expected.entries)
for (const side of ['debit', 'credit']) {
  assert.equal(total.toString(), expected[`posted_${side}s_minor`])
  assert.equal(opening.toString(), expected[`opening_${side}_minor`])
  assert.equal(period.toString(), expected[`period_${side}_minor`])
  const closing = Object.values(balances).reduce((sum, value) => sum + (side === 'debit' ? (value > 0n ? value : 0n) : (value < 0n ? -value : 0n)), 0n)
  assert.equal(closing.toString(), expected[`closing_${side}_minor`])
}
assert.deepEqual(Object.fromEntries(Object.entries(balances).map(([key, value]) => [key, value.toString()])), expected.account_balances)
const profit = -balances.revenue - balances.expense - balances.depreciation - balances.fee
const assets = balances.bank + balances.ar + balances.equipment + balances.accumulated
assert.equal(profit.toString(), expected.profit_minor)
assert.equal(assets.toString(), expected.assets_minor)
assert.equal((-balances.ap).toString(), expected.liabilities_minor)
assert.equal((-balances.capital).toString(), expected.capital_minor)
assert.equal(assets, -balances.ap - balances.capital + profit)
const cashFlows = { operating: 0n, investing: 0n, financing: 0n }
for (const event of fixture.events.filter(event => event.date >= fixture.from)) {
  const cash = (event.debit === 'bank' ? 1n : event.credit === 'bank' ? -1n : 0n) * BigInt(event.amount_minor)
  const section = event.id === 'equipment' ? 'investing' : event.id === 'capital' ? 'financing' : 'operating'
  cashFlows[section] += cash
}
for (const [section, amount] of Object.entries(cashFlows)) assert.equal(amount.toString(), expected[`${section}_cash_minor`])
assert.equal(BigInt(expected.opening_cash_minor) + Object.values(cashFlows).reduce((sum, value) => sum + value, 0n), balances.bank)
assert.equal(balances.bank.toString(), expected.closing_cash_minor)
assert.equal(fixture.accountant.verdict, 'pending')
assert.equal(fixture.accountant.signed_artifact, null)
console.log('PASS: 138 distinct requirement states; independent 8-journal worksheet reconciles exactly. Database, browser, migration, and accountant acceptance remain unverified.')

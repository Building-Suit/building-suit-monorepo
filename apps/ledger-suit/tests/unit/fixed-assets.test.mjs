import assert from 'node:assert/strict'
import test from 'node:test'
import { assetTotals, calculateDepreciationSchedule } from '../../app/utils/fixedAssets.ts'

test('straight-line daily proration allocates the exact approved basis', () => {
  const rows = calculateDepreciationSchedule({ start: '2028-01-16', carryingMinor: 120000n, residualMinor: 12000n, usefulLifeMonths: 12, method: 'straight_line' })
  assert.equal(rows[0].periodStart, '2028-01-16')
  assert.equal(rows.at(-1).periodEnd, '2029-01-15')
  assert.equal(rows.reduce((sum, row) => sum + row.amountMinor, 0n), 108000n)
  assert.equal(rows.at(-1).closingBookValueMinor, 12000n)
})

test('declining balance is daily-prorated and forces the approved residual at useful-life end', () => {
  const rows = calculateDepreciationSchedule({ start: '2027-03-10', carryingMinor: 500000n, residualMinor: 50000n, usefulLifeMonths: 36, method: 'declining_balance', decliningRateBasisPoints: 2000 })
  assert.equal(rows.reduce((sum, row) => sum + row.amountMinor, 0n), 450000n)
  assert.equal(rows.at(-1).closingBookValueMinor, 50000n)
  assert.ok(rows.every(row => row.amountMinor > 0n))
})

test('schedule and register summaries retain exact bigint minor units', () => {
  const basis = 900719925474099300n
  const rows = calculateDepreciationSchedule({ start: '2028-01-01', carryingMinor: basis, residualMinor: 300n, usefulLifeMonths: 2, method: 'straight_line' })
  assert.equal(rows.reduce((sum, row) => sum + row.amountMinor, 0n), basis - 300n)
  assert.deepEqual(assetTotals([{ status: 'active', cost_minor: '1000', accumulated_minor: '250', nbv_minor: '750' }, { status: 'corrected', cost_minor: '999', accumulated_minor: '0', nbv_minor: '999' }]), { cost: 1000n, accumulated: 250n, nbv: 750n })
})

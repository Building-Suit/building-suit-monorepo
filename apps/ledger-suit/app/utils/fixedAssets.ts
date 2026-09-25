export type AssetMethod = 'straight_line' | 'declining_balance'
export interface AssetAccount { id: string, name: string, type: string, subtype: string, currency: string, role: string, normal_balance: string, contra_account_id: string | null }
export interface AssetJournal { id: string, date: string, description: string | null, reference: string | null, currency: string }
export interface FixedAssetRow { id: string, code: string, name: string, status: 'active' | 'disposed' | 'corrected', currency: string, acquisition_date: string, in_service_date: string, cost_minor: string, accumulated_minor: string, nbv_minor: string, residual_minor: string, method: AssetMethod, life_months: number, rate_basis_points: number | null, acquisition_transaction_id: string, cost_account_id: string, accumulated_account_id: string, expense_account_id: string, impairment_account_id: string, gain_loss_account_id: string, disposal_date: string | null }
export interface AssetScheduleRow { id: string, asset_id: string, period_start: string, period_end: string, amount_minor: string, closing_nbv_minor: string, status: 'scheduled' | 'posted' | 'reversed', transaction_id: string | null, replaces_schedule_id: string | null }
export interface AssetEventRow { id: string, asset_id: string, kind: string, date: string, amount_minor: string | null, transaction_id: string | null, schedule_id: string | null, reverses_event_id: string | null, reason: string, payload: unknown, created_at: string }
export interface AssetReconciliationRow { account_id: string, kind: 'cost' | 'accumulated_depreciation', register_minor: string, gl_minor: string, variance_minor: string }
export interface FixedAssetWorkspace { as_of_date: string, accounts: AssetAccount[], acquisition_journals: AssetJournal[], assets: FixedAssetRow[], schedule: AssetScheduleRow[], events: AssetEventRow[], reconciliation: AssetReconciliationRow[] }

const dayMs = 86_400_000
const parseDate = (value: string) => new Date(`${value}T00:00:00Z`)
const iso = (date: Date) => date.toISOString().slice(0, 10)
const days = (start: Date, end: Date) => Math.round((end.getTime() - start.getTime()) / dayMs) + 1
const addMonths = (date: Date, months: number) => {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1))
  const finalDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  return new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(date.getUTCDate(), finalDay)))
}
const monthEnd = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
const roundDiv = (numerator: bigint, denominator: bigint) => (numerator + denominator / 2n) / denominator

/** Independent deterministic mirror of the approved SQL schedule math. */
export function calculateDepreciationSchedule(input: { start: string, carryingMinor: bigint, residualMinor: bigint, usefulLifeMonths: number, method: AssetMethod, decliningRateBasisPoints?: number }) {
  const start = parseDate(input.start)
  const finish = new Date(addMonths(start, input.usefulLifeMonths).getTime() - dayMs)
  const totalDays = days(start, finish)
  let cursor = start
  let carrying = input.carryingMinor
  let remaining = carrying - input.residualMinor
  const rows: { periodStart: string, periodEnd: string, amountMinor: bigint, closingBookValueMinor: bigint }[] = []
  while (cursor <= finish && remaining > 0n) {
    const end = monthEnd(cursor) < finish ? monthEnd(cursor) : finish
    const partDays = days(cursor, end)
    let amount: bigint
    if (end.getTime() === finish.getTime()) amount = remaining
    else if (input.method === 'straight_line') amount = roundDiv((input.carryingMinor - input.residualMinor) * BigInt(partDays), BigInt(totalDays))
    else {
      const yearDays = Date.UTC(cursor.getUTCFullYear() + 1, 0, 1) - Date.UTC(cursor.getUTCFullYear(), 0, 1) === 366 * dayMs ? 366 : 365
      amount = roundDiv(remaining * BigInt(input.decliningRateBasisPoints ?? 0) * BigInt(partDays), 10_000n * BigInt(yearDays))
      if (amount < 1n) amount = 1n
    }
    if (amount > remaining) amount = remaining
    carrying -= amount
    remaining -= amount
    rows.push({ periodStart: iso(cursor), periodEnd: iso(end), amountMinor: amount, closingBookValueMinor: carrying })
    cursor = new Date(end.getTime() + dayMs)
  }
  return rows
}

export function assetTotals(assets: FixedAssetRow[]) {
  return assets.filter(asset => asset.status !== 'corrected').reduce((sum, asset) => ({
    cost: sum.cost + BigInt(asset.cost_minor), accumulated: sum.accumulated + BigInt(asset.accumulated_minor), nbv: sum.nbv + BigInt(asset.nbv_minor),
  }), { cost: 0n, accumulated: 0n, nbv: 0n })
}

export type DimensionKind = 'cost_center' | 'project'
export interface DimensionValueRow { id: string, kind: DimensionKind, code: string, name: string, description: string | null, status: 'active' | 'inactive', created_at: string, updated_at: string, archived_at: string | null }
export interface DimensionAccountRow { id: string, code: string | null, name: string, role: string, archived: boolean }
export interface DimensionPolicyRow { account_id: string, kind: DimensionKind, requirement: 'optional' | 'required' }
export interface DimensionWorkspace { values: DimensionValueRow[], accounts: DimensionAccountRow[], policies: DimensionPolicyRow[], legacy_uncontrolled_count: number, allocation_count: number }
export interface DimensionReportGroup { dimension_value_id: string | null, code: string, name: string, opening_debit_minor: string, opening_credit_minor: string, period_debit_minor: string, period_credit_minor: string, closing_debit_minor: string, closing_credit_minor: string, entry_count: number }
export interface DimensionReportDetail { entry_id: string, transaction_id: string, date: string, account_code: string | null, account_name: string, side: 'debit' | 'credit', amount_minor: string, base_amount_minor: string, dimension_value_id: string | null, description: string | null, reference: string | null }
export interface DimensionReport { groups: DimensionReportGroup[], details: DimensionReportDetail[], reconciliation_difference: Record<'opening_debit_minor' | 'opening_credit_minor' | 'period_debit_minor' | 'period_credit_minor', string> }

export function dimensionReportReconciles(report: DimensionReport | null) {
  return Boolean(report) && Object.values(report!.reconciliation_difference).every(value => BigInt(value) === 0n)
}

export function allocationTotalMatches(lineAmount: bigint, rows: Array<{ amountMinor: bigint }>) {
  return rows.length > 0 && rows.reduce((sum, row) => sum + row.amountMinor, 0n) === lineAmount
}

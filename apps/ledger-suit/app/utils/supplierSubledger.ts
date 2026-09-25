export type ApKind = 'bill' | 'payment' | 'credit' | 'adjustment'
export type ApAgingBucket = 'current' | '1_30' | '31_60' | '61_90' | '91_plus'
export const apAgingBuckets: ApAgingBucket[] = ['current', '1_30', '31_60', '61_90', '91_plus']

export interface ApOpenItem {
  bill_id: string
  supplier_id: string
  supplier_name: string
  control_account_id: string
  reference: string
  issue_date: string
  due_date: string
  original_minor: string
  outstanding_minor: string
  aging_bucket: ApAgingBucket
}

export interface ApMovement {
  id: string
  kind: ApKind | 'reversal'
  date: string
  reference: string
  effect_minor: string
  balance_minor: string
  transaction_id: string
  reason: string | null
  reverses_document_id: string | null
  reversed: boolean
}

export interface ApStatement {
  opening_minor: string
  bills_minor: string
  payments_minor: string
  adjustments_minor: string
  closing_minor: string
  movements: ApMovement[]
}

export interface ApWorkspace {
  suppliers: { id: string, name: string, archived: boolean }[]
  accounts: { id: string, name: string, type: string, subtype: string, role: string, subledger: string | null }[]
  items: ApOpenItem[]
  statement: ApStatement | null
  reconciliation: { control_account_id: string, account_name: string, gl_balance_minor: string, subledger_balance_minor: string, variance_minor: string, status: string, explanation_reason: string | null }[]
  legacy: { commitment_id: string, reference: string, currency_code: string, original_minor: string, cash_settled_minor: string, legacy_open_minor: string, treatment: string }[]
}

export function summarizePayablesAging(items: ApOpenItem[]) {
  return apAgingBuckets.map(bucket => ({
    bucket,
    amount: items.filter(item => item.aging_bucket === bucket).reduce((total, item) => total + BigInt(item.outstanding_minor), 0n).toString(),
  }))
}

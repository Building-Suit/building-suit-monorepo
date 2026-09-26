export interface InventorySource {
  id: string
  source_key: string
  actor_id: string
  effective_from: string
  control_account_id: string
  cogs_account_id: string
  offset_account_id: string
  inventory_minor: string
  cogs_minor: string
  inventory_gl_minor: string
  cogs_gl_minor: string
  cogs_closing_minor: string
  inventory_variance_minor: string
  cogs_variance_minor: string
  source_inventory_snapshot_minor: string | null
  source_cogs_snapshot_minor: string | null
  source_inventory_variance_minor: string | null
  source_cogs_variance_minor: string | null
  latest_sequence: string | null
  status: 'awaiting_source' | 'reconciled' | 'unreconciled'
}
export interface InventoryFact {
  id: string
  source_id: string
  sequence: string
  movement_id: string
  movement_version: number
  valuation_id: string
  valuation_version: number
  costing_method: string
  policy_version: string
  kind: 'purchase' | 'increase' | 'decrease' | 'customer_return' | 'supplier_return' | 'adjustment' | 'revaluation' | 'correction'
  effective_date: string
  accounting_date: string
  stock_quantity_after: string
  inventory_delta_minor: string
  cogs_delta_minor: string
  related_fact_id: string | null
  reason: string | null
  transaction_id: string
  journal_reference: string
}
export interface InventoryWorkspace {
  as_of_date: string
  currency: string
  sources: InventorySource[]
  facts: InventoryFact[]
  accounts: { id: string, name: string, code: string | null, type: string, subtype: string, role: string, subledger: string | null }[]
  total: number
  offset: number
  limit: number
}

export function inventoryReconciles(source: InventorySource): boolean {
  return source.status === 'reconciled'
    && [source.inventory_variance_minor, source.cogs_variance_minor,
      source.source_inventory_variance_minor, source.source_cogs_variance_minor]
      .every(value => value !== null && /^-?\d+$/.test(value) && BigInt(value) === 0n)
}

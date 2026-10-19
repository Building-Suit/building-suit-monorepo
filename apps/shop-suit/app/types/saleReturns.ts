export interface SaleReturnLineInput { lineId: string; quantity: number; disposition: 'resellable' | 'damaged' | 'service' }
export interface SaleReturnPlan {
  version: 1; currency: string; total: number; tax: number; net: number; dueBefore: number; debtReduction: number; refundDue: number; dueAfter: number
  lines: (SaleReturnLineInput & { total: number; tax: number; net: number; cumulativeQuantity: number; originalSnapshot: Record<string, unknown> })[]
  allocations: { allocationId: string; paymentId: string; method: string; amount: number }[]
  originalDocument: { invoiceId: string; invoiceNumber: string; issuedAt: string; receiptId: string | null; etaSourceAvailable: boolean }
}
export interface SaleReturnRecord {
  version: 1; actorName?: string; id: string; invoice_id: string; currency: string; total: number; tax: number; net: number; debt_reduction: number; refund_due: number; due_after: number; reason: string; actor_profile_id: string; created_at: string
  original_document: SaleReturnPlan['originalDocument']
  lines: { line_id: string; quantity: number; disposition: string; total: number; net: number; tax: number; original_snapshot: Record<string, unknown> }[]
  refunds: { id: string; allocation_id: string; payment_id: string; method: string; amount: number; state: 'pending' | 'failed' | 'completed'; events: { id: string; state: string; operation: string; reference: string; reason: string; created_at: string; actor_profile_id: string }[] }[]
}
export interface SaleReturnContext {
  version: 1; canReturn: boolean; supported: boolean; due: number; currency: string; totalCount: number
  lines: { id: string; name: string; itemType: 'product' | 'service'; quantity: number; remaining: number }[]; history: SaleReturnRecord[]
}

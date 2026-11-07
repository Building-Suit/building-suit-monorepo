export type BsPracticeMoneyLabel = 'title' | 'notice' | 'refresh' | 'billing' | 'account' | 'charge' | 'collected' | 'refunded' | 'net' | 'reserved' | 'refundReserved' | 'available' | 'balanceHelp' | 'prepareCollection' | 'prepareRefund' | 'amount' | 'reason' | 'save' | 'cancel' | 'readonly' | 'unknown' | 'retry' | 'empty' | 'loading' | 'denied' | 'history' | 'kind' | 'status' | 'receipt' | 'original' | 'recorded' | 'accept' | 'reject' | 'reconcile' | 'cancelPending' | 'refund' | 'previous' | 'next' | 'review' | 'confirmMessage' | 'confirm'
export interface BsPracticeMoneyForm { amount: string; reason: string }
export interface BsPracticeMoneyRow { id: string; revision: number; kind: string; state: string; amount: string; receipt: string; original: string; reason: string; recorded: string; refundable: boolean; originalEntryId: string | null; dispatch: boolean; reconcile: boolean; cancel: boolean }
export interface BsPracticeMoneyView {
 source: string; clinic: string; charge: string; collected: string; refunded: string; net: string; reserved: string; refundReserved: string; available: string
 ready: boolean; loading: boolean; pending: boolean; uncertain: boolean; denied: boolean; readonly: boolean; canCollect: boolean; blocked: boolean; error: string | null
 rows: BsPracticeMoneyRow[]; page: number; previous: boolean; next: boolean
 editor: { visible: boolean; title: string; original: string | null; dirty: boolean; disabled: boolean; review: boolean }
}

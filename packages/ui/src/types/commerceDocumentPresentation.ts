export interface BsCommerceDocumentForm { amount: number; date: string; method: string; reference: string; notes: string; reason: string; quantities: Record<string, number> }
export interface BsCommerceCorrectionForm { date: string; reference: string; reason: string }
export interface BsCommerceDocumentLine { id: string; name: string; description: string; quantity: string; price: string; total: string; discount: string; available: string; returnMaximum: number; returnStep?: number; returnUnit?: string }
export interface BsCommerceDocumentEvent { id: string; title: string; description: string; reason: string; canReverse: boolean; canRefund: boolean }
export interface BsCommerceDocumentMovement { id: string; date: string; name: string; quantity: string; cost: string; batch: string; to: string }
export interface BsCommerceDocumentView {
  receiptImageError?: boolean
  serviceAction?: { label: string; to: string }
  amountBreakdown?: { label: string; value: string }[]
  orderDiscount?: { label: string; canEdit: boolean; pending: boolean; dirty: boolean }

  relatedAction?: { label: string; to: string }
  loading: boolean; error: boolean; found: boolean; title: string; subtitle: string; status: string; actionError: string; success: string; notice: string
  party: { name: string; to: string; phone: string; email: string; address: string }
  detail: { date: string; created: string; notes: string; total: string; balance: string; discount: string; paid: string; due: string; settlement: string }
  showCreated: boolean; showDiscount: boolean; showNotes: boolean; showPaid: boolean; showDue: boolean; showAvailable: boolean; showPayments: boolean; showCredits: boolean; inventoryTable: boolean
  canPayment: boolean; canCredit: boolean; canReturn: boolean; canIssue: boolean; issuing: boolean; editTo: string; receiptTo: string; canShare: boolean; sharing: boolean
  lines: BsCommerceDocumentLine[]; events: BsCommerceDocumentEvent[]; credits: BsCommerceDocumentEvent[]; movements: BsCommerceDocumentMovement[]
  correction: { visible: boolean; loading: boolean; error: boolean; canCorrect: boolean; title: string; description: string; reason: string; refunded: string; restored: string; notice: string; fullOnly: string }
  dialog: { title: string; dirty: boolean; pending: boolean; maximum: number | undefined; showAmount: boolean; showMethod: boolean; showReference: boolean; showNotes: boolean; showReason: boolean; showQuantities: boolean; total: string }
  correctionDialog: { dirty: boolean; pending: boolean; warning: string }
}
export interface BsCommerceDocumentCopy {
  downloadReceipt?: string
  back: string; loading: string; loadError: string; retry: string; notFound: string; party: string; date: string; created: string; notes: string; total: string; balance: string; discount: string; paid: string; due: string; settlement: string
  lines: string; item: string; quantity: string; price: string; available: string; payments: string; credits: string; inventory: string; empty: string; noInventory: string; noParty: string; details: string; batch: string; open: string
  recordPayment: string; recordCredit: string; recordReturn: string; reverse: string; refund: string; issue: string; issuing: string; edit: string; reprint: string; share: string
  amount: string; method: string; reference: string; reason: string; save: string; cancel: string; correction: string; correctionLoading: string; correctionError: string; refunded: string; restored: string; correct: string; correctionDialog: string; correctionSubmit: string
}

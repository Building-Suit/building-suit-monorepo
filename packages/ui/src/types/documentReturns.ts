export interface BsReturnForm { cutApprovals?: Record<string, boolean>; quantities: Record<string, number>; dispositions: Record<string, string>; reason: string }
export interface BsRefundRecordForm { reference: string; reason: string }
export interface BsDocumentReturnsCopy { approveCut?: string; approvalHelp?: string;
  title: string; action: string; loading: string; loadError: string; retry: string; unsupported: string; offline: string; policy: string
  item: string; quantity: string; remaining: string; disposition: string; resellable: string; damaged: string; service: string; reason: string
  preview: string; confirm: string; cancel: string; total: string; debt: string; refund: string; due: string; allocations: string
  history: string; empty: string; external: string; cash: string; failed: string; reference: string; record: string; recordNotice: string; uncertain: string; previous: string; next: string
}
export interface BsDocumentReturnsView {
  loading: boolean; error: boolean; supported: boolean; canReturn: boolean; online: boolean; pending: boolean; locked: boolean; dirty: boolean; actionError: string
  lines: { id: string; name: string; remaining: number; quantityStep?: number; approvalRequired?: boolean; canApprove?: boolean; service: boolean }[]
  preview: { total: string; debt: string; refund: string; due: string; allocations: { id: string; label: string; amount: string }[] } | null
  history: { id: string; title: string; detail: string; reason: string; actor: string; lines: { id: string; label: string }[]; refunds: { id: string; label: string; canRecord: boolean; cash: boolean; events: { id: string; label: string }[] }[] }[]
  hasPrevious: boolean; hasNext: boolean
  record: { title: string; locked: boolean; cash: boolean; pending: boolean; dirty: boolean; error: string }
}

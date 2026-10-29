export interface BsSupplierOrderFormLine { key: string; productId: string; name: string; quantity: string; cost: string; unit: string }
export interface BsSupplierOrderForm { vendorId: string; expectedOn: string; notes: string; reason: string; lines: BsSupplierOrderFormLine[] }
export interface BsSupplierOrderOperationForm { reason: string; receivedOn: string; invoiceNumber: string; lines: { id: string; name: string; unit: string; remaining: string; quantity: string; reelTracked: boolean; barcodes: string }[] }
export interface BsSupplierOrderPicker { options: { id: string; name: string }[]; loading: boolean; error: string | null; hasMore: boolean; more: string; retry: string }
export interface BsSupplierOrderLineView { loading: boolean; units: { value: string; label: string }[]; picker: BsSupplierOrderPicker }
export interface BsSupplierOrderRow { id: string; number: string; vendor: string; status: string; expected: string; total: string; date: string }
export interface BsSupplierOrderCopy { title: string; subtitle: string; add: string; edit: string; issue: string; receive: string; cancelOrder: string; print: string; open: string; number: string; vendor: string; status: string; all: string; expected: string; total: string; date: string; search: string; actions: string; noShop: string; retry: string; empty: string; close: string; product: string; quantity: string; cost: string; unit: string; addLine: string; remove: string; notes: string; reason: string; save: string; cancel: string; lines: string; received: string; remaining: string; receiptHistory: string; history: string; invoice: string; invoiceTotal: string; actor: string; receivedOn: string; invoiceNumber: string; barcodes: string }
export interface BsSupplierOrderView {
 available: boolean; loading: boolean; error: string; canCreate: boolean; locked: boolean; statusOptions: { value: string; label: string }[]; total: number
 detail: { title: string; loading: boolean; error: string; actionError: string; status: string; notice: string; fields: { label: string; value: string }[]; canEdit: boolean; canIssue: boolean; canReceive: boolean; canCancel: boolean; canPrint: boolean
  lines: { id: string; name: string; quantity: string; cost: string; total: string; received: string; remaining: string }[]
  receipts: { id: string; invoice: string; to: string; total: string; date: string; reason: string; actor: string }[]; receiptTotal: number
  events: { id: string; action: string; reason: string; actor: string; date: string }[]; historyTotal: number }
 editor: { title: string; dirty: boolean; pending: boolean; error: string; notice: string }
 operation: { title: string; dirty: boolean; pending: boolean; error: string; isReceipt: boolean; summary: string; notice: string }
}

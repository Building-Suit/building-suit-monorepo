import type { BsQuotationPicker } from './tradeQuotationPresentation'
export interface BsTradeOrderRow { id: string; number: string; customer: string; project: string; status: string; total: string; date: string }
export interface BsTradeOrderLine { id: string; name: string; quantity: string; price: string; total: string }
export interface BsTradeOrderEvent { id: string; action: string; reason: string; actor: string; date: string }
export interface BsTradeOrderForm { quotationId: string; reason: string }
export interface BsTradeOrderView {
 available: boolean; loading: boolean; error: string; total: number; pageSize: number; canCreate: boolean; locked: boolean
 editor: { previewFailed: boolean; dirty: boolean; pending: boolean; locked: boolean; error: string; summary: string; existingOrderTo: string }
 reservation: BsOrderReservationView
 funding: BsOrderFundingView
 delivery: BsOrderDeliveryView
 detail: { loading: boolean; error: string; title: string; subtitle: string; status: string; lines: BsTradeOrderLine[]; totals: { label: string; value: string }[]; events: BsTradeOrderEvent[]; eventCount: number }
}
export interface BsTradeOrderCopy { title: string; subtitle: string; add: string; search: string; number: string; customer: string; project: string; status: string; total: string; date: string; actions: string; open: string; quotation: string; reason: string; convert: string; cancel: string; retry: string; empty: string; noShop: string; close: string; lines: string; quantity: string; price: string; history: string; actor: string; event: string; source: string; agreement: string; existing: string }
export type BsOrderQuotationPicker = BsQuotationPicker

export interface BsOrderReservationForm { expiresAt: string; reason: string; lines: { id: string; name: string; quantity: string; loss: string; reelTracked: boolean }[] }
export interface BsOrderReservationView { loading: boolean; error: string; canManage: boolean; locked: boolean; title: string; explanation: string; reserve: string; release: string; expire: string; cancelOrder: string; onHand: string; reserved: string; available: string; own: string; expires: string; loss: string; reason: string; history: string; commandTitle: string; dirty: boolean; pending: boolean; commandError: string; reserveAction: boolean; stock: { id: string; name: string; onHand: string; reserved: string; own: string; available: string }[]; items: { id: string; source: string; quantity: string; status: string; expires: string }[]; total: number; events: BsTradeOrderEvent[]; eventCount: number }

export interface BsOrderFundingForm { allocationId: string; invoiceId: string; amount: string; at: string; method: string; reference: string; reason: string }
export interface BsOrderFundingView {
 title: string; explanation: string; loading: boolean; denied: boolean; error: string; retry: string; locked: boolean; receive: string; apply: string; refund: string; reverse: string
 canReceive: boolean; amount: string; available: string; applied: string; method: string; reference: string; date: string; reason: string; actor: string; actions: string; invoice: string; historyTitle: string; close: string
 summaries: { label: string; value: string }[]
 rows: { id: string; date: string; amount: string; available: string; applied: string; method: string; reference: string; canApply: boolean; canRefund: boolean; canReverse: boolean }[]
 total: number; events: { id: string; action: string; amount: string; date: string; reason: string; actor: string; invoiceTo: string }[]; eventCount: number
 invoicePicker: BsOrderQuotationPicker; methodOptions: { value: string; label: string }[]
 editor: { title: string; dirty: boolean; pending: boolean; error: string; summary: string; explanation: string; needsMethod: boolean; needsInvoice: boolean }
}
export interface BsOrderDeliveryForm { reason: string; applyDeposits: boolean; lines: { id: string; name: string; quantity: string; loss: string; reelTracked: boolean; summary: string }[] }
export interface BsOrderDeliveryView {
 title: string; explanation: string; loading: boolean; error: string; retry: string; locked: boolean; canFulfill: boolean; collect: string; quantity: string; delivered: string; remaining: string; held: string; loss: string; reason: string; invoice: string; date: string; actor: string; total: string; historyTitle: string; close: string; applyDeposits: string; canApplyDeposits: boolean
 rows: { id: string; name: string; ordered: string; delivered: string; remaining: string; held: string }[]
 history: { id: string; invoice: string; invoiceTo: string; total: string; date: string; actor: string; reason: string }[]; eventCount: number
 editor: { dirty: boolean; pending: boolean; error: string }
}

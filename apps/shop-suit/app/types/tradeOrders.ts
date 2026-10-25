import type { QuotationSnapshot } from './tradeQuotations'
import type { MeasurementSnapshot } from './measurement'
export type TradeOrderStatus = 'open' | 'partially_fulfilled' | 'fulfilled' | 'cancelled'
export interface TradeOrderSummary { id: string; order_number: string; status: TradeOrderStatus; currency: string; total_amount: string; revision: number; quotation_id: string; quotation_version: number; customer_name: string; project_reference: string | null; created_at: string }
export interface OrderQuotationChoice { id: string; name: string; currency: string; total_amount: string; project_reference: string | null }
export interface OrderQuotationPreview { id: string; number: string; revision: number; version: number; status: string; currency: string; total: string; customerName: string; projectReference: string | null; orderId: string | null }
export interface TradeOrderDetail { record: Omit<TradeOrderSummary, 'customer_name' | 'project_reference'> & { agreed_snapshot: QuotationSnapshot }; lines: { id: string; line_order: number; item_name: string; item_type: string; product_id: string | null; service_id: string | null; quantity: string; unit_price: string; discount_amount: string; measurement_snapshot: MeasurementSnapshot | null }[]; events: { id: string; action: string; reason: string; actor_name: string | null; created_at: string }[]; eventCount: number; historyPage: number }
export interface TradeOrderContext { items: (TradeOrderSummary | OrderQuotationChoice)[]; total: number; page: number; pageSize: number; detail: TradeOrderDetail | null; quotation: OrderQuotationPreview | null; canManage: boolean }

export type OrderReservationAction = 'reserve' | 'release' | 'expire' | 'cancel'
export interface OrderReservationStock { lineId: string; productId: string; name: string; unitCode: string; unitNameEn: string; unitNameAr: string; orderedQuantity: string; fulfilledQuantity?: string; remainingQuantity?: string; onHand: string; reserved: string; orderReserved: string; available: string; reelTracked: boolean }
export interface OrderReservationContext { items: { id: string; line_id: string; product_id: string; reel_id: string | null; barcode: string | null; expires_at: string; created_at: string; quantity: string; sale_quantity: string; remaining_quantity: string; remaining_sale_quantity: string; status: string }[]; total: number; page: number; pageSize: number; history: { id: string; action: string; quantity_change: string; sale_quantity_change: string; reason: string; actor_name: string | null; created_at: string }[]; historyTotal: number; historyPage: number; stock: OrderReservationStock[]; revision: number; status: TradeOrderStatus; serverNow: string; canManage: boolean }

export type OrderDepositAction = 'receive' | 'apply' | 'refund' | 'reverse'
export type OrderPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
export interface OrderFundingContext {
 items: { id: string; payment_id: string; amount: string; available: string; applied: string; method: OrderPaymentMethod; reference: string | null; paid_at: string; created_at: string }[]
 total: number; page: number; pageSize: number
 history: { id: string; kind: string; amount: string; reason: string; reference: string | null; effective_at: string; allocation_id: string; invoice_id: string | null; refund_payment_id: string | null; actor_name: string | null }[]
 historyTotal: number; historyPage: number
 invoices: { id: string; invoice_number: string; issued_at: string; outstanding: string }[]
 invoiceTotal: number; invoicePage: number; revision: number; status: TradeOrderStatus; currency: string; depositsNet: string; unapplied: string; depositCapacity: string
 canReceive: boolean; canRefund: boolean; canReverse: boolean
}
export interface OrderDeliveryContext {
 lines: { id: string; name: string; itemType: 'product' | 'service'; unitCode: string; packageName: string | null; orderedQuantity: string; deliveredQuantity: string; remainingQuantity: string; heldQuantity: string; heldLoss: string; reelTracked: boolean; allowSplit: boolean }[]
 history: { id: string; invoice_id: string; invoice_number: string; invoice_status: string; total: string; reason: string; created_at: string; actor_name: string | null }[]
 total: number; page: number; pageSize: number; revision: number; status: TradeOrderStatus; currency: string; canFulfill: boolean; canApplyDeposits: boolean
}

import type { MeasurementSnapshot, SaleLineInput } from './measurement'
export type QuotationAction = 'save' | 'revise' | 'issue' | 'accept' | 'reject' | 'expire' | 'cancel'
export type QuotationStatus = 'draft' | 'issued' | 'accepted' | 'rejected' | 'expired' | 'cancelled'
export interface QuotationRecord {
 id: string; quotation_number: string; customer_id: string; customer_name?: string; project_reference: string | null; notes: string | null
 status: QuotationStatus; effective_status: QuotationStatus; revision: number; version: number; valid_until: string; currency: string; total_amount: string | number; created_at: string
}
export interface QuotationSnapshot {
 quotationNumber: string; version: number; currency: string; customerId: string; customerName: string; projectReference: string | null; notes: string | null; validUntil: string
 orderDiscount: string | number; net: string | number; tax: string | number; total: string | number
 lines: { name: string; quantity: string; unitPrice: string; total: string | number; input: SaleLineInput; measurement: MeasurementSnapshot | null; pricing: { source: string } | null }[]
}
export interface QuotationDetail { record: QuotationRecord; snapshot: QuotationSnapshot; versions: { version: number; snapshot: QuotationSnapshot; reason: string; actor_profile_id: string; actor_name?: string | null; created_at: string }[]; events: { revision: number; version: number; action: string; previous_status: string | null; status: string; reason: string; actor_profile_id: string; actor_name?: string | null; created_at: string }[]; versionCount: number; eventCount: number; historyPage: number }
export interface QuotationContext { items: QuotationRecord[]; total: number; page: number; pageSize: number; detail: QuotationDetail | null; canManage: boolean; canIssue: boolean }
export interface QuotationValues { customerId: string; validUntil: string; projectReference: string; notes: string; orderDiscount: string; lines: SaleLineInput[] }

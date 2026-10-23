export type ReceiptPaperSize = 'thermal_80' | 'a4'
export type ReceiptPaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'

export interface SaleReceiptSnapshot {
  offers?: import('../../shared/catalogOffers').OfferMatch[]
  presentation?: { documentLabel: string | null; referenceLabel?: string | null; language: 'en' | 'ar'; direction: 'auto' | 'ltr' | 'rtl'; showDescriptions: boolean; notes: string | null; logoDataUrl: string | null }
  tax?: import('./tax').TaxQuote | null
  version: 1
  invoiceId: string
  invoiceNumber: string
  issuedAt: string
  currency: string
  business: { name: string; address: string | null; phone: string | null }
  location: { name: string; code: string | null; address: string | null; phone: string | null }
  staffName: string | null
  customer: { name: string | null; phone: string | null }
  lines: Array<{
    measurement?: import('./measurement').MeasurementSnapshot | null
    id: string
    itemType: 'product' | 'service'
    name: string
    description?: string | null
    sku: string | null
    quantity: number
    unitPrice: number
    discount: number
    total: number
  }>
  payments: Array<{
    id: string
    amount: number
    method: ReceiptPaymentMethod
    reference: string | null
    paidAt: string
  }>
  subtotal: number
  discount: number
  total: number
  footer: string | null
  paperSize: ReceiptPaperSize
}

export interface ReceiptShareCopy {
  invoice: string
  date: string
  location: string
  staff: string
  customer: string
  items: string
  payment: string
  total: string
  quantity: string
  compliance: string
  walkIn: string
}

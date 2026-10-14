export interface BsReceiptView {
  logoDataUrl?: string | null
  notes?: string | null
  direction?: 'ltr' | 'rtl'
  issuer: string
  issuerDetails: string[]
  invoice: string
  issued: string
  location: { name: string; code: string | null; address: string | null; phone: string | null }
  staff: string
  customer: string
  lines: { id: string; label: string; description?: string; quantity: string; unitPrice: string; total: string }[]
  totals: { id: string; label: string; value: string; emphasis?: boolean }[]
  payments: { id: string; summary: string; reference: string | null }[]
  footer: string | null
}
export interface BsReceiptDocumentCopy {
  title: string
  reprintLabel: string
  invoice: string
  date: string
  location: string
  address: string
  phone: string
  staff: string
  customer: string
  items: string
  item: string
  quantity: string
  unitPrice: string
  lineTotal: string
  total: string
  payment: string
  compliance: string
}
export interface BsReceiptPageCopy {
  back: string
  print: string
  language: string
  paperSize: string
  share: string
  loading: string
  loadError: string
  retry: string
  unavailable: string
}

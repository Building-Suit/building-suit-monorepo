export interface BsQuotationChoice { id: string; name: string }
export interface BsQuotationPicker { options: BsQuotationChoice[]; loading: boolean; error: string | null; hasMore: boolean; more: string; retry: string }
export interface BsQuotationFormLine { key: string; itemType: string; sourceId: string; name: string; quantity: string; unit: string; overridePrice: string; overrideReason: string }
export interface BsQuotationForm { customerId: string; validUntil: string; projectReference: string; notes: string; orderDiscount: string; reason: string; lines: BsQuotationFormLine[] }
export interface BsQuotationRow { id: string; number: string; customer: string; project: string; status: string; version: string; validity: string; total: string }
export interface BsQuotationLineView { key: string; picker: BsQuotationPicker; units: { value: string; label: string }[]; loading: boolean; approval?: import('./priceApprovalPresentation').BsPriceApproval; sourceLabel: string }
export interface BsQuotationDetailLine { id: string; name: string; quantity: string; price: string; total: string }
export interface BsQuotationHistoryRow { id: string; version: string; status: string; reason: string; actor: string; date: string; total: string }
export interface BsQuotationView {
 locked: boolean; available: boolean; loading: boolean; error: string; total: number; pageSize: number; canCreate: boolean
 editor: { canProducts: boolean; canServices: boolean; title: string; dirty: boolean; pending: boolean; locked: boolean; error: string }
 detail: { relatedAction?: { label: string; to: string }; locked: boolean; actionError: string; loading: boolean; error: string; title: string; subtitle: string; status: string; notice: string; pending: boolean; reason: string; canEdit: boolean; canRevise: boolean; actions: { id: string; label: string }[]; lines: BsQuotationDetailLine[]; totals: { label: string; value: string }[]; history: BsQuotationHistoryRow[]; events: BsQuotationHistoryRow[]; versionCount: number; eventCount: number }
}
export interface BsQuotationCopy {
 title: string; subtitle: string; add: string; search: string; number: string; customer: string; project: string; status: string; version: string; validity: string; total: string; actions: string; open: string; edit: string; revise: string; print: string; empty: string; retry: string; noShop: string
 save: string; cancel: string; notes: string; discount: string; reason: string; lines: string; addProduct: string; addService: string; product: string; service: string; quantity: string; unit: string; overridePrice: string; overrideReason: string; remove: string; price: string; history: string; events: string; actor: string; date: string; previous: string; next: string; close: string; currentVersion: string
}

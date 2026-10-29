export interface BsPlanningCopy {
 title: string; subtitle: string; mode: string; bins: string; positions: string; suppliers: string; prices: string; add: string; edit: string; history: string; search: string; empty: string; retry: string; noShop: string
 code: string; name: string; aisle: string; shelf: string; product: string; bin: string; reel: string; pooled: string; notes: string; supplier: string; itemCode: string; unit: string; lead: string; review: string; preferred: string; active: string; status: string; yes: string; no: string; reason: string; save: string; cancel: string; close: string; date: string; actor: string; revision: string; changes: string; quantity: string; cost: string; baseQuantity: string; baseCost: string; baseUnit: string; invoice: string; currency: string; total: string; reorder: string; positionNotice: string; supplierNotice: string; priceNotice: string; allProducts: string; allSuppliers: string
}
export interface BsPlanningForm { code: string; name: string; aisle: string; shelf: string; productId: string; binId: string; reelId: string; notes: string; vendorId: string; itemCode: string; unit: string; leadDays: string; reviewDays: string; preferred: boolean; active: boolean; reason: string }
export interface BsPlanningPicker { options: { id: string; name: string }[]; loading: boolean; error: string | null; hasMore: boolean; more: string; retry: string }
export interface BsPlanningRow { id: string; primary: string; secondary: string; itemCode: string; position: string; unit: string; status: string; lead: string; review: string; preferred: string }
export interface BsPlanningPriceRow { id: string; to: string; invoice: string; product: string; supplier: string; quantity: string; unit: string; cost: string; baseQuantity: string; baseUnit: string; baseCost: string; total: string; currency: string; date: string; status: string }
export interface BsPlanningView {
 available: boolean; loading: boolean; error: string; canManage: boolean; locked: boolean; total: number; reorderTo: string
 modes: { value: string; label: string }[]
 editor: { title: string; kind: 'bin' | 'position' | 'supplier'; identityLocked: boolean; pending: boolean; dirty: boolean; error: string; notice: string; units: { value: string; label: string }[]; unitLoading: boolean }
 history: { loading: boolean; error: string; title: string; fields: { label: string; value: string }[]; total: number; events: { id: string; revision: string; reason: string; actor: string; date: string; changes: string }[] }
}

export interface BsPurchasingChoice { id: string; name: string }
export interface BsPurchasingPicker { options: BsPurchasingChoice[]; loading: boolean; error: string | null; hasMore: boolean; moreLabel: string; retryLabel: string }
export interface BsSupplierForm { name: string; contactName: string; phone: string; email: string; address: string; taxNumber: string; notes: string }
export interface BsPurchaseLineForm { unitSelection?: string; key: number; productId: string; quantity: number; unitCost: number }
export interface BsPurchaseForm { vendorId: string; invoiceNumber: string; issuedOn: string; notes: string; lines: BsPurchaseLineForm[] }
export interface BsSupplierRow { id: string; name: string; archived: boolean; contact: string; communication: string; payable: string; editable: boolean; archiving: boolean }
export interface BsPurchaseRow { id: string; date: string; vendor: string; invoiceNumber: string; total: string; payable: string; settlement: string; status: string; href: string; voidable: boolean; voiding: boolean }
export interface BsPurchasingView { available: boolean; loadingContext: boolean; canCreateSupplier: boolean; canCreatePurchase: boolean; createPurchaseDisabled: boolean; hasProducts: boolean; hasSuppliers: boolean; pending: boolean; error: boolean; actionError: string; success: string; vendorTotal: number; total: number; pages: number; pageSize: number; editingSupplier: boolean; supplierDirty: boolean; supplierSaving: boolean; purchaseDirty: boolean; purchaseSaving: boolean; formTotal: string }
export interface BsPurchasingFilters { vendor: string; status: string; settlement: string; from: string; to: string }
export interface BsPurchasingCopy { unit?: string;
  actions: string
  addLine: string
  addSupplier: string
  address: string
  all: string
  archive: string
  archived: string
  cancel: string
  contact: string
  contactName: string
  dashboard: string
  date: string
  details: string
  edit: string
  email: string
  empty: string
  from: string
  invoiceNumber: string
  loading: string
  newPurchase: string
  next: string
  noProducts: string
  noResults: string
  noShop: string
  noSuppliers: string
  notes: string
  optional: string
  paid: string
  partial: string
  payable: string
  phone: string
  posted: string
  previous: string
  product: string
  products: string
  quantity: string
  readError: string
  recent: string
  removeLine: string
  retry: string
  savePurchase: string
  saveSupplier: string
  scope: string
  search: string
  settlement: string
  showArchived: string
  status: string
  subtitle: string
  supplier: string
  supplierName: string
  supplierSearch: string
  suppliers: string
  taxNumber: string
  title: string
  to: string
  total: string
  unitCost: string
  unpaid: string
  void: string
  voided: string
}

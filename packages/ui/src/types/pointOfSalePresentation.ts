export interface BsPointOfSaleChoice { value: string; label: string; icon?: string; disabled?: boolean }
export interface BsPointOfSaleCatalogItem { quantity?: number; maximumQuantity?: number | null; disabled?: boolean; imageUrl?: string | null; id: string; key: string; name: string; description: string; price: string; stock: string }
export interface BsPointOfSaleCartLine { imageUrl?: string | null; id: string; name: string; quantity: number; maximumQuantity?: number | null; total: string }
export interface BsPointOfSaleCustomer { id: string; identity: string; name: string; phone: string | null }
export interface BsPointOfSalePaymentForm { method: string; reference: string; notes: string }
export interface BsPointOfSaleView { offerSummary?: string; cartCount?: string; available: boolean; loadingContext: boolean; location: string; staff: string; locationChanged: boolean; error: string; scanMessage: string; checkingOut: boolean; confirming: boolean; shortcutBlocked: boolean; catalogLoading: boolean; catalogError: string; catalogTotal: number; catalogPageSize: number; contextLoading: boolean; contextError: string; appointmentLocked: boolean; customerDisabled: boolean; customerBusy: boolean; customerDisplay: string; customerEmpty: string; customerEmptyFilter: string; hasCustomer: boolean; checkoutDisabled: boolean; total: string; reviewLabel: string; payLabel: string }
export interface BsPointOfSaleCopy { reviewStep?: string; paymentStep?: string; continueToPayment?: string; backToCart?: string; optionalDetails?: string; lastReceipt?: string; add?: string; decrease?: string; increase?: string; imagePlaceholder?: string;
  appointment: string
  cart: string
  catalog: string
  clearCustomer: string
  closeShift: string
  customer: string
  customerNoResults: string
  customerSearch: string
  customerSearchHint: string
  emptyCart: string
  loadError: string
  loading: string
  location: string
  locationChanged: string
  noCustomer: string
  noResults: string
  notes: string
  paying: string
  paymentMethod: string
  permissionDenied: string
  quantity: string
  reference: string
  remove: string
  reset: string
  retry: string
  search: string
  selectStaff: string
  serverTotal: string
  shortcuts: string
  staff: string
  subtitle: string
  title: string
  total: string
  walkIn: string
  noShop: string
  category: string
  previous: string
  next: string
  previousGlyph: string
  nextGlyph: string
}

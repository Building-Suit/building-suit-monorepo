export interface BsInventoryStockRow { id: string; name: string; sku: string; archived: boolean; quantity: string; threshold: string; value: string; low: boolean; canCount: boolean; canThreshold: boolean }
export interface BsInventoryMovementRow { id: string; date: string; source: string; reference: string; reason: string; quantity: string; value: string; actor: string }
export interface BsInventoryCountRow { id: string; date: string; reference: string; reason: string; expected: string; counted: string; variance: string }
export interface BsInventoryAdjustmentForm { productId: string; quantity: number; unitCost: number; reason: string }
export interface BsInventoryCountForm { quantity: number; date: string; unitCost: number; reference: string; reason: string }
export interface BsInventoryEditor { dirty: boolean; pending: boolean }
export interface BsInventoryView { available: boolean; loadingContext: boolean; accessError: boolean; accessLoading: boolean; canView: boolean; planNotice: boolean; canAdjust: boolean; valuation: string; lowCount: string; loading: boolean; error: string; actionError: string; historyName: string; historyError: boolean; movementsLoading: boolean; movementsTotal: number; countsLoading: boolean; countsTotal: number; historyPageSize: number; adjustmentTitle: string; receive: boolean; countProduct: string; countExpected: string; countVariance: string; positiveVariance: boolean }
export interface BsInventoryCopy {
  actions: string
  actor: string
  all: string
  archived: string
  archivedHint: string
  close: string
  count: string
  counted: string
  countedAt: string
  counts: string
  dashboard: string
  date: string
  denied: string
  emptyHistory: string
  expected: string
  history: string
  loadError: string
  loading: string
  low: string
  lowCount: string
  lowOnly: string
  movements: string
  noProducts: string
  noShop: string
  onHand: string
  plan: string
  positiveCost: string
  product: string
  products: string
  quantity: string
  reason: string
  receive: string
  reference: string
  retry: string
  save: string
  setThreshold: string
  source: string
  subtitle: string
  threshold: string
  title: string
  totalValue: string
  unitCost: string
  value: string
  variance: string
  writeoff: string
}

export interface BsExpenseForm { title: string; amount: number; category: string; date: string; notes: string; correctionReason: string }
export interface BsExpenseRow { id: string; title: string; notes: string; reason: string; category: string; date: string; history: string; actor: string; amount: string; status: string; editable: boolean }
export interface BsExpenseFilters { status: string; category: string; from: string; to: string }
export interface BsExpenseView { available: boolean; loadingContext: boolean; hasLocation: boolean; locationName: string; canManage: boolean; loading: boolean; error: string; actionError: string; editing: boolean; dirty: boolean; saving: boolean; voidDirty: boolean; voidPending: boolean; total: number; pageSize: number }
export interface BsExpenseCopy {
  add: string
  allCategories: string
  allStatuses: string
  amount: string
  branch: string
  cancel: string
  category: string
  categoryHint: string
  correct: string
  correctionHelp: string
  correctionReason: string
  dashboard: string
  date: string
  empty: string
  from: string
  history: string
  incomeBoundary: string
  name: string
  noLocation: string
  noShop: string
  notes: string
  paid: string
  readOnly: string
  save: string
  saveCorrection: string
  search: string
  status: string
  subtitle: string
  title: string
  to: string
  void: string
  voidHelp: string
  voidReason: string
  voidTitle: string
  voided: string
}

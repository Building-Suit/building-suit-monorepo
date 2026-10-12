export interface BsCatalogImportCopy {
  addCategory: string
  allCategories: string
  amount: string
  applied: string
  apply: string
  categories: string
  category: string
  categoryName: string
  choose: string
  customers: string
  field: string
  from: string
  importTitle: string
  issue: string
  item: string
  labels: string
  noData: string
  noShop: string
  products: string
  quantity: string
  report: string
  reportError: string
  retry: string
  row: string
  subtitle: string
  suppliers: string
  template: string
  title: string
  to: string
  valid: string
  validate: string
  validating: string
}
export interface BsCatalogImportChoice { value: string; label: string }
export interface BsCatalogImportReportRow { id: string; name: string; category: string; quantity: string; amount: string }
export interface BsCatalogImportView {
  available: boolean; contextLoading: boolean; categories: { id: string; name: string }[]
  categoryDirty: boolean; categoryPending: boolean; categoryError: string
  pending: boolean; filename: string; rowCount: number; error: string; canValidate: boolean; canApply: boolean; resultLabel: string
  issues: { row: number | null; field: string; code: string }[]; exporting: boolean; reportPending: boolean; reportError: boolean; reportRows: BsCatalogImportReportRow[]
}

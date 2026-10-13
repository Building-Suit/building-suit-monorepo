export interface BsCatalogueItemView {
  id: string
  name: string
  description?: string
  category: string
  sku: string
  barcode: string
  price: string
  schedule: string
}
export interface BsCatalogueForm {
  imageUrl?: string
  name: string
  description: string
  sku: string
  barcode: string
  price: number
  category: string
  discount: { type: string; value: number }
  schedule: { enabled: boolean; duration: number | null; cleanup: number; locations: string[]; staff: string[] }
}
export interface BsCatalogueCopy {
  imageUpload?: { choose: string; replace: string; remove: string; retry: string; help: string; uploading: string; uploaded: string; error: string; invalid: string; placeholder: string }
  imagePlaceholder?: string
  imageLabel?: string
  imageHelp?: string
  imageUnavailable?: string
  title: string
  subtitle: string
  import: string
  noShop: string
  dashboard: string
  add: string
  edit: string
  archive: string
  save: string
  cancel: string
  name: string
  price: string
  tablePrice?: string
  category: string
  search: string
  empty: string
  noResults: string
  stockLater?: string
  sku?: string
  barcode?: string
  description?: string
  discountType?: string
  discountValue?: string
  scheduling?: string
  schedulingHelp?: string
  duration?: string
  cleanup?: string
  locations?: string
  staff?: string
  loading?: string
  scheduleSummary?: string
}

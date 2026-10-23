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
export interface BsCataloguePackagingForm { id: string | null; code: string; name: string; unitCode: string; containedQuantity: string; containedUnitCode: string; barcode: string; salePrice: string; canPurchase: boolean; canSell: boolean; defaultPurchase: boolean; defaultSale: boolean }
export interface BsCatalogueForm {
  packaging?: BsCataloguePackagingForm
  measurement?: { enabled: boolean; baseUnit: string; increment: string; saleUnits: string[] }
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
  packaging?: { title: string; help: string; add: string; code: string; name: string; unit: string; contents: string; contentsUnit: string; barcode: string; salePrice: string; priceHelp: string; canPurchase: string; canSell: string; defaultPurchase: string; defaultSale: string; save: string; archive: string; edit: string; cancel: string }
  measurement?: { enabled: string; baseUnit: string; increment: string; saleUnits: string; help: string; locked: string }
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
  editTitle?: string
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

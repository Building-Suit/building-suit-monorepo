/** Decimal string in new measurement APIs; never a floating point stock amount. */
export interface ProductPackaging { id: string; code: string; name: string; unitCode: string; baseQuantity: string; containedQuantity: string; containedUnitCode: string; version: number; salePrice: number | null; barcode: string | null; canSell: boolean; canPurchase: boolean; defaultSale: boolean; defaultPurchase: boolean }
export interface ProductMeasurementOptions { baseUnitCode: string; increment: string; revision: number; status: 'legacy' | 'prepared' | 'active'; saleUnits: string[]; packages: ProductPackaging[]; locked: boolean }
export interface PosMeasurement { baseUnitCode: string; increment: string; revision: number; saleUnits: string[]; baseUnitPrice: string; packages: ProductPackaging[] }
export interface SaleLineInput { item_type: string; source_id: string; quantity: string | number; unit_code?: string; measurement_revision?: number; package_id?: string; package_version?: number }
export interface MeasurementSnapshot { version: 1; baseUnitNameEn: string; baseUnitNameAr: string; baseUnitCode: string; baseQuantity: string; quantityIncrement: string; enteredQuantity: string; enteredUnitCode: string; enteredUnitPrice: string; productRevision: number; packageId: string | null; packageVersion: number | null; packageName: string | null; unitNameEn: string; unitNameAr: string }
export type MeasurementQuantity = string
export type MeasurementDimension = 'count' | 'length' | 'mass' | 'volume' | 'area' | 'package'
export interface PreparedProductMeasurement {
  baseUnitCode: string
  quantityIncrement: MeasurementQuantity
  status: 'prepared'
}
export interface ResolvedProductMeasurement extends PreparedProductMeasurement {
  enteredQuantity: MeasurementQuantity
  enteredUnitCode: string
  baseQuantity: MeasurementQuantity
}

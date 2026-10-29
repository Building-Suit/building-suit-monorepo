import type { PosMeasurement } from './measurement'
export interface Gs1WeightCapture { kind: 'gs1'; id: string; raw: string }
export interface Gs1WeightCaptureSnapshot extends Gs1WeightCapture { format: 'gs1-01-310n'; gtin: string; netQuantity: string; unitCode: 'kg'; baseQuantity: string; baseUnitCode: string; productRevision: number }
export interface WeightBarcodeItem { id: string; itemType: 'product'; name: string; sku: string | null; barcode: string; unitPrice: number; discount: number; stock: number | null; measurement: PosMeasurement; imageUrl?: string | null }
export interface WeightBarcodeResolution { item: WeightBarcodeItem; quantity: string; availableQuantity: string; unitCode: string; raw: string; gtin: string; netQuantity: string; weightUnitCode: 'kg' }

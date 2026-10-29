import type { MeasurementSnapshot } from './measurement'
export type PlanningKind = 'bin' | 'position' | 'supplier'
export type PlanningMode = PlanningKind | 'prices'
export interface PlanningRecord {
 id: string; shop_id: string; location_id: string; active: boolean; revision: number
 code?: string; name?: string; aisle?: string; shelf?: string
 product_id?: string; product_name?: string; sku?: string | null; bin_id?: string; bin_code?: string; bin_name?: string; notes?: string
 reel_id?: string | null; reel_barcode?: string | null; reel_revision?: number | null; reel_status?: string | null
 vendor_id?: string; vendor_name?: string; item_code?: string; unit_code?: string | null; package_id?: string | null; package_version?: number | null; package_name?: string | null
 measurement_revision?: number; current_measurement_revision?: number; lead_days?: number; review_days?: number; preferred?: boolean; purchase_snapshot?: MeasurementSnapshot | null
}
export interface PlanningEvent { id: string; revision: number; reason: string; actor_name: string | null; created_at: string; snapshot: { previous: PlanningRecord | null; current: PlanningRecord } }
export interface PlanningContext { items: PlanningRecord[]; total: number; page: number; pageSize: number; record: PlanningRecord | null; history: PlanningEvent[]; historyTotal: number; historyPage: number; canManage: boolean }
export interface SupplierPriceRow { id: string; invoice_id: string; invoice_number: string; status: 'posted' | 'void'; issued_at: string; currency: string; product_id: string; product_name: string; vendor_id: string | null; vendor_name: string; quantity: string; base_unit_cost: string; total: string; base_unit_code: string; entered_quantity: string; entered_unit_cost: string; purchase_unit: string }
export interface SupplierPriceHistory { items: SupplierPriceRow[]; total: number; page: number; pageSize: number }
export interface PlanningValues { active: boolean; code?: string; name?: string; aisle?: string; shelf?: string; productId?: string; binId?: string; reelId?: string | null; reelRevision?: number | null; notes?: string; vendorId?: string; itemCode?: string; unitCode?: string | null; packageId?: string | null; packageVersion?: number | null; leadDays?: string; reviewDays?: string; preferred?: boolean }

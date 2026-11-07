export type CommodityKind = 'quote' | 'rule'
interface Approval { id:string;shop_id:string;active:boolean;revision:number;approved_by:string;approved_at:string;evidence_reference:string;currency_code:string }
export interface CommodityQuote extends Approval { commodity:string;source_name:string;price_per_kg:string;effective_at:string;expires_at:string }
export interface ProductCommodityRule extends Approval { product_id:string;product_name:string;quote_id:string;base_unit_code:string;measurement_revision:number;kg_per_base_unit:string;premium_per_base_unit:string;current_measurement_revision?:number;commodity?:string;source_name?:string;effective_at?:string;expires_at?:string;quote_active?:boolean }
export type CommodityRecord = CommodityQuote | ProductCommodityRule
export interface CommodityEvent { id:string;revision:number;reason:string;created_at:string;actor_name:string|null;snapshot:{previous:CommodityRecord|null;current:CommodityRecord} }
export interface CommodityContext { items:CommodityRecord[];total:number;page:number;pageSize:number;record:CommodityRecord|null;history:CommodityEvent[];historyTotal:number;historyPage:number;currency:string;canManage:boolean }
export type CommodityValues = { active:boolean;confirmed:boolean } | { active:boolean;confirmed:boolean } & ({ commodity:string;sourceName:string;evidenceReference:string;currency:string;pricePerKg:string;effectiveAt:string;expiresAt:string } | { productId:string;quoteId:string;kgPerBaseUnit:string;premiumPerBaseUnit:string;measurementRevision:number;baseUnitCode:string;evidenceReference:string })

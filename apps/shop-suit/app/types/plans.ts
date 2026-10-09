export type PlanResourceKey =
  | 'active_locations'
  | 'active_members'
  | 'active_products'
  | 'active_services'
  | 'active_customers'
  | 'active_suppliers'

export type PlanResourceLimits = Record<PlanResourceKey, number | null>

export type PlanUsageResource = {
  resource: PlanResourceKey
  used: number
  limit: number | null
  remaining: number | null
  unlimited: boolean
  atLimit: boolean
  overLimit: boolean
}

export type ShopPlanInterval = 'monthly' | 'annual'
export type ShopPlanVariant = 'standard' | 'solo_1' | 'solo_2' | 'multi_2' | 'multi_3'

export type ShopPlanOffer = {
  catalogTermsId: string
  planSlug: string
  planName: string
  planVariant: ShopPlanVariant
  variantName: string
  billingInterval: ShopPlanInterval
  currency: string
  listPriceAmount: number
  effectivePriceAmount: number
  priceSource: 'catalog' | 'override'
  resourceLimits: PlanResourceLimits
  blockers: Array<{ resource: PlanResourceKey, used: number, limit: number, excess: number }>
}

export type PlanResourceKey = 'active_locations' | 'active_members' | 'active_products' | 'active_services'

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

import type { MarketingPricingCopy, MarketingPricingOption, MarketingPricingPlan } from '@building-suit/contracts'

export type BsLandingPreview = { kind: 'dashboard'; label: string; title: string; periodLabel: string; metrics: { label: string; value: string }[] } | { kind: 'features' }
export interface BsLandingPricing {
  plans: MarketingPricingPlan[]
  interval: string
  intervalOptions: MarketingPricingOption[]
  copy: MarketingPricingCopy
  annualSaving: string | null
  intro?: string
  loading: boolean
  error: string | null
  columns: 3 | 4
  testId: string
  sectionTestId?: string
  noticeTestId?: string
  notice?: string
}

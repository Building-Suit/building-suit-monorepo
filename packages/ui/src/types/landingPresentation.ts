import type { MarketingPricingCopy, MarketingPricingOption, MarketingPricingPlan } from '@building-suit/contracts'

export type BsLandingPreview = { kind: 'dashboard'; label: string; title: string; periodLabel: string; metrics: { label: string; value: string }[] } | { kind: 'features' }
export interface BsLandingPricing {
  variant?: 'default' | 'shop'
  plans: MarketingPricingPlan[]
  currencySelection?: { value: string; label: string; options: MarketingPricingOption[]; notice?: string; pending?: boolean }
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

export interface BsLandingChangelog {
  title: string
  linkLabel: string
  to: string
  feed: import('@building-suit/contracts').ChangelogFeed
  locale: import('@building-suit/contracts').ChangelogLocale
  copy: import('@building-suit/contracts').ChangelogCopy
  suit: string
  state: 'ready' | 'loading' | 'error' | 'denied'
}

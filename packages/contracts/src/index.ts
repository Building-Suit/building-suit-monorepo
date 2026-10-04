export interface NavigationLink { to: string; label: string; icon?: string }
export interface NavigationGroup { key: string; label: string; links: NavigationLink[] }
export interface LandingContent {
  eyebrow: string
  heroTitle: string
  heroBody: string
  createWorkspace: string
  explore: string
  trialNote: string
  featuresEyebrow: string
  featuresTitle: string
  featuresBody: string
  workflowEyebrow: string
  workflowTitle: string
  pricingEyebrow: string
  pricingTitle: string
  pricingBody: string
  features: Array<{ icon: string; title: string; body: string }>
  workflow: Array<{ title: string; body: string }>
}
export interface MarketingPricingOption { value: string; label: string }
export interface MarketingPricingFeature { key: string; text: string; included: boolean }
export interface MarketingPricingNotice {
  title: string
  body?: string
  items?: string[]
  footer?: string
}
export interface MarketingPricingAction {
  label: string
  to?: string
  disabled?: boolean
  pending?: boolean
  pressed?: boolean
  variant?: 'default' | 'primary'
}
export interface MarketingPricingPlan {
  id: string
  name: string
  description?: string
  badge?: string
  badgeTone?: 'featured' | 'muted' | 'current'
  promoted?: boolean
  unavailable?: boolean
  selected?: boolean
  originalPrice?: string
  discount?: string
  price?: string
  priceNote?: string
  priceDetail?: string
  pricingUnavailable?: string
  features?: MarketingPricingFeature[]
  featureFallback?: string
  variant?: { legend: string; value: string; options: MarketingPricingOption[] }
  notice?: MarketingPricingNotice
  action?: MarketingPricingAction
  secondaryAction?: MarketingPricingAction
}
export interface MarketingPricingCopy {
  cycleLabel: string
  loading: string
  empty: string
  retry: string
  included: string
  notIncluded: string
}
export interface DataScope { environment: string; portal: string; userId: string; tenantId: string }
export interface CapabilityAdapter { can(capability: string): boolean }

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
export interface ContactInfoItem {
  key: string
  label: string
  value: string
  href?: string
  direction?: 'ltr' | 'rtl' | 'auto'
}
export interface SupportRequestValue {
  category: string
  subject: string
  message: string
  email: string
  consent: boolean
  honeypot: string
}
export interface SupportRequestCopy {
  title: string
  intro: string
  category: string
  replyEmail: string
  subject: string
  message: string
  consent: string
  success: string
  submit: string
  pending: string
  website: string
}
export interface ScopeOption {
  id: string
  label: string
  description?: string
  status?: string
  meta?: string
}
export interface NotificationMenuItem {
  id: string
  title: string
  body?: string
  read?: boolean
  timestamp?: string
}
export interface DataScope { environment: string; portal: string; userId: string; tenantId: string }
export interface CapabilityAdapter { can(capability: string): boolean }


/** Domain-neutral presentation inputs; products retain authorization and commands. */
export type BsPresentationTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger'
export interface BsUsageItem { id: string; label: string; valueLabel: string; used: number; limit: number | null; status?: string; tone?: BsPresentationTone; description?: string; nextAllowance?: string; action?: { label: string; to: string } }
export interface BsSetupStepData { id: string; title: string; description?: string; status?: string; tone?: BsPresentationTone; action?: { label: string; to?: string; disabled?: boolean } }
export interface BsImportStep { id: string; label: string }
export interface BsColumnMappingField { key: string; label: string; required?: boolean; error?: string }
export interface BsImportIssue { id: string; message: string; detail?: string; tone?: BsPresentationTone }
export interface BsRoleOption { value: string; label: string; description?: string; disabled?: boolean }
export interface BsChartSeries { id: string; label: string; tone?: BsPresentationTone }
export interface BsChartPoint { id: string; label: string; values: Record<string, number>; formattedValues?: Record<string, string> }
export interface BsHierarchyNode { id: string; label: string; description?: string; meta?: string; status?: string; tone?: BsPresentationTone; children?: BsHierarchyNode[] }
export interface BsFlowStage { id: string; title: string; description?: string; connectorLabel?: string; nodes: BsSetupStepData[] }
export interface BsDocumentLine { id: string; label: string; description?: string; quantity?: string; unitPrice?: string; total: string }
export interface BsDocumentTotal { id: string; label: string; value: string; emphasis?: boolean }

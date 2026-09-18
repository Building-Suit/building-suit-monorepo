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
export interface DataScope { environment: string; portal: string; userId: string; tenantId: string }
export interface CapabilityAdapter { can(capability: string): boolean }

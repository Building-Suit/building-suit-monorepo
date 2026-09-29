import type { PlanResourceKey, PlanResourceLimits, PlanUsageResource } from './plans'

export type BillingSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

export type BillingSubmission = {
  id: string
  kind: 'activation' | 'renewal' | 'correction'
  status: BillingSubmissionStatus
  expectedAmount: number
  paidAmount: number
  currency: string
  requestedPlanId: string
  requestedPlanSlug: string
  requestedPlanName: string
  billingInterval: 'monthly' | 'quarterly' | 'annual'
  listPriceAmount: number
  effectivePriceAmount: number
  priceSource: 'catalog' | 'override'
  transferDate: string
  transferReference: string
  reviewReason: string | null
  receivedAmount: number | null
  receivedReference: string | null
  receivedDate: string | null
  activationDays: number | null
  approvedSubscriptionEnd: string | null
  submittedAt: string
  reviewedAt: string | null
}

export type BillingPlanOption = {
  planId: string
  planSlug: string
  planName: string
  catalogTermsId: string
  billingInterval: 'monthly' | 'quarterly' | 'annual'
  currency: string
  listPriceAmount: number
  effectivePriceAmount: number
  priceSource: 'catalog' | 'override'
  resourceLimits: PlanResourceLimits
  blockers: Array<{ resource: PlanResourceKey, used: number, limit: number, excess: number }>
}

export type ShopBilling = {
  subscription: {
    id: string
    status: string
    planId: string
    planSlug: string
    planName: string
    priceAmount: number
    listPriceAmount: number
    effectivePriceAmount: number
    priceSource: 'catalog' | 'override'
    priceOverrideId: string | null
    priceOverrideReason: string | null
    priceOverrideEffectiveFrom: string | null
    priceOverrideExpiresAt: string | null
    currency: string
    billingInterval: 'monthly' | 'quarterly' | 'annual'
    trialStartAt: string | null
    trialEndAt: string | null
    periodStart: string | null
    periodEnd: string | null
    accessState: 'trialing' | 'active' | 'read_only' | 'suspended'
    trialDaysRemaining: number
  }
  availablePlans: BillingPlanOption[]
  instructions: {
    recipientAlias: string | null
    paymentLink: string | null
    qrImageUrl: string | null
    instructionsEn: string
    instructionsAr: string
    updatedAt: string
    manualVerification: true
  }
  usage: {
    locations: number
    products: number
    services: number
    members: number
    limits: PlanResourceLimits
    resources: PlanUsageResource[]
  }
  submissions: BillingSubmission[]
}

export type PlatformBillingQueueItem = BillingSubmission & {
  shopId: string
  shopName: string
  currentPlanSlug: string
  currentPlanName: string
  usageBlockers: Array<{ resource: string, used: number, limit: number, excess: number }>
}

export type PlatformBillingConfiguration = {
  recipientAlias: string | null
  paymentLink: string | null
  qrImageUrl: string | null
  instructionsEn: string
  instructionsAr: string
  updatedAt: string
}

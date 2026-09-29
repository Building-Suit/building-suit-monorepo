export type BillingSubmissionStatus = 'submitted' | 'under_review' | 'approved' | 'rejected'

export type BillingSubmission = {
  id: string
  kind: 'activation' | 'renewal' | 'correction'
  status: BillingSubmissionStatus
  expectedAmount: number
  paidAmount: number
  currency: string
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

export type ShopBilling = {
  subscription: {
    id: string
    status: string
    planId: string
    planSlug: string
    planName: string
    priceAmount: number
    currency: string
    trialStartAt: string | null
    trialEndAt: string | null
    periodStart: string | null
    periodEnd: string | null
    accessState: 'trialing' | 'active' | 'read_only' | 'suspended'
    trialDaysRemaining: number
  }
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
    limits: {
      active_locations: number | null
      active_members: number | null
      active_products: number | null
      active_services: number | null
    }
    resources: Array<{
      resource: 'active_locations' | 'active_members' | 'active_products' | 'active_services'
      used: number
      limit: number | null
      remaining: number | null
      unlimited: boolean
      atLimit: boolean
      overLimit: boolean
    }>
  }
  submissions: BillingSubmission[]
}

export type PlatformBillingQueueItem = BillingSubmission & {
  shopId: string
  shopName: string
  planSlug: string
  planName: string
}

export type PlatformBillingConfiguration = {
  recipientAlias: string | null
  paymentLink: string | null
  qrImageUrl: string | null
  instructionsEn: string
  instructionsAr: string
  updatedAt: string
}

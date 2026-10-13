export interface ProvisionInput {
  bindingId: string; email: string; displayName: string; shopName: string; mainLocationName: string; businessMode: string
  planId: string; catalogTermsId: string; requestId: string; correlationId: string; reason: string
}
export interface InvitationInput { bindingId: string; provisioningId: string; requestId: string; correlationId: string; reason: string; acknowledgeUncertainSend: true }
export type ProvisionAttempt = { kind: 'create'; input: ProvisionInput } | { kind: 'resend'; input: InvitationInput }
export interface ProvisionProjection {
  provisioningId: string; phase: 'reserved' | 'active' | 'conflict' | 'review_required'; email: string
  shopId: string | null; subscriptionId: string | null; planId: string
  invitationState: 'pending' | 'sending' | 'sent' | 'claimed' | 'unknown' | 'failed'; ownerVerified: boolean
  subscription: { id: string; planId: string; status: string; periodStart: string; periodEnd: string; trialStartAt: string; trialEndAt: string } | null
}
export interface ProvisionPlan { id: string; catalogTermsId: string; name: string; billingInterval: string; isActive: boolean; isPurchasable: boolean; isComingSoon: boolean }

export interface AccountScope { userId: string; authorityEnvironmentId: string; bindingId: string }
export interface ActivationAttempt {
  bindingId: string; shopId: string; subscriptionId: string; planId: string
  requestId: string; correlationId: string; reason: string
}
export interface AccountRow { id: string; name: string; ownerName: string | null; ownerEmail: string | null; status: string; subscriptionStatus: string }
export interface PlanOption { planId: string; planName: string; billingInterval: string; currency: string; listPriceAmount: number; blockers: unknown[] }
export interface SubscriptionSnapshot {
  id: string; status: string; planId: string; planName: string
  trialStartAt: string | null; trialEndAt: string | null; periodStart: string | null; periodEnd: string | null
}
export type AccountOutcome = { state: 'outcome_unknown'; requestId: string } | { state: 'target_rejected'; requestId: string }
  | { state: 'success'; requestId: string; data: unknown; auditId: string; replayed: boolean }

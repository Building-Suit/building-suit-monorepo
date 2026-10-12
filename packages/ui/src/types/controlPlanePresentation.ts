export interface Payment {
  id: string; shopId: string; shopName: string; status: 'submitted' | 'under_review' | 'approved' | 'rejected'
  requestedPlanName: string; requestedPlanSlug: string; billingInterval: string; currency: string
  listPriceAmount: number; effectivePriceAmount: number; paidAmount: number
  transferDate: string; transferReference: string; priceSource: string
  resourceLimits: Record<string, number | null> | null
  privateOfferId: string | null
  usageBlockers: { resource: string; usage: number; limit: number }[]
  evidence: { id: string; originalFileName: string; mimeType: string; sizeBytes: number; sha256: string }[] | null
}
export interface ReviewDraft { action: 'mark_under_review' | 'reject' | 'approve'; reason: string; receivedAmount: string; receivedReference: string; receivedDate: string; amountOverrideReason: string; externallyVerified: boolean }
export interface PaymentReceipt { requestId: string; correlationId: string; targetAuditId: string; targetResultVersion: number; replayed: boolean; submissionId: string; status: string; subscriptionId: string | null; periodEnd: string | null; commercialPeriodId: string | null }
export interface TransferConfiguration {
  version: number
  enabled: boolean | null
  recipientAlias: string
  recipientDetails: string
  instructions: { en: string; ar: string }
  paymentLink: string
  qr: { assetUrl: string; alt: { en: string; ar: string } }
}
export interface OfferDraft {
  definitionId: string
  expectedVersion: number
  recipientUserId: string
  companyId: string
  basePlanId: string
  templateReference: string
  displayName: string
  priceAmount: string
  currency: string
  billingInterval: string
  resourceLimits: string
  entitlements: string
  expiresAt: string
}
export interface ActivityRow {
  id: string; source: string; suit: string | null; environment: string; actor: string | null
  action: string; target: string | null; status: string; reason: string
  requestId: string | null; correlationId: string | null; occurredAt: string
}
export interface ActivityQuery {
  page: number; pageSize: number; order: 'asc' | 'desc'
  suit: string | null; environment: string | null; action: string | null; actor: string | null
  target: string | null; from: string | null; to: string | null; correlationId: string | null; requestId: string | null
}

export type SurfaceState = 'loading' | 'success' | 'empty' | 'error' | 'denied'
export interface OfferRow { id: string; displayName: string; version: number; priceAmount: string; currency: string; billingInterval: string; expiresAt: string; state: 'saved' | 'issued' | 'revoked' | 'expired'; customerLink?: string | null }
export interface ActivitySource { bindingId: string; suit: string; environment: string; stream: 'platform' | 'billing' | 'plan'; nextPage: number; lastObservedAt: string | null; lastFailedAt: string | null }
export interface BsControlPlaneView {
 state: 'success' | 'signed-out' | 'loading' | 'denied' | 'error'; pending: boolean; actionError: boolean;
 registryState: SurfaceState; heading: string; description: string; module?: string;
 transferStatus: 'loading' | 'configured' | 'empty' | 'disabled' | 'incomplete' | 'error' | 'denied'; configuration: TransferConfiguration | null; transferPending: boolean; transferDirty: boolean; transferError: string | null; command: boolean;
 activityRows: ActivityRow[]; activitySources: ActivitySource[]; activityTotal: number; activityStatus: SurfaceState; retrieving: boolean; remoteFailed: boolean;
 offerVersions: OfferRow[]; offerStatus: SurfaceState; offerPending: boolean; offerDirty: boolean; offerError: string | null; offerRequest: boolean; revokeId: string | null; issueId: string | null; issuanceAvailable: boolean; customerLink: string | null;
 queue: { items: Payment[]; total: number } | null; billingStatus: SurfaceState; payment: Payment | null; reviewCommand: boolean; receipt: PaymentReceipt | null; evidence: { id: string; signedUrl: string; expiresAt: number } | null; evidencePending: boolean; evidenceError: boolean; billingPending: boolean; billingDirty: boolean; billingError: string | null; approvalDisabled: boolean;
}

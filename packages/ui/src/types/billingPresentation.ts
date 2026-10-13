import type { BsUsageItem } from '@building-suit/contracts'
import type { BsLandingPricing } from './landingPresentation'
export interface BsBillingForm { paidAmount: number; transferDate: string; transferReference: string; privateLink: string; reason: string }
export interface BsBillingCopy {
  current?: string; payment?: string
  title: string; subtitle: string; loading: string; retry: string; cancel: string; denied: string; failed: string; unavailable: string
  usage: string; usageHelp: string; usageLoading: string; usageError: string; compare: string; compareHelp: string
  instructions: string; instructionsHelp: string; manual: string; recipient: string; paymentLink: string; qr: string; instructionsUnavailable: string
  privateTitle: string; privateHelp: string; privateLink: string; privatePreview: string; privateClear: string
  notice: string; noticeHelp: string; submit: string; requestedPlan: string; expected: string; interval: string; paid: string; transferDate: string; reference: string
  policyPrefix: string; terms: string; privacy: string; refund: string; noPurchasable: string
  evidenceTitle: string; evidenceHelp: string; evidenceSelect: string; evidenceUpload: string; evidenceUploading: string; evidenceFirst: string; evidenceSaved: string; evidenceAttached: string
  history: string; empty: string; access: string; reviewReason: string; reason: string; refresh: string; requests: string; inspect: string; openSubscription: string; cancelRequest: string
}
export interface BsBillingHistoryRow { id: string; status: string; statusLabel: string; plan: string; expected: string; paid: string; reference: string; date: string; reason: string }
export interface BsBillingView {
  checkout?: { title: string; description: string; logoLight: string; logoDark: string; logoAlt: string; quote: string; notice: string; unavailable: string; action: string; pending: boolean; disabled: boolean; error: string; statusMessage?: string; refreshLabel?: string; refreshDisabled?: boolean }
  checkoutHistory?: { title: string; status: string; plan: string; amount: string; date: string; empty: string; rows: { id: string; status: string; plan: string; amount: string; date: string }[] }
  workspace: string; loading: boolean; failed: boolean; denied: boolean; available: boolean
  summary: { id: string; label: string; value: string; note?: string; status?: string }[]
  notice: string; details: { label: string; value: string }[]; providerNotice: string
  latest: { title: string; status: string; statusLabel: string; summary: string; message: string; reason: string } | null
  usage: { items: BsUsageItem[]; loading: boolean; failed: boolean }
  pricing: BsLandingPricing
  instructions: { recipient: string; link: string; qr: string; text: string } | null
  privateOffer: { pending: boolean; error: string; title: string; summary: string; limits: { key: string; label: string; value: string }[]; notice: string; redeemed: string } | null
  transfer: { visible: boolean; dirty: boolean; pending: boolean; error: string; disabled: boolean; quote: string; quoteNotice: string; maximumDate: string } | null
  evidence: { reference: string; pending: boolean; error: string; saved: boolean; inputVersion: number; filenames: string[] } | null
  showEvidence: boolean; history: BsBillingHistoryRow[]; showHistory: boolean
  trial: { title: string; body: string; date: string; note: string } | null
  policy: { beforeTerms: string; beforeRefund: string; beforePrivacy: string; afterPrivacy: string; terms: string; refund: string; privacy: string } | null
  paymentNotice: string; paymentRequired: string; compatibilityNotice: string; pricingError: string
  canRequests: boolean
}
export interface BsManualPaymentView {
  visible: boolean; denied: boolean; pending: boolean; error: string; dirty: boolean; empty: boolean
  selected: { title: string; status: string; instructions: string; reference: string; period: string; approved: boolean } | null
  uploadAllowed: boolean; cancelAllowed: boolean; canSubmit: boolean; fileKey: string; fileHint: string; pendingHint: string
  history: { id: string; text: string }[]; evidence: { id: string; text: string }[]; requests: { id: string; text: string }[]
}
export interface BsPlanImpactView {
  visible: boolean; title: string; summary: string; noDeletion: string; price: string; capacity: string
  quotas: { id: string; label: string; state: string; blocked: boolean; detail: string }[]
  gainedTitle: string; gained: string[]; lostTitle: string; lost: string[]; handoffTitle: string; handoff: string; noChange: string; close: string
}

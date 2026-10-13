import type { NavigationGroup } from '@building-suit/contracts'
export interface BsAdminChoice { value: string; label: string; disabled?: boolean }
export interface BsAdminTableColumn { key: string; header: string; code?: boolean }
export interface BsAdminResourceRow {
  id: string
  values: Record<string, string>
  memberships?: boolean
  access?: { label: string; disabled: boolean }
  correction?: { label: string; disabled: boolean }
  review?: boolean
  support?: boolean
}
export interface BsAdminOperatorForm { action: string; targetPlan: string; reason: string; context: string }
export interface BsAdminOperatorDialog {
  visible: boolean; title: string; recordId: string; message: string; currentPlan: string
  dirty: boolean; pending: boolean; error: string | null; canSubmit: boolean; showContext: boolean
  actionChoices: BsAdminChoice[]; planChoices: BsAdminChoice[]; planPending: boolean; planError: string
  showPlan: boolean; showReceipt: boolean; receiptUrl: string
}
export interface BsAdminResourceView {
  pending: boolean; denied: boolean; error: string | null; success: boolean; role: string
  selected: string; resources: BsAdminChoice[]; search: string; status: string; statusChoices: BsAdminChoice[]
  showSearch: boolean; clearable: boolean; scoped: boolean; columns: BsAdminTableColumn[]; rows: BsAdminResourceRow[]
  paginated: boolean; previousDisabled: boolean; nextDisabled: boolean
  dialog: BsAdminOperatorDialog
}
export interface BsPlatformAdministrationCopy {
  title: string; subtitle: string; saved: string; view: string; search: string; filter: string
  apply: string; clear: string; refresh: string; loading: string; empty: string; scoped: string
  memberships: string; review: string; manage: string; previous: string; next: string
  action: string; targetPlan: string; currentPlan: string; inspect: string; openReceipt: string
  reason: string; context: string; cancel: string; submit: string
}
export interface BsAdminStandaloneShell {
  productName: string; homePath: string; groups: NavigationGroup[]
  labels: { close: string; open: string; navigation: string; dashboard: string }
  account: { email?: string; label: string; signOut: string }
  logo: { kind: 'product'; assetPrefix: string }
}
export interface BsAdminMetric { label: string; value: string; status?: string }
export interface BsAdminAuditRow { id: string; tenant: string; action: string; reason: string; actor: string; occurred: string }
export interface BsAdminAuditTable { rows: BsAdminAuditRow[]; loading: boolean; error: string | null; total: number; first: number }
export interface BsAdminTenantRow { id: string; name: string; owner: string; email: string; status: string; plan: string; members: string }
export interface BsAdminTenantTable { rows: BsAdminTenantRow[]; loading: boolean; error: string | null; total: number; first: number }
export interface BsAdminPlanRow { id: string; name: string; slug: string; state: string; availability: string; price: string; limits: { id: string; label: string; value: string }[]; version: string; next: string; subscriptions: string }
export interface BsAdminPlanCopy {
  catalog: string; catalogHelp: string; observer: string; plan: string; state: string; price: string; limits: string; version: string; subscriptions: string; actions: string
  editTerms: string; availability: string; noPlans: string; loadFailed: string; retry: string; displayName: string; currency: string; interval: string; effectiveFrom: string; reason: string; save: string; cancel: string
  active: string; public: string; purchasable: string; comingSoon: string; unlimited: string; locations: string; members: string; products: string; services: string; customers: string; suppliers: string
  targetPlan: string; timing: string; blockers: string; changePlan: string; renew: string; suspend: string; negotiatedPrice: string; amount: string; expiresAt: string; setPrice: string; removePrice: string
  usage: string; pendingChange: string
}
export interface BsAdminPlanForms {
  terms: { name: string; interval: string; currency: string; amount: number; effectiveFrom: string; locations: number | null; members: number | null; products: number | null; services: number | null; customers: number | null; suppliers: number | null; reason: string }
  availability: { active: boolean; public: boolean; purchasable: boolean; comingSoon: boolean; reason: string }
  change: { plan: string; timing: string; reason: string }
  price: { amount: number; currency: string; effectiveFrom: string; expiresAt: string; reason: string }
}
export interface BsAdminPlanDialog {
  kind: 'terms' | 'availability' | 'change' | 'override' | null; title: string; dirty: boolean; pending: boolean; error: string | null
  plans: BsAdminChoice[]; timing: BsAdminChoice[]; blockers: string[]; canRemovePrice: boolean
}
export interface BsAdminPlanWorkspace { rows: BsAdminPlanRow[]; loading: boolean; error: string | null; dialog: BsAdminPlanDialog }
export interface BsAdminBillingRow {
  id: string; tenant: string; status: string; currentPlan: string; requestedPlan: string; listPrice: string; effectivePrice: string; negotiated: boolean; paid: string; blockers: string; reference: string; date: string; canStart: boolean; canReview: boolean; approveDisabled: boolean
}
export interface BsAdminBillingTable { rows: BsAdminBillingRow[]; loading: boolean; error: string | null; total: number; first: number; status: string; statusChoices: BsAdminChoice[] }
export interface BsAdminTenantDetail {
  visible: boolean; title: string; pending: boolean; error: string | null; available: boolean; metrics: BsAdminMetric[]; trial: string; usage: string; limits: string
  subscriptionPending: boolean; subscriptionError: string | null; subscriptionAvailable: boolean; subscriptionMetrics: BsAdminMetric[]; resources: { id: string; label: string; value: string }[]; pendingChange: string; canRemovePrice: boolean
  controls: BsAdminChoice[]; billing: { id: string; action: string; status: string; reference: string; occurred: string }[]; sensitive: { id: string; status: string; action: string; reason: string; occurred: string }[]; notes: { id: string; note: string; detail: string }[]
}
export interface BsAdminSupportForm { reason: string; days: number; reference: string; billingNote: string; note: string }
export interface BsAdminSupportDialog { visible: boolean; title: string; dirty: boolean; pending: boolean; error: string | null; showDays: boolean; showBilling: boolean; showNote: boolean }
export interface BsAdminReceiptReviewForm { reason: string; amount: number; reference: string; date: string; mismatchReason: string }
export interface BsAdminReceiptReviewDialog { visible: boolean; title: string; dirty: boolean; pending: boolean; error: string | null; approving: boolean; mismatched: boolean; maxDate: string }
export interface BsAdminPriceForm { amount: number; effectiveFrom: string; expiresAt: string; reason: string }
export interface BsAdminPriceDialog { visible: boolean; title: string; dirty: boolean; pending: boolean; error: string | null }
export interface BsAdminPaymentConfigurationForm { recipient: string; paymentLink: string; qrImageUrl: string; instructionsEn: string; instructionsAr: string; reason: string }
export interface BsAdminPaymentConfigurationDialog { visible: boolean; dirty: boolean; pending: boolean; error: string | null; loadError: string | null }
export interface BsAdminCommerceView {
  selected: 'overview' | 'plans' | 'billing' | 'audit'; role: string; loading: boolean; denied: boolean; error: string; canMutate: boolean
  overviewPending: boolean; overviewError: string | null; metrics: BsAdminMetric[]; search: string; status: string; statusChoices: BsAdminChoice[]
  tenants: BsAdminTenantTable; recent: BsAdminAuditTable; audit: BsAdminAuditTable; plans: BsAdminPlanWorkspace; billing: BsAdminBillingTable; billingAudit: BsAdminAuditTable
  detail: BsAdminTenantDetail; tenantPlanDialog: BsAdminPlanDialog; supportDialog: BsAdminSupportDialog; receiptDialog: BsAdminReceiptReviewDialog; priceDialog: BsAdminPriceDialog; configuration: BsAdminPaymentConfigurationDialog
}
export interface BsAdminCommerceCopy {
  overview: string; plans: string; audit: string; billingQueue: string; denied: string; accessHint: string; retry: string; loading: string; loadFailed: string
  tenants: string; tenant: string; owner: string; access: string; plan: string; members: string; search: string; status: string; open: string; noRows: string; recentEvents: string; noEvents: string; action: string; reason: string; actor: string; occurred: string
  currentPlan: string; requestedPlan: string; listPrice: string; effectivePrice: string; paid: string; blockers: string; negotiated: string; reference: string; date: string; review: string; startReview: string; approve: string; reject: string; overridePrice: string; emptyBilling: string
  configuration: string; configurationHelp: string; recipient: string; paymentLink: string; qrImageUrl: string; instructionsEn: string; instructionsAr: string; save: string; cancel: string; usage: string; controls: string; billingHistory: string; sensitive: string; notes: string; emptySensitive: string; emptyNotes: string
  days: string; billingReference: string; billingNote: string; note: string; receivedAmount: string; receivedReference: string; receivedDate: string; mismatchReason: string; overrideAmount: string; effectiveFrom: string; expiresAt: string
}

import { doctorUuid } from './locationContext.ts'
import type { DoctorIdentity } from './authController'
import type { DoctorSaasStatus } from './saasStatus'
export type LifecycleAction = 'renewal' | 'cancellation' | 'reactivation'
export interface LifecycleRequest {
 id: string; subscriberId: string; periodId: string; termsId: string; accountRevision: number; action: LifecycleAction; documentRef: string
 observedState: Exclude<DoctorSaasStatus['state'], 'unconfigured'>; originalPeriodEndsAt: string; requestedAt: string
 status: 'requested'; effectiveAt: null; providerConfirmation: null; executionAvailable: false; entitlementChanged: false; chargeCreated: false
}
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v))
function invalid(): never { throw Error('DOCTOR_LIFECYCLE_REQUEST_INVALID') }
function instant(v: unknown): string {
 if (typeof v !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v) || !Number.isFinite(Date.parse(v))) invalid()
 return new Date(v).toISOString()
}
export function lifecycleRequest(value: unknown, identity: Pick<DoctorIdentity, 'userId'>): LifecycleRequest {
 if (!record(value) || value.subscriber_user_id !== identity.userId || !doctorUuid(value.request_id) || !doctorUuid(value.period_id) || !doctorUuid(value.terms_id)
  || !Number.isSafeInteger(value.account_revision) || Number(value.account_revision) < 1 || typeof value.action !== 'string' || !['renewal', 'cancellation', 'reactivation'].includes(value.action)
  || typeof value.document_ref !== 'string' || !/^[a-z0-9][a-z0-9._/-]{0,199}$/.test(value.document_ref)
  || typeof value.observed_state !== 'string' || !['trial', 'paid', 'expired', 'scheduled', 'suspended'].includes(value.observed_state) || value.status !== 'requested' || value.effective_at !== null
  || value.provider_confirmation !== null || value.execution_available !== false || value.entitlement_changed !== false || value.charge_created !== false
  || value.data_mode !== 'synthetic' || value.live_activation !== false) invalid()
 return { id: value.request_id as string, subscriberId: identity.userId, periodId: value.period_id as string, termsId: value.terms_id as string, accountRevision: Number(value.account_revision), action: value.action as LifecycleAction,
  documentRef: value.document_ref, observedState: value.observed_state as LifecycleRequest['observedState'], originalPeriodEndsAt: instant(value.original_period_ends_at), requestedAt: instant(value.requested_at),
  status: 'requested', effectiveAt: null, providerConfirmation: null, executionAvailable: false, entitlementChanged: false, chargeCreated: false }
}
/** A request never authorizes billing. Current state comes only from the separate trusted status read. */
export function lifecycleRequestView(status: DoctorSaasStatus, requests: readonly LifecycleRequest[]) {
 if (requests.some(r => r.subscriberId !== status.subscriberUserId) || new Set(requests.map(r => r.id)).size !== requests.length) invalid()
 const samePeriod = requests.filter(r => r.periodId === status.period?.id && r.termsId === status.period.termsId && r.accountRevision === status.revision)
 const actions = [...new Set(samePeriod.map(r => r.action))]
 return { currentState: status.state, currentPeriodId: status.period?.id ?? null, currentTermsId: status.terms?.id ?? null, currentPeriodEndsAt: status.period?.endsAt ?? null,
  requests: requests.map(r => ({ ...r })), pendingActions: actions, contradictoryRequests: actions.includes('cancellation') && (actions.includes('renewal') || actions.includes('reactivation')),
  historicalRequestIds: requests.filter(r => !samePeriod.includes(r)).map(r => r.id), requiresIndependentReview: requests.length > 0, effectiveCancellation: false as const,
  executionAvailable: false as const, chargeCreated: false as const, providerConfirmation: null }
}

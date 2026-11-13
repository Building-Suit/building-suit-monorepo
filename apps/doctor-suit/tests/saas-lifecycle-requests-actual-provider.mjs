// Existing owned actual Auth/PostgREST lifecycle only. No request is executed as a billing change.
import { randomUUID } from 'node:crypto'
import { lifecycleRequest, lifecycleRequestView } from '../app/utils/subscriptionLifecycleRequest.ts'
import { doctorSaasStatus } from '../app/utils/saasStatus.ts'
export async function verifySaasLifecycleRequestsProvider({ a, b, rpc, expect, setStage }) {
 setStage('actual persisted SaaS lifecycle request receipt and current-state separation')
 const before = await rpc(a.client, 'doctor_saas_status')
 expect(before.state === 'paid' && before.period?.id, 'Owned synthetic paid fixture required for review intake')
 const identity = { userId: a.user.id, sessionId: a.sessionId, practiceId: before.practice_id }
 const selected = { p_action: 'cancellation', p_account_revision: before.revision, p_period: before.period.id, p_terms: before.period.terms_id, p_document_ref: before.period.accepted_document_ref, p_acknowledged: true, p_key: randomUUID() }
 const accepted = await rpc(a.client, 'doctor_request_saas_lifecycle', selected)
 const request = lifecycleRequest(accepted, identity)
 expect(request.status === 'requested' && request.effectiveAt === null && request.providerConfirmation === null && request.chargeCreated === false, 'Request receipt asserted billing execution')
 expect(JSON.stringify(await rpc(a.client, 'doctor_request_saas_lifecycle', selected)) === JSON.stringify(accepted), 'Original-key request reconciliation changed receipt')
 const renewed = lifecycleRequest(await rpc(a.client, 'doctor_request_saas_lifecycle', { ...selected, p_action: 'renewal', p_key: randomUUID() }), identity)
 const after = await rpc(a.client, 'doctor_saas_status'), current = doctorSaasStatus(after, identity), view = lifecycleRequestView(current, [request, renewed])
 expect(after.state === before.state && after.revision === before.revision && after.period.id === before.period.id && after.period.ends_at === before.period.ends_at, 'Review request changed current period')
 expect(view.contradictoryRequests && !view.effectiveCancellation && !view.executionAvailable && !view.chargeCreated, 'Opposite requests silently executed billing policy')
 const list = await rpc(a.client, 'doctor_saas_lifecycle_requests')
 expect(list.total === 2 && list.items.every(item => item.subscriber_user_id === a.user.id && item.status === 'requested'), 'Actual request history lost original subscriber/action')
 expect((await rpc(b.client, 'doctor_saas_lifecycle_requests')).total === 0, 'Independent reviewer inherited subscriber request history')
 expect((await b.client.rpc('doctor_request_saas_lifecycle', { ...selected, p_key: randomUUID() })).error?.code === '40001', 'Other subscriber reused foreign period')
 console.log('Actual SaaS lifecycle review requests: persisted cancellation/renewal, original-key receipt, opposite requests held, current paid period unchanged and foreign-subscriber denial passed; execution/provider/live approval remains unavailable.')
}

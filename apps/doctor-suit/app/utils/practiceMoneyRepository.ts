import { doctorUuid } from './locationContext.ts'
import { practiceMoneyState, practicePaymentIntent, type PracticeMoneyScope, type PracticePaymentIntent } from './practiceMoney.ts'
export type PracticeMoneyQuery = Omit<PracticeMoneyScope, 'patientId'>
export interface PracticeMoneyClient { rpc(name: 'doctor_prepare_practice_payment' | 'doctor_advance_practice_payment' | 'doctor_practice_money_state', args: Record<string, unknown>): { abortSignal(signal: AbortSignal): PromiseLike<{ data: unknown; error: unknown }> } }
export interface PaymentPrepare { kind: 'collection' | 'refund'; chargeVersionId: string; originalEntryId: string | null; amountMinor: string; reason: string; currency: string; exponent: number }
export type PaymentAction = 'dispatch' | 'reconcile' | 'cancel'
/** A bounded feature-owned RPC interface, not a handwritten generated schema. */
export function practiceMoneyRepository(client: PracticeMoneyClient) {
 async function rpc(name: Parameters<PracticeMoneyClient['rpc']>[0], args: Record<string, unknown>, signal: AbortSignal) { const result = await client.rpc(name, args).abortSignal(signal); if (result.error) throw result.error; return result.data }
 function invalid(): never { throw Error('DOCTOR_PRACTICE_MONEY_INVALID') }
 return {
  async read(query: PracticeMoneyQuery, page: number, signal: AbortSignal) {
   const q = Object.freeze({ ...query }), selectedPage = page
   const raw = await rpc('doctor_practice_money_state', { p_practice: q.practiceId, p_location: q.locationId, p_charge: q.chargeId, p_page: selectedPage }, signal)
   if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !('patient_id' in raw) || !doctorUuid(raw.patient_id)) invalid()
   // The authorized exact-charge read derives the financial patient; no URL/client assertion grants it.
   const scope: PracticeMoneyScope = Object.freeze({ ...q, patientId: raw.patient_id as string })
   return { scope, model: practiceMoneyState(raw, scope, selectedPage) }
  },
  async prepare(scope: PracticeMoneyScope, input: PaymentPrepare, key: string, signal: AbortSignal) {
   const owner = Object.freeze({ ...scope }), expected = Object.freeze({ ...input })
   const raw = await rpc('doctor_prepare_practice_payment', { p_practice: owner.practiceId, p_location: owner.locationId, p_kind: expected.kind, p_charge_version: expected.chargeVersionId, p_original: expected.originalEntryId, p_minor: expected.amountMinor, p_reason: expected.reason, p_key: key }, signal), item = practicePaymentIntent(raw, owner)
   if (item.currency !== expected.currency || item.exponent !== expected.exponent || item.kind !== expected.kind || item.chargeVersionId !== expected.chargeVersionId || item.originalEntryId !== expected.originalEntryId || item.amountMinor !== expected.amountMinor || item.reason !== expected.reason.trim() || item.revision !== 1 || item.state !== 'pending' || item.entry !== null) invalid()
   return item
  },
  async advance(scope: PracticeMoneyScope, intent: PracticePaymentIntent, action: PaymentAction, outcome: 'accepted' | 'rejected' | null, key: string, signal: AbortSignal) {
   const owner = Object.freeze({ ...scope }), previous = Object.freeze({ ...intent }), command = action, simulated = outcome
   if (command === 'dispatch' ? previous.state !== 'pending' || !['accepted', 'rejected'].includes(String(simulated)) : simulated !== null || (command === 'cancel' ? previous.state !== 'pending' : previous.state !== 'unknown')) invalid()
   const raw = await rpc('doctor_advance_practice_payment', { p_practice: owner.practiceId, p_location: owner.locationId, p_intent: previous.id, p_revision: previous.revision, p_action: command, p_outcome: simulated, p_key: key }, signal), item = practicePaymentIntent(raw, owner)
   if (['id', 'chargeVersionId', 'kind', 'originalEntryId', 'originalReceipt', 'amountMinor', 'currency', 'exponent', 'reason', 'createdAt'].some(k => item[k as keyof PracticePaymentIntent] !== previous[k as keyof PracticePaymentIntent]) || item.revision !== previous.revision + 1
    || (command === 'dispatch' ? item.state !== 'unknown' : command === 'cancel' ? item.state !== 'failed' || item.reasonCode !== 'cancelled_before_attempt' : !['posted', 'failed'].includes(item.state))) invalid()
   return item
  },
 }
}
export type PracticeMoneyRepository = ReturnType<typeof practiceMoneyRepository>

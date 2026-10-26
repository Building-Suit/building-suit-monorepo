import type { DoctorIdentity } from './authController'
import { createDoctorEntitlementDeadline, type DoctorEntitlementTimers } from './entitlement.ts'
import { parsePracticeMinor } from './practiceBilling.ts'
import type { PracticeMoneyScope, PracticeMoneyState, PracticePaymentIntent } from './practiceMoney.ts'
import type { PracticeMoneyRepository, PracticeMoneyQuery, PaymentAction, PaymentPrepare } from './practiceMoneyRepository'
export interface PracticeMoneyForm { amount: string; reason: string }
export type MoneyFailure = 'denied' | 'conflict' | 'inactive' | 'invalid' | 'network'
export interface PracticeMoneyControllerState { epoch: number; loading: boolean; pending: boolean; uncertain: boolean; error: MoneyFailure | null; scope: PracticeMoneyScope | null; data: PracticeMoneyState | null; visible: boolean; form: PracticeMoneyForm; initial: string; kind: 'collection' | 'refund'; original: PracticePaymentIntent | null; formChargeVersion: string | null; formExponent: number | null }
export const practiceMoneyControllerState = (): PracticeMoneyControllerState => ({ epoch: 0, loading: false, pending: false, uncertain: false, error: null, scope: null, data: null, visible: false, form: { amount: '', reason: '' }, initial: '', kind: 'collection', original: null, formChargeVersion: null, formExponent: null })
function problem(error: unknown): MoneyFailure { const c = error && typeof error === 'object' && 'code' in error ? String(error.code) : ''; return c === '42501' ? 'denied' : c === '40001' || c === '23505' ? 'conflict' : ['DS001', 'DS006', 'DS007'].includes(c) ? 'inactive' : ['22023', '22P02', '23514'].includes(c) ? 'invalid' : 'network' }
export function createPracticeMoneyController(repo: PracticeMoneyRepository | null, state: PracticeMoneyControllerState, identity: () => DoctorIdentity | null, environment: string, timers?: DoctorEntitlementTimers, key = () => crypto.randomUUID()) {
 let generation = 0, reads = 0, disposed = false, loadedActor: string | null = null, query: PracticeMoneyQuery | null = null, abort = new AbortController()
 const deadline = createDoctorEntitlementDeadline(timers)
 let operation: { selected: string; run: (signal: AbortSignal) => Promise<unknown> } | null = null
 const actorKey = () => { const a = identity(); return a?.practiceId ? JSON.stringify(['doctor-suit', environment, a.userId, a.sessionId, a.practiceId, 'practice-money']) : null }
 const selection = () => query && actorKey() ? JSON.stringify([actorKey(), query]) : null
 const active = (g: number, selected: string | null) => !disposed && g === generation && selected === selection()
 const signal = () => AbortSignal.any([abort.signal, AbortSignal.timeout(20000)])
 function clear() { generation++; reads++; abort.abort(); abort = new AbortController(); operation = null; query = null; loadedActor = null; deadline.clear(); Object.assign(state, practiceMoneyControllerState(), { epoch: state.epoch + 1 }) }
 async function load(page = state.data?.page ?? 1) {
  const q = query ? { ...query } : null, g = generation, selected = selection(), r = ++reads, sentAt = timers?.now() ?? 0
  if (!repo || !q || !selected || state.pending || q.userId !== identity()?.userId || q.practiceId !== identity()?.practiceId) return false
  state.loading = true; state.error = null; deadline.clear()
  try {
   const result = await repo.read(q, page, signal())
   if (!active(g, selected) || r !== reads) return false
   loadedActor = actorKey(); state.scope = result.scope; state.data = result.model
   deadline.arm(result.model.entitlement, sentAt, () => { if (state.data) state.data = { ...state.data, canWrite: false } }, () => active(g, selected) && r === reads)
   return true
  } catch (error) { if (active(g, selected) && r === reads) { const p = problem(error); if (p === 'denied') clear(); state.error = p } return false }
  finally { if (active(g, selected) && r === reads) state.loading = false }
 }
 async function select(q: PracticeMoneyQuery | null) {
  if (disposed || state.pending || operation) return false
  if (!q || q.userId !== identity()?.userId || q.practiceId !== identity()?.practiceId) { clear(); state.error = 'denied'; return false }
  if (JSON.stringify(q) !== JSON.stringify(query)) { clear(); query = Object.freeze({ ...q }) }
  return load(1)
 }
 const editable = () => !disposed && loadedActor === actorKey() && Boolean(state.scope && state.data?.canWrite && selection()) && !state.loading && !state.pending && !operation
 function open(originalId?: string) {
  if (!editable()) return false
  const original = originalId ? state.data?.items.find(i => i.entry?.id === originalId && i.kind === 'collection' && i.state === 'posted') : null
  if (originalId && (!original?.entry?.refundableMinor || BigInt(original.entry.refundableMinor) === 0n) || (!originalId && BigInt(state.data!.availableMinor) === 0n)) return false
  state.kind = original ? 'refund' : 'collection'; state.original = original ? { ...original, entry: original.entry ? { ...original.entry } : null } : null
  state.formChargeVersion = state.data!.chargeVersionId; state.formExponent = state.data!.exponent; state.form = { amount: '', reason: '' }; state.initial = JSON.stringify(state.form); state.error = null; state.visible = true; return true
 }
 function input(): PaymentPrepare {
  if (!state.data || !state.formChargeVersion || state.formChargeVersion !== state.data.chargeVersionId || state.formExponent === null || state.formExponent !== state.data.exponent) throw Error('invalid')
  const minor = parsePracticeMinor(state.form.amount, state.formExponent), reason = state.form.reason.trim()
  const remaining = state.original ? state.data.items.find(i => i.entry?.id === state.original?.entry?.id)?.entry?.refundableMinor : state.data.availableMinor
  if (minor === '0' || remaining == null || BigInt(minor) > BigInt(remaining) || reason.length < 2 || reason.length > 500 || [...reason].some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '<' || c === '>')) throw Error('invalid')
  return { kind: state.kind, chargeVersionId: state.formChargeVersion, originalEntryId: state.original?.entry?.id ?? null, amountMinor: minor, reason, currency: state.data.currency, exponent: state.data.exponent }
 }
 async function perform() {
  if (!repo || !operation || state.pending || state.loading || operation.selected !== selection()) return false
  const g = generation, selected = selection(), current = operation; state.pending = true; state.error = null
  try {
   await current.run(signal())
   if (!active(g, selected) || current !== operation) return false
   operation = null; state.uncertain = false; state.visible = false; state.pending = false
   // A historical command receipt never replaces the latest read or triggers another movement.
   await load(); return true
  } catch (error) { if (active(g, selected) && operation === current) { const p = problem(error); if (p === 'denied') { clear(); state.error = p } else { state.error = p; state.uncertain = p === 'network'; if (!state.uncertain) operation = null } } return false }
  finally { if (active(g, selected)) state.pending = false }
 }
 async function save() {
  if (!editable() || !state.visible || !repo || !state.scope) return false
  try { const owner = Object.freeze({ ...state.scope }), prepared = Object.freeze(input()), k = key(); operation = { selected: selection()!, run: s => repo.prepare(owner, prepared, k, s) } }
  catch { state.error = 'invalid'; return false }
  return perform()
 }
 async function advance(id: string, revision: number, action: PaymentAction, outcome: 'accepted' | 'rejected' | null) {
  const item = state.data?.items.find(i => i.id === id && i.revision === revision)
  if (!repo || !state.scope || loadedActor !== actorKey() || !item || state.loading || state.pending || operation || (action === 'dispatch' && !editable()) || (action === 'reconcile' ? item.state !== 'unknown' : item.state !== 'pending')) return false
  const owner = Object.freeze({ ...state.scope }), prior = Object.freeze({ ...item, entry: item.entry ? Object.freeze({ ...item.entry }) : null }), k = key()
  operation = { selected: selection()!, run: s => repo.advance(owner, prior, action, outcome, k, s) }; return perform()
 }
 return { state, clear, select, refresh: load, open, save, advance, retry: perform, editable, valid: () => { try { input(); return true } catch { return false } }, visible: (value: boolean) => { if (!state.pending) state.visible = value }, page: (value: number) => Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? load(value) : Promise.resolve(false), dispose: () => { clear(); disposed = true } }
}

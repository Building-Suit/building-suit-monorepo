import type { DoctorIdentity } from './authController'
import type { DoctorLocationDirectory } from './locations'
import { createDoctorEntitlementDeadline, type DoctorEntitlementTimers } from './entitlement.ts'
import { parsePracticeMinor, formatPracticeMinor, type PracticeBillingScope, type ServicePriceVersion, type VisitChargeVersion } from './practiceBilling.ts'
import type { PracticeBillingBoard, BillingPages, ChargeHistory } from './practiceBillingBoard'
import type { PracticeBillingRepository, PriceWrite, ChargeWrite } from './practiceBillingRepository'
export interface BillingPriceForm { label: string; amount: string; currency: string; exponent: string }
export interface BillingChargeForm { priceId: string; visitId: string; quantity: string; reason: string }
export type BillingFailure = 'denied' | 'conflict' | 'invalid' | 'inactive' | 'network'
export interface PracticeBillingState {
 epoch: number; ready: boolean; loading: boolean; pending: boolean; uncertain: boolean; error: BillingFailure | null
 locations: DoctorLocationDirectory | null; locationPage: number; locationId: string | null; board: PracticeBillingBoard | null
 priceOpen: boolean; chargeOpen: boolean; editingPrice: ServicePriceVersion | null; editingCharge: VisitChargeVersion | null
 priceForm: BillingPriceForm; chargeForm: BillingChargeForm; initialPrice: string; initialCharge: string
 historyVisible: boolean; historyLoading: boolean; historyCharge: VisitChargeVersion | null; history: ChargeHistory | null; historyCursors: (number | null)[]
}
const emptyPrice = (): BillingPriceForm => ({ label: '', amount: '', currency: '', exponent: '' })
const emptyCharge = (): BillingChargeForm => ({ priceId: '', visitId: '', quantity: '1', reason: '' })
export const practiceBillingState = (): PracticeBillingState => ({ epoch: 0, ready: false, loading: false, pending: false, uncertain: false, error: null, locations: null, locationPage: 1, locationId: null, board: null,
 priceOpen: false, chargeOpen: false, editingPrice: null, editingCharge: null, priceForm: emptyPrice(), chargeForm: emptyCharge(), initialPrice: '', initialCharge: '', historyVisible: false, historyLoading: false, historyCharge: null, history: null, historyCursors: [] })
function failure(error: unknown): BillingFailure { const code = error && typeof error === 'object' && 'code' in error ? error.code : null; return code === '42501' ? 'denied' : ['40001', '23505'].includes(String(code)) ? 'conflict' : ['22023', '23514'].includes(String(code)) ? 'invalid' : ['DS001', 'DS006', 'DS007'].includes(String(code)) ? 'inactive' : 'network' }
export function createPracticeBillingController(repo: PracticeBillingRepository | null, state: PracticeBillingState, identity: () => DoctorIdentity | null, environment: string, timers?: DoctorEntitlementTimers, key = () => crypto.randomUUID()) {
 let generation = 0, readSequence = 0, historySequence = 0, disposed = false, loadedIdentity: string | null = null, abort = new AbortController()
 const deadline = createDoctorEntitlementDeadline(timers)
 let operation: { scope: string; run: (signal: AbortSignal) => Promise<unknown> } | null = null
 const identityKey = () => { const a = identity(); return a?.practiceId ? JSON.stringify(['doctor-suit', environment, a.userId, a.sessionId, a.practiceId, 'own-practice-billing']) : null }
 const scope = (): PracticeBillingScope | null => { const a = identity(); return a?.practiceId && state.locationId ? { userId: a.userId, practiceId: a.practiceId, locationId: state.locationId } : null }
 const scopeKey = () => identityKey() && state.locationId ? JSON.stringify([identityKey(), state.locationId]) : null
 const active = (g: number, selected: string | null) => !disposed && g === generation && selected === scopeKey()
 const signal = () => AbortSignal.any([abort.signal, AbortSignal.timeout(20000)])
 function clear() { generation++; readSequence++; historySequence++; abort.abort(); abort = new AbortController(); deadline.clear(); operation = null; loadedIdentity = null; const epoch = state.epoch + 1; Object.assign(state, practiceBillingState(), { epoch }) }
 async function initialize(page = state.locationPage) {
  if (!repo) { state.error = 'denied'; return false }
  if (disposed || state.pending || operation) return false
  const actor = identity(), selected = identityKey(), g = generation, r = ++readSequence
  if (!actor?.practiceId || !selected) { clear(); state.error = 'denied'; return false }
  state.loading = true; state.ready = false; state.error = null
  try {
   const directory = await repo.locations(actor.practiceId, page, signal())
   if (disposed || g !== generation || selected !== identityKey() || r !== readSequence) return false
   loadedIdentity = selected; state.locations = directory; state.locationPage = page
   const id = directory.rows.some(v => v.id === state.locationId) ? state.locationId : directory.rows[0]?.id ?? null
   state.locationId = id; state.board = null
   if (!id) { state.ready = true; return true }
   return await loadBoard({ prices: 1, charges: 1, visits: 1 })
  } catch (error) { if (!disposed && g === generation && selected === identityKey() && r === readSequence) { const problem = failure(error); if (problem === 'denied') clear(); state.error = problem } return false }
  finally { if (g === generation && r === readSequence) state.loading = false }
 }
 async function loadBoard(pages: BillingPages = state.board?.pages ?? { prices: 1, charges: 1, visits: 1 }) {
  const owner = scope(), selected = scopeKey(), g = generation, r = ++readSequence, sentAt = timers?.now() ?? 0
  if (!repo || !owner || loadedIdentity !== identityKey() || state.pending) return false
  state.loading = true; state.ready = false; state.error = null; deadline.clear()
  try {
   const board = await repo.board(owner, { ...pages }, signal())
   if (!active(g, selected) || r !== readSequence) return false
   state.board = board; state.ready = true
   deadline.arm(board.entitlement, sentAt, () => { if (state.board) state.board = { ...state.board, canWrite: false }; state.error = 'inactive' }, () => active(g, selected) && r === readSequence)
   return true
  } catch (error) { if (active(g, selected) && r === readSequence) { const problem = failure(error); if (problem === 'denied') clear(); state.error = problem } return false }
  finally { if (active(g, selected) && r === readSequence) state.loading = false }
 }
 async function refresh() { return loadedIdentity === identityKey() && state.locationId ? loadBoard() : initialize() }
 async function selectLocation(id: string) {
  if (disposed || state.pending || operation || !state.locations?.rows.some(v => v.id === id)) return false
  if (id === state.locationId) return true
  generation++; readSequence++; historySequence++; abort.abort(); abort = new AbortController(); deadline.clear()
  state.locationId = id; state.board = null; state.priceOpen = false; state.chargeOpen = false; state.editingPrice = null; state.editingCharge = null; state.priceForm = emptyPrice(); state.chargeForm = emptyCharge(); state.history = null; state.historyCharge = null; state.historyVisible = false
  return loadBoard({ prices: 1, charges: 1, visits: 1 })
 }
 const canEdit = () => !disposed && loadedIdentity === identityKey() && state.ready && !state.loading && !state.pending && !operation && Boolean(state.board?.canWrite)
 function startPrice(id?: string) {
  if (!canEdit()) return false
  const row = id ? state.board?.prices.find(p => p.id === id || p.serviceId === id) : null; if (id && !row) return false
  state.editingPrice = row ? { ...row } : null; state.priceForm = row ? { label: row.label, amount: formatPracticeMinor(row.unitMinor, row.exponent), currency: row.currency, exponent: String(row.exponent) } : emptyPrice()
  state.initialPrice = JSON.stringify(state.priceForm); state.priceOpen = true; state.error = null; return true
 }
 function startCharge(id?: string) {
  if (!canEdit()) return false
  const source = id ? state.board?.charges.find(c => c.charge.id === id || c.charge.chargeId === id) : null; if (id && !source) return false
  const current = source ? state.board?.prices.find(p => p.serviceId === source.charge.serviceId) : null
  state.editingCharge = source ? { ...source.charge } : null; state.chargeForm = source ? { priceId: current?.id ?? '', visitId: source.charge.visitId, quantity: String(source.charge.quantity), reason: '' } : emptyCharge()
  state.initialCharge = JSON.stringify(state.chargeForm); state.chargeOpen = true; state.error = null; return true
 }
 function priceInput(): PriceWrite {
  const form = state.priceForm
  if (!form.label.trim() || !/^[0-4]$/.test(form.exponent) || !/^[A-Z]{3}$/.test(form.currency.trim().toUpperCase())) throw Error('invalid')
  return { serviceId: state.editingPrice?.serviceId ?? null, revision: state.editingPrice?.revision ?? 0, label: form.label.trim(), unitMinor: parsePracticeMinor(form.amount, Number(form.exponent)), currency: form.currency.trim().toUpperCase(), exponent: Number(form.exponent) }
 }
 function chargeInput(): ChargeWrite {
  const form = state.chargeForm, previous = state.editingCharge, price = state.board?.prices.find(p => p.id === form.priceId), previousSource = previous ? state.board?.charges.find(c => c.charge.chargeId === previous.chargeId) : null, visit = previous ? previousSource?.visit : state.board?.visits.find(v => v.id === form.visitId)
  if (!price || !/^[1-9][0-9]{0,3}$/.test(form.quantity) || Number(form.quantity) > 1000 || form.reason.trim().length < 2 || !visit
   || (previous && (previousSource?.sourceMatches !== true || form.visitId !== previous.visitId || price.serviceId !== previous.serviceId || price.currency !== previous.currency || price.exponent !== previous.exponent))) throw Error('invalid')
  return { visitId: previous?.visitId ?? visit!.id, visitVersion: visit!.version, patientId: previous?.patientId ?? visit!.patientId, price: { ...price }, quantity: Number(form.quantity), chargeId: previous?.chargeId ?? null, revision: previous?.revision ?? 0, reason: form.reason.trim(), previous: previous ? { ...previous } : null }
 }
 async function perform() {
  if (!operation || !repo || state.loading || state.pending || operation.scope !== scopeKey()) return false
  const selected = scopeKey(), g = generation, current = operation; state.pending = true; state.error = null
  try {
   await current.run(signal())
   if (!active(g, selected) || operation !== current) return false
   operation = null; state.uncertain = false; state.priceOpen = false; state.chargeOpen = false; state.pending = false
   // Receipt acceptance and a later read failure are separate. Never resend an acknowledged command.
   await loadBoard(); return true
  } catch (error) {
   if (active(g, selected) && operation === current) { const problem = failure(error); if (problem === 'denied') { clear(); state.error = problem } else { state.error = problem; state.uncertain = problem === 'network'; if (!state.uncertain) operation = null } }
   return false
  } finally { if (active(g, selected)) state.pending = false }
 }
 async function savePrice() {
  if (!canEdit() || !state.priceOpen || !repo) return false
  try { const owner = scope()!, input = Object.freeze(priceInput()), commandKey = key(); operation = { scope: scopeKey()!, run: s => repo.price(owner, input, commandKey, s) } }
  catch { state.error = 'invalid'; return false }
  return perform()
 }
 async function saveCharge() {
  if (!canEdit() || !state.chargeOpen || !repo) return false
  try { const owner = scope()!, input = chargeInput(), commandKey = key(); operation = { scope: scopeKey()!, run: s => repo.charge(owner, input, commandKey, s) } }
  catch { state.error = 'invalid'; return false }
  return perform()
 }
 async function loadHistory(before: number | null) {
  const owner = scope(), selected = scopeKey(), charge = state.historyCharge ? { ...state.historyCharge } : null, g = generation, h = ++historySequence
  if (!repo || !owner || !charge) return false
  state.historyLoading = true
  try { const result = await repo.history(owner, charge, before, signal()); if (!active(g, selected) || h !== historySequence || !state.historyVisible) return false; state.history = result; return true }
  catch (error) { if (active(g, selected) && h === historySequence) { const problem = failure(error); if (problem === 'denied') clear(); state.error = problem } return false }
  finally { if (active(g, selected) && h === historySequence) state.historyLoading = false }
 }
 async function showHistory(id: string) { const source = state.board?.charges.find(c => c.charge.id === id || c.charge.chargeId === id); if (!source || state.pending) return false; state.historyCharge = { ...source.charge }; state.history = null; state.historyCursors = [null]; state.historyVisible = true; return loadHistory(null) }
 async function nextHistory() { const cursor = state.history?.nextBeforeRevision; if (cursor == null || state.historyLoading) return false; if (await loadHistory(cursor)) { state.historyCursors.push(cursor); return true } return false }
 async function previousHistory() { if (state.historyCursors.length < 2 || state.historyLoading) return false; const cursor = state.historyCursors.at(-2)!; if (await loadHistory(cursor)) { state.historyCursors.pop(); return true } return false }
 function closeHistory() { historySequence++; state.historyVisible = false; state.historyLoading = false; state.history = null; state.historyCharge = null; state.historyCursors = [] }
 return { state, clear, initialize, refresh, loadBoard, selectLocation, canEdit, startPrice, startCharge, savePrice, saveCharge, retry: perform, showHistory, nextHistory, previousHistory, closeHistory,
  locationPage: (page: number) => !state.pending && !operation && Number.isSafeInteger(page) && page > 0 && page <= 1000000 ? initialize(page) : Promise.resolve(false),
  page: (kind: keyof BillingPages, value: number) => state.board && !state.pending && Number.isSafeInteger(value) && value > 0 && value <= 1000000 ? loadBoard({ ...state.board.pages, [kind]: value }) : Promise.resolve(false),
  priceVisible: (value: boolean) => { if (!state.pending) state.priceOpen = value }, chargeVisible: (value: boolean) => { if (!state.pending) state.chargeOpen = value },
  validPrice: () => { try { priceInput(); return true } catch { return false } }, validCharge: () => { try { chargeInput(); return true } catch { return false } },
  dispose: () => { clear(); disposed = true },
 }
}

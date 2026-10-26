import test from 'node:test'
import assert from 'node:assert/strict'
import { practiceChargeMinor, formatPracticeMinor, servicePrice, visitCharge, requireChargeCorrection } from '../../app/utils/practiceBilling.ts'
const id = n => `d2060006-0000-4000-8000-${String(n).padStart(12,'0')}`
const scope = { userId: id(1), practiceId: id(21), locationId: id(31) }
const price = () => ({ id: id(51), service_id: id(50), revision: 1, practice_id: scope.practiceId, location_id: scope.locationId, doctor_user_id: scope.userId, actor_user_id: scope.userId, label: 'Synthetic entered visit fee', unit_minor: '29900', currency: 'EGP', currency_exponent: 2, effective_at: '2026-10-26T10:00:00Z', kind: 'service_price', data_mode: 'synthetic', tax_applicability: 'unreviewed', tax_minor: null, discount_available: false, live_collection: false })
const charge = () => ({ ...price(), id: id(61), charge_id: id(60), previous_id: null, visit_id: id(41), visit_version: 1, patient_id: id(42), price_id: id(51), quantity: 2, amount_minor: '59800', reason: 'Synthetic explicit charge', created_at: '2026-10-26T10:00:01Z', kind: 'visit_charge', tax_invoice_available: false })
const selected = () => ({ price: servicePrice(price(), scope), visitId: id(41), patientId: id(42) })
test('exact entered price times integer quantity uses decimal strings without rounding or floating-point loss', () => {
 assert.equal(practiceChargeMinor('29900', 2), '59800'); assert.equal(practiceChargeMinor('9007199254740991', 1), '9007199254740991'); assert.equal(practiceChargeMinor('0', 1000), '0')
 assert.equal(formatPracticeMinor('29900', 2), '299.00'); assert.equal(formatPracticeMinor('1', 4), '0.0001'); assert.equal(formatPracticeMinor('9007199254740991', 4), '900719925474.0991')
 for (const unit of ['01', '-1', '1.5', '1e2', ' 1', 1, '9007199254740992']) assert.throws(() => practiceChargeMinor(unit, 1), /BILLING_INVALID/)
 for (const quantity of [0, -1, 1.5, 1001, '2']) assert.throws(() => practiceChargeMinor('1', quantity), /BILLING_INVALID/)
 assert.throws(() => practiceChargeMinor('9007199254740991', 2), /BILLING_INVALID/)
})
test('later service prices do not rewrite a decoded historical charge or its original price reference', () => {
 const original = selected(), issued = visitCharge(charge(), scope, original), saved = structuredClone(issued)
 const newer = servicePrice({ ...price(), id: id(52), revision: 2, unit_minor: '40000', label: 'Synthetic new fee' }, scope)
 assert.equal(newer.unitMinor, '40000'); assert.deepEqual(issued, saved); assert.equal(issued.priceId, id(51)); assert.equal(issued.amountMinor, '59800')
 assert.throws(() => visitCharge(charge(), scope, { ...original, price: newer }), /BILLING_INVALID/)
})
test('price and charge projections reject cross-practice/location/doctor authority and forged tax/live claims', () => {
 for (const patch of [{ practice_id: id(22) }, { location_id: id(32) }, { doctor_user_id: id(2) }, { actor_user_id: id(2) }, { tax_applicability: 'exempt' }, { tax_minor: '0' }, { live_collection: true }, { discount_available: true }]) assert.throws(() => servicePrice({ ...price(), ...patch }, scope), /BILLING_INVALID/)
 for (const patch of [{ visit_id: id(43) }, { patient_id: id(44) }, { price_id: id(52) }, { unit_minor: '1' }, { amount_minor: '1' }, { currency: 'USD' }, { currency_exponent: 0 }, { tax_invoice_available: true }]) assert.throws(() => visitCharge({ ...charge(), ...patch }, scope, selected()), /BILLING_INVALID/)
})
test('correction appends an attributable new revision and preserves original visit/patient/service/currency', () => {
 const previous = visitCharge(charge(), scope, selected()), nextPrice = servicePrice({ ...price(), id: id(52), revision: 2, unit_minor: '40000' }, scope)
 const next = visitCharge({ ...charge(), id: id(62), revision: 2, previous_id: previous.id, price_id: nextPrice.id, unit_minor: nextPrice.unitMinor, amount_minor: '80000', reason: 'Synthetic reasoned correction' }, scope, { ...selected(), price: nextPrice })
 requireChargeCorrection(previous, next); assert.equal(previous.amountMinor, '59800'); assert.equal(next.amountMinor, '80000')
 for (const patch of [{ previousId: null }, { revision: 1 }, { revision: 3 }, { chargeId: id(63) }, { visitId: id(43) }, { patientId: id(44) }, { currency: 'USD' }, { exponent: 0 }]) assert.throws(() => requireChargeCorrection(previous, { ...next, ...patch }), /BILLING_INVALID/)
})
test('malformed identifiers, clocks, policy claims and unentered reason fail closed without projecting private fields', () => {
 for (const patch of [{ id: 'invalid' }, { effective_at: 'tomorrow' }, { currency_exponent: 1.5 }, { label: '<script>' }, { label: ' ' }, { currency: 'egp' }]) assert.throws(() => servicePrice({ ...price(), ...patch }, scope), /BILLING_INVALID/)
 for (const patch of [{ reason: '' }, { created_at: '2026-10-26' }, { previous_id: id(62) }]) assert.throws(() => visitCharge({ ...charge(), ...patch }, scope, selected()), /BILLING_INVALID/)
 const parsed = visitCharge({ ...charge(), secret: 'PRIVATE_SENSITIVE_SENTINEL', provider_body: 'PRIVATE_PROVIDER_BODY' }, scope, selected()); assert(!JSON.stringify(parsed).includes('PRIVATE_'))
})

test('entered decimal amounts require explicit precision and reject excess digits instead of rounding', async () => {
 const { parsePracticeMinor } = await import('../../app/utils/practiceBilling.ts')
 assert.equal(parsePracticeMinor('299', 2), '29900'); assert.equal(parsePracticeMinor('0.0001', 4), '1'); assert.equal(parsePracticeMinor('900719925474.0991', 4), '9007199254740991')
 for (const [value, exponent] of [['1.001', 2], ['1.0', 0], ['01', 2], ['1e2', 2], ['-1', 2], [' 1', 2], ['1', '2'], ['9007199254740991', 4]]) assert.throws(() => parsePracticeMinor(value, exponent), /BILLING_INVALID/)
})
const visitSource = () => ({ id: id(41), patient_id: id(42), patient_name: 'Synthetic entered patient', starts_at: '2026-10-26T09:00:00Z', state: 'completed', version: 1 })
const rawBoard = () => ({ actor_user_id: scope.userId, practice_id: scope.practiceId, location_id: scope.locationId, data_mode: 'synthetic', tax_applicability: 'unreviewed', live_collection: false, edition: 'synthetic_preview', location_archived: false, can_write: true,
 entitlement: { state: 'preview', revision: 0, writes_allowed: true, can_add_staff: true, can_add_clinic: true, over_limit: false, valid_until: null, observed_at: '2026-10-26T11:00:00Z' },
 price_page: 1, price_total: 1, prices: [price()], charge_page: 1, charge_total: 1, charges: [{ source_matches: true, price: price(), charge: charge(), visit: visitSource() }], visit_page: 1, visit_total: 1, visits: [visitSource()] })
const pages = () => ({ prices: 1, charges: 1, visits: 1 })
test('billing board admits historical price snapshots independently of current prices and rejects scope/count/authority contradictions', async () => {
 const { practiceBillingBoard } = await import('../../app/utils/practiceBillingBoard.ts'), raw = rawBoard()
 raw.prices = [{ ...price(), id: id(52), revision: 2, unit_minor: '40000' }]
 const board = practiceBillingBoard(raw, scope, pages()); assert.equal(board.prices[0].unitMinor, '40000'); assert.equal(board.charges[0].charge.unitMinor, '29900'); assert.equal(board.charges[0].charge.amountMinor, '59800')
 for (const patch of [{ actor_user_id: id(2) }, { price_total: 2 }, { charge_total: 2 }, { visit_page: 2 }, { location_archived: true }, { prices: [] }, { tax_applicability: 'exempt' }]) assert.throws(() => practiceBillingBoard({ ...rawBoard(), ...patch }, scope, pages()), /DIRECTORY_INVALID/)
})
test('read-only billing board retains original owned charge rows under inactive entitlement', async () => {
 const { practiceBillingBoard } = await import('../../app/utils/practiceBillingBoard.ts'), raw = rawBoard()
 raw.edition = 'administrative_candidate'; raw.can_write = false; raw.entitlement = { ...raw.entitlement, state: 'expired', revision: 1, writes_allowed: false, can_add_staff: false, can_add_clinic: false, valid_until: '2026-10-26T10:00:00Z' }
 const board = practiceBillingBoard(raw, scope, pages()); assert.equal(board.canWrite, false); assert.equal(board.charges[0].charge.amountMinor, '59800'); assert.equal(board.entitlement.state, 'expired')
 assert.throws(() => practiceBillingBoard({ ...raw, can_write: true }, scope, pages()), /DIRECTORY_INVALID/)
})
test('immutable history keyset remains contiguous when a newer correction is appended between page reads', async () => {
 const { chargeHistory } = await import('../../app/utils/practiceBillingBoard.ts'), selectedCharge = visitCharge(charge(), scope, selected())
 function history(total, before) { const first = before === null ? total : Math.min(before - 1, total), count = Math.min(20, first), last = first - count + 1; return { actor_user_id: scope.userId, practice_id: scope.practiceId, location_id: scope.locationId, charge_id: selectedCharge.chargeId, data_mode: 'synthetic', tax_applicability: 'unreviewed', live_collection: false, total, before_revision: before, next_before_revision: last > 1 ? last : null, items: Array.from({ length: count }, (_, i) => { const revision = first - i; return { price: price(), charge: { ...charge(), id: id(100 + revision), revision, previous_id: revision === 1 ? null : id(99 + revision) } } }) } }
 const a = chargeHistory(history(45, null), scope, selectedCharge, null), b = chargeHistory(history(46, a.nextBeforeRevision), scope, selectedCharge, a.nextBeforeRevision), c = chargeHistory(history(46, b.nextBeforeRevision), scope, selectedCharge, b.nextBeforeRevision)
 assert.equal(a.items[0].charge.revision, 45); assert.equal(b.items[0].charge.revision, 25); assert.equal(c.items[0].charge.revision, 5); assert.equal(c.nextBeforeRevision, null); assert.equal(new Set([...a.items, ...b.items, ...c.items].map(v => v.charge.id)).size, 45)
 const changed = history(45, null); changed.items[0].charge.charge_id = id(900); assert.throws(() => chargeHistory(changed, scope, selectedCharge, null), /DIRECTORY_INVALID/)
})
test('pending price/charge adapter calls cannot rewrite frozen source expectations or original RPC selections', async () => {
 const { practiceBillingRepository } = await import('../../app/utils/practiceBillingRepository.ts'), input = { serviceId: null, revision: 0, label: price().label, unitMinor: '29900', currency: 'EGP', exponent: 2 }, calls = []
 const repo = practiceBillingRepository({ rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => { input.unitMinor = '1'; return { error: null, data: { ...price(), unit_minor: '1' } } } } } })
 await assert.rejects(repo.price(scope, input, id(999), new AbortController().signal), /BILLING_INVALID/); assert.equal(calls[0].args.p_minor, '29900'); assert.equal(calls[0].args.p_key, id(999)); assert.equal(calls[0].args.p_practice, scope.practiceId)
 const expected = selected(), chargeInput = { visitId: id(41), visitVersion: 1, patientId: id(42), price: expected.price, quantity: 2, chargeId: null, revision: 0, reason: charge().reason, previous: null }
 const chargeRepo = practiceBillingRepository({ rpc() { return { abortSignal: async () => { chargeInput.price.unitMinor = '1'; return { error: null, data: { ...charge(), unit_minor: '1', amount_minor: '2' } } } } } })
 await assert.rejects(chargeRepo.charge(scope, chargeInput, id(998), new AbortController().signal), /BILLING_INVALID/)
})

async function controllerFixture(overrides = {}, timers) {
 const { createPracticeBillingController, practiceBillingState } = await import('../../app/utils/practiceBillingController.ts'), { practiceBillingBoard } = await import('../../app/utils/practiceBillingBoard.ts')
 const actor = { userId: scope.userId, sessionId: id(11), practiceId: scope.practiceId }, state = practiceBillingState(), calls = []
 let current = actor, raw = rawBoard(), sequence = 600
 const directory = owner => ({ practiceName: owner === scope.practiceId ? 'Synthetic own practice A' : 'Synthetic own practice B', rows: [{ id: owner === scope.practiceId ? scope.locationId : id(32), practiceId: owner, name: 'Synthetic selected clinic', timezone: 'Etc/UTC', phone: '', address: '', archivedAt: null, version: 1, canManage: true, canEdit: true }], total: 1, canCreate: true })
 const repo = { locations: async owner => directory(owner), board: async (s, p) => s.userId === scope.userId ? practiceBillingBoard(raw, s, p) : ({ prices: [], charges: [], visits: [], pages: p, totals: { prices: 0, charges: 0, visits: 0 }, canWrite: false, locationArchived: false, entitlement: { state: 'unconfigured', revision: 0, writesAllowed: false } }),
  history: async () => { throw Error('unused') }, price: async (s, input, key) => { calls.push({ input, key }); return servicePrice({ ...price(), unit_minor: input.unitMinor }, s) }, charge: async () => { throw Error('unused') }, ...overrides }
 const controller = createPracticeBillingController(repo, state, () => current, 'local', timers, () => id(sequence++))
 return { controller, state, calls, repo, actor: value => { current = value }, raw: value => { raw = value }, directory }
}
test('unknown price acknowledgement retains original inputs/key and prevents another command or clinic switch', async () => {
 const attempts = []; let accepted = null
 const f = await controllerFixture({ price: async (s, input, key) => { attempts.push({ input, key }); if (!accepted) { accepted = servicePrice({ ...price(), unit_minor: input.unitMinor }, s); throw { code: 'network' } } return accepted } })
 assert.equal(await f.controller.initialize(), true); assert.equal(f.controller.startPrice(), true); Object.assign(f.state.priceForm, { label: price().label, amount: '299', currency: 'EGP', exponent: '2' })
 assert.equal(await f.controller.savePrice(), false); assert.equal(f.state.uncertain, true); assert.equal(f.controller.startCharge(), false); assert.equal(await f.controller.selectLocation(id(32)), false)
 f.state.priceForm.amount = '900'; assert.equal(await f.controller.retry(), true); assert.equal(attempts.length, 2); assert.equal(attempts[0].key, attempts[1].key); assert.equal(attempts[1].input.unitMinor, '29900'); assert.equal(f.state.uncertain, false)
})
test('a known accepted command followed by read failure never becomes an automatic command retry', async () => {
 let reads = 0, writes = 0
 const { practiceBillingBoard } = await import('../../app/utils/practiceBillingBoard.ts')
 const f = await controllerFixture({ board: async (s, p) => { reads++; if (reads === 2) throw { code: 'network' }; return practiceBillingBoard(rawBoard(), s, p) }, price: async s => { writes++; return servicePrice(price(), s) } })
 await f.controller.initialize(); f.controller.startPrice(); Object.assign(f.state.priceForm, { label: price().label, amount: '299', currency: 'EGP', exponent: '2' })
 assert.equal(await f.controller.savePrice(), true); assert.equal(f.state.error, 'network'); assert.equal(f.state.uncertain, false); assert.equal(await f.controller.retry(), false); assert.equal(writes, 1)
 assert.equal(await f.controller.refresh(), true); assert.equal(writes, 1)
})
test('a late historical receipt after a newer board read cannot replace the current price version', async () => {
 let attempt = 0
 const f = await controllerFixture({ price: async s => { if (!attempt++) throw { code: 'network' }; return servicePrice({ ...price(), id: id(52), revision: 2 }, s) } })
 await f.controller.initialize(); f.controller.startPrice(price().id); f.state.priceForm.amount = '299'
 assert.equal(await f.controller.savePrice(), false)
 const newer = rawBoard(); newer.prices = [{ ...price(), id: id(53), revision: 3, unit_minor: '40000' }]; f.raw(newer); assert.equal(await f.controller.refresh(), true)
 assert.equal(await f.controller.retry(), true); assert.equal(f.state.board.prices[0].revision, 3); assert.equal(f.state.board.prices[0].unitMinor, '40000')
})
test('account replacement during an in-flight financial command discards the old private response without replay', async () => {
 let finish, attempted = 0
 const f = await controllerFixture({ price: async () => { attempted++; return new Promise(resolve => { finish = resolve }) } })
 await f.controller.initialize(); f.controller.startPrice(); Object.assign(f.state.priceForm, { label: price().label, amount: '299', currency: 'EGP', exponent: '2' }); const pending = f.controller.savePrice()
 f.actor({ userId: id(2), sessionId: id(12), practiceId: id(22) }); f.controller.clear(); await f.controller.initialize()
 finish(servicePrice(price(), scope)); assert.equal(await pending, false); assert.equal(f.state.locationId, id(32)); assert.equal(f.state.board.prices.length, 0); assert.equal(f.state.locations.practiceName, 'Synthetic own practice B'); assert.equal(attempted, 1); assert.equal(f.state.pending, false)
})
test('a late location directory cannot restore another identity after scoped invalidation', async () => {
 let finish, calls = 0
 const f = await controllerFixture({ locations: async practice => { calls++; if (calls === 1) return new Promise(resolve => { finish = resolve }); return { practiceName: 'Synthetic own practice B', rows: [{ id: id(32), practiceId: practice, name: 'B clinic', timezone: 'Etc/UTC', phone: '', address: '', archivedAt: null, version: 1, canManage: true, canEdit: false }], total: 1, canCreate: false } } })
 const first = f.controller.initialize(); f.actor({ userId: id(2), sessionId: id(12), practiceId: id(22) }); f.controller.clear(); await f.controller.initialize(); finish(f.directory(scope.practiceId))
 assert.equal(await first, false); assert.equal(f.state.locationId, id(32)); assert.equal(f.state.locations.practiceName, 'Synthetic own practice B'); assert.equal(f.state.board.prices.length, 0)
})
test('server-derived monotonic expiry removes write affordances while retaining allowed financial history', async () => {
 let now = 0, next, writes = 0
 const timers = { now: () => now, set: (callback, delay) => { next = { callback, delay }; return next }, clear: handle => { if (next === handle) next = null } }
 const { practiceBillingBoard } = await import('../../app/utils/practiceBillingBoard.ts'), raw = rawBoard()
 raw.edition = 'administrative_candidate'; raw.entitlement = { ...raw.entitlement, state: 'paid', revision: 1, valid_until: '2026-10-26T11:00:01Z' }
 const f = await controllerFixture({ board: async (s, p) => { now = 500; return practiceBillingBoard(raw, s, p) }, price: async () => { writes++; throw Error('unexpected') } }, timers)
 await f.controller.initialize(); assert.equal(next.delay, 500); now = 1000; next.callback(); assert.equal(f.state.board.canWrite, false); assert.equal(f.state.board.charges[0].charge.amountMinor, '59800'); assert.equal(f.controller.startPrice(), false); assert.equal(writes, 0)
 f.controller.dispose()
})

test('unknown charge acknowledgement retries the original visit/service/quantity/reason with one retained key', async () => {
 const attempts = []; let accepted
 const f = await controllerFixture({ charge: async (s, input, key) => {
  attempts.push({ input, key })
  if (!accepted) { const raw = { ...charge(), quantity: input.quantity, amount_minor: practiceChargeMinor(input.price.unitMinor, input.quantity), reason: input.reason }; accepted = visitCharge(raw, s, { price: input.price, visitId: input.visitId, patientId: input.patientId }); const board = rawBoard(); board.charges = [{ source_matches: true, price: price(), charge: raw, visit: visitSource() }]; f.raw(board); throw { code: 'network' } }
  return accepted
 } })
 const empty = rawBoard(); empty.charges = []; empty.charge_total = 0; f.raw(empty); await f.controller.initialize(); assert.equal(f.controller.startCharge(), true)
 Object.assign(f.state.chargeForm, { priceId: id(51), visitId: id(41), quantity: '2', reason: 'Original synthetic charge reason' })
 assert.equal(await f.controller.saveCharge(), false); assert.equal(f.state.uncertain, true); f.state.chargeForm.quantity = '9'; f.state.chargeForm.reason = 'Changed after request'
 assert.equal(await f.controller.retry(), true); assert.equal(attempts.length, 2); assert.equal(attempts[0].key, attempts[1].key); assert.equal(attempts[1].input.quantity, 2); assert.equal(attempts[1].input.reason, 'Original synthetic charge reason'); assert.equal(f.state.board.charges[0].charge.amountMinor, '59800')
})
test('billing presentation keeps stable logical row IDs, English/Arabic copy, original money and read-only history', async () => {
 const { practiceBillingCopy, practiceBillingView } = await import('../../app/utils/practiceBillingPresentation.ts'), f = await controllerFixture()
 await f.controller.initialize()
 for (const ar of [false, true]) {
  const copy = practiceBillingCopy(ar), view = practiceBillingView(f.controller, ar, true)
  assert.equal(view.priceRows[0].id, id(50)); assert.equal(view.chargeRows[0].id, id(60)); assert.equal(view.chargeRows[0].amount, '598.00 EGP'); assert.equal(view.canWrite, true); assert.equal(typeof copy.history, 'string'); assert(copy.title.length > 3)
 }
 assert.equal(practiceBillingView(f.controller, false, false).canWrite, false)
 f.state.board.canWrite = false; const view = practiceBillingView(f.controller, true, true); assert.equal(view.canWrite, false); assert.equal(view.chargeRows.length, 1); assert.equal(view.chargeRows[0].amount, '598.00 EGP')
})
test('billing workspace navigation is owner-specific and never follows a secretary grant in another practice', async () => {
 const { doctorWorkspaceNavigation } = await import('../../app/utils/workspaceNavigation.ts'), labels = { workspace: 'Workspace', patients: 'Patients', appointments: 'Appointments', availability: 'Availability', audit: 'Audit', locations: 'Locations', practice: 'Practice', team: 'Team', account: 'Account', billing: 'Your practice charges' }
 const links = access => doctorWorkspaceNavigation(access, labels).groups.flatMap(g => g.links).map(l => l.to)
 assert(links({ capabilities: [], portal: 'doctor', ownsPractice: true, hasCurrent: true, hasOptions: true, choosing: false }).includes('/practice-billing'))
 assert(!links({ capabilities: ['patients.read', 'appointments.write'], portal: 'secretary', ownsPractice: false, hasCurrent: true, hasOptions: true, choosing: false }).includes('/practice-billing'))
 assert(!links({ capabilities: ['patients.read'], portal: 'secretary', ownsPractice: true, hasCurrent: true, hasOptions: true, choosing: false }).includes('/practice-billing'))
})

test('temporary command pending state does not mislabel subscription authority as read-only', async () => {
 const { practiceBillingView } = await import('../../app/utils/practiceBillingPresentation.ts'), f = await controllerFixture(); await f.controller.initialize(); f.controller.startPrice(); f.state.pending = true
 const view = practiceBillingView(f.controller, false, true); assert.equal(view.canWrite, true); assert.equal(view.readOnly, false); assert.equal(view.priceEditor.disabled, true); assert.equal(view.pending, true)
})
test('a current-session billing denial clears all private models and retained operation without replay', async () => {
 let writes = 0
 const f = await controllerFixture({ price: async () => { writes++; throw { code: '42501' } } }); await f.controller.initialize(); f.controller.startPrice(); Object.assign(f.state.priceForm, { label: price().label, amount: '299', currency: 'EGP', exponent: '2' })
 assert.equal(await f.controller.savePrice(), false); assert.equal(f.state.error, 'denied'); assert.equal(f.state.board, null); assert.equal(f.state.locations, null); assert.equal(f.state.priceForm.label, ''); assert.equal(f.state.ready, false); assert.equal(f.state.uncertain, false); assert.equal(await f.controller.retry(), false); assert.equal(writes, 1)
})

test('legacy charge snapshots keep unknown visit-version evidence and new acknowledgements require the selected version', async () => {
 const legacy = visitCharge({ ...charge(), visit_version: null }, scope, selected()); assert.equal(legacy.visitVersion, null)
 const { practiceBillingRepository } = await import('../../app/utils/practiceBillingRepository.ts'), input = { visitId: id(41), visitVersion: 1, patientId: id(42), price: selected().price, quantity: 2, chargeId: null, revision: 0, reason: charge().reason, previous: null }, calls = []
 for (const version of [null, 2]) { const repo = practiceBillingRepository({ rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => ({ error: null, data: { ...charge(), visit_version: version } }) } } }); await assert.rejects(repo.charge(scope, input, id(997), new AbortController().signal), /BILLING_INVALID/) }
 assert.equal(calls[0].args.p_visit_version, 1); assert.equal(calls[0].args.p_patient, id(42)); assert.equal(calls[0].args.p_visit, id(41))
})

test('changed patient lineage or currency remains readable but requires review before a new correction', async () => {
 const { practiceBillingView } = await import('../../app/utils/practiceBillingPresentation.ts')
 for (const kind of ['patient', 'currency']) {
  let writes = 0
  const f = await controllerFixture({ charge: async () => { writes++; throw Error('unexpected') } }), raw = rawBoard()
  if (kind === 'patient') raw.charges[0].source_matches = false
  else raw.prices = [{ ...price(), id: id(52), revision: 2, currency: 'USD' }]
  f.raw(raw); await f.controller.initialize(); assert.equal(f.controller.startCharge(id(60)), true)
  const view = practiceBillingView(f.controller, false, true); assert.equal(view.chargeRows[0].amount, '598.00 EGP'); assert.equal(view.chargeEditor.disabled, true); assert.equal(view.chargeEditor.error, practiceBillingCopyForReview())
  assert.equal(await f.controller.saveCharge(), false); assert.equal(writes, 0)
 }
 function practiceBillingCopyForReview() { return 'Visit or price details changed. Review this charge before correction; its patient and currency cannot be replaced.' }
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorManualPaymentRepository } from '../../app/utils/manualPaymentRepository.ts'
import { doctorSaasQuote } from '../../app/utils/saasQuoteRepository.ts'
import { createManualPaymentController, manualPaymentState } from '../../app/utils/manualPaymentController.ts'
const id = n => `d2060000-0000-4000-8000-${String(n).padStart(12,'0')}`
const actor = { userId: id(1), sessionId: id(11), practiceId: id(21) }, signal = () => new AbortController().signal
const route = () => ({ state: 'unconfigured', merchant_eligibility: 'pending', route_approval: 'pending', credentials_custody: 'pending', tax_document_applicability: 'pending', provider_acceptance: 'unrun', checkout_url: null, purchase_available: false, paid_activation_available: false, live_activation: false })
const rawQuote = () => ({ quote_id: id(3), subscriber_user_id: actor.userId, practice_id: actor.practiceId, terms_id: id(4), configuration_revision: 2, account_revision: 0, account_state: 'unconfigured', current_period_id: null, billing_interval: 'monthly', currency: 'EGP', currency_exponent: 2, amount_minor: '29900', document_ref: 'synthetic-m6-003/v1', created_at: '2026-10-25T10:00:00Z', kind: 'configured_saas_offer', data_mode: 'synthetic', payment_route: route() })
const instructions = () => ({ request_id: id(8), subscriber_user_id: actor.userId, intent_id: id(6), quote_id: id(3), configuration_revision: 7, amount_minor: '29900', currency: 'EGP', currency_exponent: 2, acceptance_mode: 'synthetic', live_acceptance_enabled: false, recipient: { id: id(9), kind: 'ipa', address: 'synthetic-only@instapay', beneficiary_name: 'Synthetic fixture beneficiary', instructions_en: 'Synthetic fixture only', instructions_ar: 'اختبار اصطناعي فقط' } })
function fixture(patches = {}) {
 const calls = []; let external = 0
 const data = { doctor_create_saas_quote: rawQuote(), doctor_prepare_saas_payment: { intent_id: id(6), quote: rawQuote(), state: 'awaiting_route_approval', created_at: '2026-10-25T10:00:01Z', payment_route: route() }, doctor_prepare_manual_payment: instructions(), ...patches }
 const client = { rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => ({ data: data[name], error: null }) } } }
 const repo = doctorManualPaymentRepository(client, 'http://127.0.0.1:65321', 'synthetic-unused-key', async () => { external++; throw Error('No external transport allowed') })
 return { repo, calls, external: () => external }
}
const selection = () => ({ termsId: id(4), configurationRevision: 2, accountRevision: 0, interval: 'monthly', documentRef: 'synthetic-m6-003/v1' })
test('manual instructions reject a stale configuration revision even when the response is otherwise valid synthetic data', async () => {
 const f = fixture({ doctor_prepare_manual_payment: { ...instructions(), configuration_revision: 8 } })
 await assert.rejects(f.repo.instructions(actor, id(6), 7, id(7), signal(), doctorSaasQuote(rawQuote(), actor)), /CONTRACT_INVALID/); assert.equal(f.external(), 0)
})
test('manual instructions must retain the frozen quote ID, exact minor string, currency and exponent', async () => {
 for (const patch of [{ quote_id: id(30) }, { amount_minor: '1' }, { currency: 'USD' }, { currency_exponent: 0 }]) { const f = fixture({ doctor_prepare_manual_payment: { ...instructions(), ...patch } }); await assert.rejects(f.repo.instructions(actor, id(6), 7, id(7), signal(), doctorSaasQuote(rawQuote(), actor)), /CONTRACT_INVALID/); assert.equal(f.external(), 0) }
})
test('held intent cannot silently return a changed immutable quote under the same quote ID', async () => {
 for (const patch of [{ amount_minor: '1' }, { terms_id: id(40) }, { billing_interval: 'yearly' }, { document_ref: 'synthetic-m6-003/v2' }, { configuration_revision: 3 }]) {
  const f = fixture({ doctor_prepare_saas_payment: { intent_id: id(6), quote: { ...rawQuote(), ...patch }, state: 'awaiting_route_approval', created_at: '2026-10-25T10:00:01Z', payment_route: route() } })
  await assert.rejects(f.repo.intent(actor, id(3), id(5), signal(), doctorSaasQuote(rawQuote(), actor)), /CONTRACT_INVALID/); assert.equal(f.external(), 0)
 }
})
test('valid synthetic quote → held intent → instructions preserves exact server selections and never creates provider traffic or live checkout', async () => {
 const f = fixture(), q = await f.repo.quote(actor, selection(), id(2), signal()), i = await f.repo.intent(actor, q.id, id(5), signal(), q), p = await f.repo.instructions(actor, i.id, 7, id(7), signal(), q)
 assert.equal(p.quoteId, q.id); assert.equal(p.amountMinor, q.amountMinor); assert.equal(p.currency, q.currency); assert.equal(p.exponent, q.currencyExponent); assert.equal(i.purchaseAvailable, false); assert.equal(i.liveActivation, false); assert.equal(f.external(), 0)
 assert.deepEqual(f.calls.map(c => c.args), [{ p_terms: id(4), p_configuration_revision: 2, p_account_revision: 0, p_interval: 'monthly', p_document_ref: 'synthetic-m6-003/v1', p_key: id(2) }, { p_quote: id(3), p_key: id(5) }, { p_intent: id(6), p_configuration_revision: 7, p_key: id(7) }])
})
test('actual controller/repository pipeline refuses mismatched instructions and retains no wrong payment amount', async () => {
 for (const mismatch of [false, true]) {
  const f = fixture(mismatch ? { doctor_prepare_manual_payment: { ...instructions(), amount_minor: '1' } } : {}), state = manualPaymentState(), repo = { ...f.repo, capability: async () => false, queue: async () => ({ items: [], total: 0, page: 1, activationConfigured: false }), catalog: async () => ({ revision: 2, plans: [{ key: 'starter', terms: { id: id(4), termsDocumentRef: 'synthetic-m6-003/v1' } }] }), configuration: async () => ({ revision: 7, configured: true, mode: 'synthetic' }), status: async () => ({ revision: 0 }), document: async () => ({ termsId: id(4) }) }
  let key = 80; const controller = createManualPaymentController(repo, state, () => actor, 'local', () => {}, () => id(key++)); assert.equal(await controller.load(), true); assert.equal(await controller.choose(), true); state.accepted = true
  assert.equal(await controller.prepare(), !mismatch); assert.equal(state.instructions?.amountMinor ?? null, mismatch ? null : '29900'); assert.equal(f.external(), 0)
 }
})

test('frozen quote comparison cannot be rewritten while an RPC is pending', async () => {
 for (const stage of ['intent', 'instructions']) {
  const selected = doctorSaasQuote(rawQuote(), actor)
  const client = { rpc() { return { abortSignal: async () => { selected.amountMinor = '1'; return { error: null, data: stage === 'instructions' ? { ...instructions(), amount_minor: '1' } : { intent_id: id(6), quote: { ...rawQuote(), amount_minor: '1' }, state: 'awaiting_route_approval', created_at: '2026-10-25T10:00:01Z', payment_route: route() } } } } } }
  const repo = doctorManualPaymentRepository(client, 'http://127.0.0.1:65321', 'synthetic-unused-key')
  await assert.rejects(stage === 'intent' ? repo.intent(actor, id(3), id(5), signal(), selected) : repo.instructions(actor, id(6), 7, id(7), signal(), selected), /CONTRACT_INVALID/)
 }
})

test('financial diagnostic reporter emits only whitelisted phase/source metadata and never private error or annotation content', async () => {
 const { default: Reporter } = await import('../e2e/financial-reporter.mjs'), reporter = new Reporter(), captured = [], original = console.log
 try {
  console.log = line => captured.push(line)
  reporter.onTestEnd({ title: 'DOS-M6-003-C02-EN', annotations: [{ type: 'financial-stage', description: 'quote_identity' }, { type: 'financial-stage', description: 'PRIVATE_ANNOTATION_SENTINEL' }] }, { status: 'failed', error: { message: 'PRIVATE_ERROR_SENTINEL', stack: 'PRIVATE_AUTH_SENTINEL at /owned/source/dos-m6-003.spec.ts:42:7' } })
  reporter.onEnd({ status: 'failed' })
 } finally { console.log = original }
 const text = captured.join(''), receipt = JSON.parse(captured[0]); assert.equal(receipt.cases[0].phase, 'quote_identity'); assert.deepEqual(receipt.cases[0].source_location, { file: 'dos-m6-003.spec.ts', line: 42, column: 7 }); assert(!text.includes('PRIVATE_')); assert.equal(receipt.live_payment_acceptance, false)
})

test('server-ready payment reads cannot expose interactive actions before client hydration and session verification',async()=>{
 const {manualPaymentView}=await import('../../app/utils/manualPaymentPresentation.ts'),state=manualPaymentState();state.ready=true
 const controller={state,selected:()=>null,canPrepare:()=>true}
 for(const ar of[false,true]){const server=manualPaymentView(controller,ar,false);assert.equal(server.ready,true);assert.equal(server.pending,true);assert.equal(server.canPrepare,false);assert.equal(server.canSubmit,false);assert.equal(server.canUpload,false);const mounted=manualPaymentView(controller,ar,true);assert.equal(mounted.pending,false);assert.equal(mounted.canPrepare,true)}
 state.pending=true;assert.equal(manualPaymentView(controller,false,true).pending,true)
})

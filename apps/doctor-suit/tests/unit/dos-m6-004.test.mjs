import test from 'node:test'
import assert from 'node:assert/strict'
import { doctorManualPaymentRepository } from '../../app/utils/manualPaymentRepository.ts'
import { manualNotice } from '../../app/utils/manualPayments.ts'
const id = n => `d2060004-0000-4000-8000-${String(n).padStart(12,'0')}`
const owner = { userId: id(1), sessionId: id(11), practiceId: id(21) }, reviewer = { userId: id(2), sessionId: id(12), practiceId: null }, signal = () => new AbortController().signal
function raw() { return { id: id(3), subscriber_user_id: owner.userId, intent_id: id(4), quote_id: id(5), terms_id: id(6), billing_interval: 'monthly', amount_minor: '29900', currency: 'EGP', currency_exponent: 2, beneficiary_name: 'Synthetic frozen beneficiary', recipient_address: 'synthetic-only@instapay', recipient_kind: 'ipa', transfer_reference: 'SYNTHETIC-CLAIM', transferred_at: '2026-10-25T10:00:00Z', created_at: '2026-10-25T10:00:01Z', status: 'submitted', revision: 0, review_reason: null, period_id: null, requires_attention: false, independent_verification_required: true, automatic_verification: false, live_acceptance_enabled: false, evidence: [], history: [] } }
function next(previous, action) { return { ...structuredClone(previous), status: action, revision: previous.revision + 1, review_reason: 'Synthetic review reason', period_id: action === 'activated' ? id(70) : null, history: [...structuredClone(previous.history), { revision: previous.revision + 1, action, actor: reviewer.userId, reason: 'Synthetic review reason', at: `2026-10-25T10:00:0${previous.revision + 2}Z` }] } }
const instructions = () => ({ requestId: id(8), intentId: id(4), quoteId: id(5), configurationRevision: 2, amountMinor: '29900', currency: 'EGP', exponent: 2, recipient: { id: id(9), kind: 'ipa', address: 'synthetic-only@instapay', beneficiary: 'Synthetic frozen beneficiary', english: 'Synthetic instructions', arabic: 'تعليمات اختبار اصطناعية' } })
const input = (action = 'under_review') => ({ action, reason: 'Synthetic review reason', reference: action === 'funds_verified' ? 'SYNTHETIC-BANK-ENTRY' : null, amount: action === 'funds_verified' ? '29900' : null, currency: action === 'funds_verified' ? 'EGP' : null, at: action === 'funds_verified' ? '2026-10-25T10:00:00Z' : null, verification: action === 'funds_verified' ? 'SYNTHETIC-INDEPENDENT-RECORD' : null, independent: action === 'funds_verified' })
function fixture(response, mutate = () => {}) {
 const calls = []; let external = 0
 const client = { rpc(name, args) { calls.push({ name, args }); return { abortSignal: async () => { mutate(); return { data: response, error: null } } } } }
 return { repo: doctorManualPaymentRepository(client, 'http://127.0.0.1:65321', 'synthetic-unused-key', async () => { external++; throw Error('External transport forbidden') }), calls, external: () => external }
}
const immutablePatches = () => [{ subscriber_user_id: id(10) }, { intent_id: id(40) }, { quote_id: id(50) }, { terms_id: id(60) }, { billing_interval: 'yearly' }, { amount_minor: '1' }, { currency: 'USD' }, { currency_exponent: 0 }, { beneficiary_name: 'Different synthetic beneficiary' }, { recipient_address: 'different-synthetic@instapay' }, { recipient_kind: 'mobile' }, { transfer_reference: 'DIFFERENT-SYNTHETIC-CLAIM' }, { transferred_at: '2026-10-25T11:00:00Z' }, { created_at: '2026-10-25T10:00:02Z' }]
test('independent review response cannot substitute the notice subscriber, immutable quote/money/recipient or original claim', async () => {
 const original = manualNotice(raw(), reviewer, true)
 for (const patch of immutablePatches()) { const f = fixture({ ...next(raw(), 'under_review'), ...patch }); await assert.rejects(f.repo.review(reviewer, original, input(), id(90), signal()), /CONTRACT_INVALID/); assert.equal(f.external(), 0) }
})
test('separate activation response must retain the same independently reviewed notice and immutable source', async () => {
 const verified = next(raw(), 'funds_verified'), original = manualNotice(verified, reviewer, true)
 for (const patch of immutablePatches()) { const f = fixture({ ...next(verified, 'activated'), ...patch }); await assert.rejects(f.repo.activate(reviewer, original, id(91), signal()), /CONTRACT_INVALID/); assert.equal(f.external(), 0) }
})
test('submission acknowledgement binds precision, beneficiary and exact original reference/time as well as quote money', async () => {
 for (const patch of [{ currency_exponent: 0 }, { beneficiary_name: 'Changed synthetic beneficiary' }, { recipient_address: 'other-synthetic@instapay' }, { recipient_kind: 'mobile' }, { transfer_reference: 'CHANGED-CLAIM' }, { transferred_at: '2026-10-25T11:00:00Z' }]) { const f = fixture({ ...raw(), ...patch }); await assert.rejects(f.repo.submit(owner, instructions(), 'SYNTHETIC-CLAIM', raw().transferred_at, id(92), signal()), /CONTRACT_INVALID/); assert.equal(f.external(), 0) }
})
test('a customer submission response cannot upgrade its own claim into funds verification or activated entitlement', async () => {
 for (const response of [next(raw(), 'funds_verified'), next(next(raw(), 'funds_verified'), 'activated')]) { const f = fixture(response); await assert.rejects(f.repo.submit(owner, instructions(), 'SYNTHETIC-CLAIM', raw().transferred_at, id(92), signal()), /CONTRACT_INVALID/); assert.equal(f.external(), 0) }
})
test('review/activation append history without rewriting prior reviewer evidence or dropping an existing receipt', async () => {
 const previous = next(raw(), 'under_review'); previous.evidence = [{ id: id(30), notice_id: id(3), filename: 'synthetic.pdf', mime_type: 'application/pdf', byte_size: 10, sha256: 'a'.repeat(64) }]
 const original = manualNotice(previous, reviewer, true)
 for (const changed of ['prior-actor', 'prior-reason', 'prior-time', 'new-actor', 'dropped-evidence', 'changed-evidence']) {
  const response = next(previous, 'funds_verified')
  if (changed === 'prior-actor') response.history[0].actor = id(10)
  if (changed === 'prior-reason') response.history[0].reason = 'Changed original reason'
  if (changed === 'prior-time') response.history[0].at = '2026-10-25T11:00:00Z'
  if (changed === 'new-actor') response.history[1].actor = id(10)
  if (changed === 'dropped-evidence') response.evidence = []
  if (changed === 'changed-evidence') response.evidence[0].sha256 = 'b'.repeat(64)
  const f = fixture(response); await assert.rejects(f.repo.review(reviewer, original, input('funds_verified'), id(93), signal()), /CONTRACT_INVALID/)
 }
})
test('pending RPC cannot mutate the captured original notice/instructions to authorize substituted money or recipient', async () => {
 const selected = manualNotice(raw(), reviewer, true), f = fixture({ ...next(raw(), 'under_review'), amount_minor: '1' }, () => { selected.amountMinor = '1' })
 await assert.rejects(f.repo.review(reviewer, selected, input(), id(94), signal()), /CONTRACT_INVALID/)
 const original = instructions(), submit = fixture({ ...raw(), beneficiary_name: 'Changed synthetic beneficiary' }, () => { original.recipient.beneficiary = 'Changed synthetic beneficiary' })
 await assert.rejects(submit.repo.submit(owner, original, 'SYNTHETIC-CLAIM', raw().transferred_at, id(95), signal()), /CONTRACT_INVALID/)
})
test('valid synthetic claim/review/activation chain preserves immutable provenance, original keys and equivalent timestamp instants without provider traffic', async () => {
 const claim = { ...raw(), transferred_at: '2026-10-25T12:00:00+02:00' }, submission = fixture(claim)
 const recorded = await submission.repo.submit(owner, instructions(), 'SYNTHETIC-CLAIM', raw().transferred_at, id(96), signal()); assert.equal(recorded.status, 'submitted'); assert.equal(recorded.periodId, null)
 const reviewedRaw = next(claim, 'funds_verified'), review = fixture(reviewedRaw), reviewed = await review.repo.review(reviewer, recorded, input('funds_verified'), id(97), signal()); assert.equal(reviewed.status, 'funds_verified'); assert.equal(reviewed.periodId, null)
 const activatedRaw = next(reviewedRaw, 'activated'); activatedRaw.history[0].at = '2026-10-25T12:00:02+02:00'
 const activation = fixture(activatedRaw), activated = await activation.repo.activate(reviewer, reviewed, id(98), signal()); assert.equal(activated.status, 'activated'); assert.equal(activated.periodId, id(70)); assert.equal(activated.history.length, 2); assert.equal(activated.quoteId, id(5)); assert.equal(activated.amountMinor, '29900')
 assert.deepEqual([submission.calls[0].args.p_key, review.calls[0].args.p_key, activation.calls[0].args.p_key], [id(96), id(97), id(98)]); assert.equal(submission.external() + review.external() + activation.external(), 0)
})

test('a late original verification acknowledgement cannot overwrite a newer activated history after explicit reconciliation', async () => {
 const { createManualPaymentController, manualPaymentState } = await import('../../app/utils/manualPaymentController.ts')
 const first = manualNotice(raw(), reviewer, true), verified = manualNotice(next(raw(), 'funds_verified'), reviewer, true), activated = manualNotice(next(next(raw(), 'funds_verified'), 'activated'), reviewer, true)
 let current = first, attempts = 0; const keys = []
 const repo = { capability: async () => true, queue: async () => ({ items: [current], total: 1, page: 1, activationConfigured: true }), review: async (_actor, _notice, _input, key) => { keys.push(key); if (!attempts++) throw Error('Synthetic acknowledgement lost after acceptance'); return verified } }
 const state = manualPaymentState(), controller = createManualPaymentController(repo, state, () => reviewer, 'local', () => {}, () => id(99))
 await controller.load(true); controller.select(first.id); state.reason = 'Synthetic independent bank check'; assert.equal(await controller.review('under_review'), false); assert.equal(state.uncertain, true)
 current = activated; assert.equal(await controller.load(true), true); assert.equal(state.items[0].revision, 2); assert.equal(await controller.retry(), true)
 assert.equal(state.items[0].status, 'activated'); assert.equal(state.items[0].revision, 2); assert.equal(state.items[0].history.length, 2); assert.equal(state.items[0].periodId, id(70)); assert.equal(keys[0], keys[1])
})

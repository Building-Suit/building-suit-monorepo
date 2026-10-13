import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePaymentQueue, paymentCommand, emptyReview, approvalBlocked, confirmPaymentResult, evidenceAccessRequest, parseEvidenceAccess } from '../../app/utils/payment-review.ts'
const id = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const payment = () => ({ id, shopId: other, shopName: 'Synthetic Shop', status: 'submitted', requestedPlanName: 'Frozen plan', requestedPlanSlug: 'frozen-plan', billingInterval: 'monthly', currency: 'EGP', listPriceAmount: 150, effectivePriceAmount: 120, paidAmount: 120, transferDate: '2026-10-07', transferReference: 'Synthetic transfer', priceSource: 'catalog', usageBlockers: [], resourceLimits: { active_locations: 1, active_members: 2, active_products: 5, active_services: 5, active_customers: 10, active_suppliers: 10 }, evidence: [] })
const draft = () => ({ ...emptyReview(), action: 'approve', reason: 'Externally verified transfer', externallyVerified: true, receivedAmount: '120.00', receivedReference: 'Synthetic bank reference', receivedDate: '2026-10-07' })
const command = d => paymentCommand(id, payment(), d || draft(), () => other, '2026-10-07')
test('actual queue projection preserves frozen prices and never substitutes missing terms/evidence', () => {
  const p = payment(); delete p.resourceLimits; delete p.evidence
  const result = parsePaymentQueue({ items: [p], total: 1000, page: 2, pageSize: 25 })
  assert.equal(result.items[0].resourceLimits, null); assert.equal(result.items[0].evidence, null)
  assert.equal(result.items[0].listPriceAmount, 150); assert.equal(approvalBlocked(result.items[0]), true)
  assert.throws(() => parsePaymentQueue({ items: [p], total: 1, page: 1, pageSize: 101 }))
  assert.throws(() => parsePaymentQueue({ items: [{ ...p, effectivePriceAmount: '120' }], total: 1, page: 1, pageSize: 25 }))
  const blocked = parsePaymentQueue({ items: [{ ...payment(), usageBlockers: [{ resource: 'active_products', used: 8, limit: 5, excess: 3 }] }], total: 1, page: 1, pageSize: 25 }).items[0]
  assert.deepEqual(blocked.usageBlockers, [{ resource: 'active_products', usage: 8, limit: 5 }]); assert.equal(approvalBlocked(blocked), true)
})
test('approval requires external verification, valid money/date/reference, mismatch reason and no blockers', () => {
  assert.throws(() => command({ ...draft(), externallyVerified: false }))
  assert.throws(() => command({ ...draft(), receivedAmount: '119' }))
  assert.equal(command({ ...draft(), receivedAmount: '119', amountOverrideReason: 'Verified bank difference' }).payload.payload.receivedAmount, 119)
  assert.throws(() => paymentCommand(id, { ...payment(), paidAmount: 119 }, draft(), () => other, '2026-10-07'))
  for (const receivedAmount of ['0', '-1', 'NaN', '1e2', '120.001', '99999999999']) assert.throws(() => command({ ...draft(), receivedAmount }))
  for (const receivedDate of ['2026-10-08', '2026-02-30', '2025-01-01', 'bad']) assert.throws(() => command({ ...draft(), receivedDate }))
  assert.throws(() => paymentCommand(id, { ...payment(), resourceLimits: null }, draft(), () => other, '2026-10-07'))
  assert.throws(() => paymentCommand(id, { ...payment(), usageBlockers: [{ resource: 'active_products', usage: 8, limit: 5 }] }, draft(), () => other, '2026-10-07'))
})
test('review/rejection require a reason and correct state; no evidence auto-confirms anything', () => {
  for (const action of ['mark_under_review', 'reject']) {
    assert.deepEqual(command({ ...emptyReview(), action, reason: 'Synthetic review reason' }).payload.payload, {})
    assert.throws(() => command({ ...emptyReview(), action }))
  }
  assert.throws(() => paymentCommand(id, { ...payment(), status: 'approved' }, draft(), () => other, '2026-10-07'))
  assert.throws(() => paymentCommand(id, { ...payment(), status: 'under_review' }, { ...emptyReview(), reason: 'Synthetic reason' }, () => other))
})
test('lost response retries unchanged input and accepts only correlated authoritative subscription/audit result', async () => {
  const d = draft(), request = command(d), snapshot = JSON.stringify(request)
  d.receivedAmount = '1'
  const result = { requestId: request.requestId, correlationId: request.correlationId, targetAuditId: id, targetResultVersion: 1, replayed: true,
    data: { id, status: 'approved', approved_subscription_end: '2026-11-07T00:00:00Z', subscription: { id: other, status: 'active', periodEnd: '2026-11-07T00:00:00Z' } } }
  const sent = []
  async function send() { sent.push(JSON.stringify(request)); if (sent.length === 1) throw new Error('outcome_unknown'); return confirmPaymentResult(request, result) }
  await assert.rejects(send()); assert.equal((await send()).replayed, true)
  assert.equal(sent[0], snapshot); assert.equal(sent[1], snapshot)
  for (const bad of [{ ...result, targetAuditId: null }, { ...result, requestId: id }, { ...result, data: { id, status: 'approved' } }, { ...result, replayed: undefined }]) assert.throws(() => confirmPaymentResult(request, bad))
  assert.equal(confirmPaymentResult(request, result).commercialPeriodId, null)
})
test('evidence review is explicit, bound to evidence/submission and time bounded', () => {
  assert.deepEqual(evidenceAccessRequest(id, id, other, () => other).payload, { resource: 'evidence', submissionId: id, evidenceId: other, expiresIn: 60 })
  const e = { submissionId: id, evidenceId: other, signedUrl: 'https://evidence.example.invalid/storage/v1/object/sign/shop-payment-evidence/file?token=synthetic', expiresAt: new Date(Date.now() + 60000).toISOString() }
  assert.ok(parseEvidenceAccess(e, id, other).signedUrl)
  for (const bad of [{ ...e, submissionId: other }, { ...e, signedUrl: 'javascript:alert(1)' }, { ...e, expiresAt: new Date(Date.now() - 1).toISOString() }, { ...e, expiresAt: new Date(Date.now() + 600000).toISOString() }]) assert.throws(() => parseEvidenceAccess(bad, id, other))
})

test('legacy incomplete frozen quotas cannot poison the queue or authorize activation', () => {
 const legacy = payment(); delete legacy.resourceLimits.active_customers; delete legacy.resourceLimits.active_suppliers
 const fresh = { ...payment(), id: '33333333-3333-4333-8333-333333333333' }
 const queue = parsePaymentQueue({items:[legacy,fresh],total:2,page:1,pageSize:25})
 assert.equal(queue.items.length,2); assert.equal(queue.items[0].resourceLimits,null)
 assert.equal(queue.items[0].effectivePriceAmount,120); assert.equal(approvalBlocked(queue.items[0]),true)
 assert.equal(approvalBlocked(queue.items[1]),false)
 assert.throws(()=>paymentCommand(id,queue.items[0],draft(),()=>other,'2026-10-07'))
 assert.equal(paymentCommand(id,queue.items[0],{...emptyReview(),action:'mark_under_review',reason:'Review incomplete frozen terms'},()=>other).payload.action,'mark_under_review')
 for(const limits of [{...payment().resourceLimits,unknown_resource:1},{...payment().resourceLimits,active_members:-1},{...payment().resourceLimits,active_locations:'1'}]) assert.throws(()=>parsePaymentQueue({items:[{...payment(),resourceLimits:limits}],total:1,page:1,pageSize:25}))
})

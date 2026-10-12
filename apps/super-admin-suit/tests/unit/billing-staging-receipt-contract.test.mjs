import test from 'node:test'
import assert from 'node:assert/strict'
import {
  validateBillingStagingReceipt as gateA,
  validateFirstRealPaymentReceipt as gateB,
  ENGINEERING_GATE_VERSION,
  FIRST_PAYMENT_GATE_VERSION,
} from '../helpers/billing-staging-receipt.mjs'

// In-memory fixtures ONLY. These cannot pass actual hosted staging acceptance.
function base() {
  const h = 'a'.repeat(64)
  return {
    taskId: 'SAS-M1-BILLING-001', executionId: 318, environment: 'staging',
    sourceDigest: 'source', paymentWorkflow: 'manual-instapay',
    receivingIpa: 'building-suit@instapay', paymentGatewayUsed: false,
    decisionId: 'SAS-D012',
    independentObserver: { identity: 'unit-fixture-only', method: 'authenticated-browser-and-signed-adapter' },
    capturedAt: new Date().toISOString(),
    sourceBindingId: 'source-binding', targetBindingId: 'target-binding', targetEnvironmentId: 'staging',
    artifacts: [{ path: 'unit-only.json', sha256: h }],
  }
}
function noFunds(h) {
  return { syntheticRequest: true, bankVerified: false, fundsActuallyReceived: false, bankEvidence: null, artifactHashes: [h] }
}
function gateAFixture() {
  const r = base()
  const h = r.artifacts[0].sha256
  r.acceptanceVersion = ENGINEERING_GATE_VERSION
  r.acceptanceGate = 'engineering-staging'
  r.firstRealPaymentAcceptance = 'pending'
  r.livePaidActivationPerformed = false
  r.productionReleaseApproved = false
  r.journeys = [
    { name: 'submit-evidence-under-review-reject', passed: true, ...noFunds(h), submissionId: 'sub-rej', evidenceId: 'evidence', requestId: 'request-rej', correlationId: 'cor-rej', targetAuditId: 'audit-rej' },
    { name: 'unverified-approval-denied', passed: true, ...noFunds(h), paidActivationDenied: true, submissionId: 'sub-denied', requestId: 'request-denied', correlationId: 'cor-denied', denialCode: 'PAYMENT_NOT_VERIFIED' },
  ]
  r.disposableLocalRegression = {
    passed: true, environment: 'disposable-local', databaseIsDisposable: true,
    artificialBankInput: true, ...noFunds(h),
    testCommand: 'local transactional synthetic test', testRunId: 'unit-fixture',
    subscriptionId: 'sub-local', commercialPeriodId: 'period-local', targetAuditId: 'audit-local',
    activationCount: 1, replayActivationCount: 1,
  }
  r.checks = ['private-evidence-access', 'unauthorized-evidence-denied', 'amount-mismatch', 'quota-no-destructive-side-effects', 'audit-correlation', 'approval-idempotency'].map(name => ({ name, passed: true }))
  return r
}
function gateBFixture() {
  const r = base()
  const h = r.artifacts[0].sha256
  r.acceptanceVersion = FIRST_PAYMENT_GATE_VERSION
  r.acceptanceGate = 'first-real-payment'
  r.journeys = [{
    name: 'resubmit-evidence-approve', passed: true, syntheticRequest: false,
    bankVerified: true, fundsActuallyReceived: true,
    submissionId: 'sub', evidenceId: 'evid', requestId: 'req', correlationId: 'cor', targetAuditId: 'audit', artifactHashes: [h],
    manualReview: { actorId: 'authorized-owner', authorizedOperator: true, mode: 'owner-verified-incoming-transfer', reason: 'Unit fixture only, no funds attested', receivedAmount: 120, receivedReference: 'UNIT-FIXTURE', receivedDate: '2026-10-10' },
    bankEvidence: { observedThrough: 'receiving-account', artifactHash: h },
    subscriptionId: 'sub', commercialPeriodId: 'period', activationCount: 1, replayActivationCount: 1,
  }]
  return r
}

test('Gate A contract: synthetic staging rejection/denial and disposable local activation are structurally valid', () => {
  assert.equal(gateA(gateAFixture(), 'source'), true)
})
test('Gate B contract remains separate and structurally validates bank-confirmed claims (unit fixture only)', () => {
  assert.equal(gateB(gateBFixture(), 'source'), true)
})

for (const [name, mutate] of Object.entries({
  wrongSource: r => { r.sourceDigest = 'other' },
  wrongExecution: r => { r.executionId = 321 },
  wrongDecision: r => { r.decisionId = 'wrong' },
  noObserver: r => { r.independentObserver = null },
  noArtifacts: r => { r.artifacts = [] },
  stale: r => { r.capturedAt = '2020-01-01' },
  gateway: r => { r.paymentGatewayUsed = true },
  fakeBankVerified: r => { r.journeys[0].bankVerified = true },
  claimedFunds: r => { r.journeys[1].fundsActuallyReceived = true },
  fakeBankArtifact: r => { r.disposableLocalRegression.bankEvidence = { observedThrough: 'receiving-account' } },
  fakeHostedApproval: r => { r.livePaidActivationPerformed = true },
  syntheticActivationInStaging: r => { r.disposableLocalRegression.environment = 'staging' },
  nondisposableLocal: r => { r.disposableLocalRegression.databaseIsDisposable = false },
  noArtificialLabel: r => { r.disposableLocalRegression.artificialBankInput = false },
  localBankClaim: r => { r.disposableLocalRegression.bankVerified = true },
  omittedDenial: r => { r.journeys.pop() },
  noDenialCode: r => { r.journeys[1].denialCode = null },
  omittedLocalRegression: r => { r.disposableLocalRegression = null },
  missingLocalTestCommand: r => { r.disposableLocalRegression.testCommand = '' },
  doubleActivation: r => { r.disposableLocalRegression.replayActivationCount = 2 },
  skippedQuota: r => { r.checks = r.checks.filter(c => c.name !== 'quota-no-destructive-side-effects') },
  firstPaymentWronglyAccepted: r => { r.firstRealPaymentAcceptance = 'passed' },
  productionClaim: r => { r.productionReleaseApproved = true },
})) {
  test('Gate A fails closed: ' + name, () => { const r = gateAFixture(); mutate(r); assert.throws(() => gateA(r, 'source')) })
}
for (const [name, mutate] of Object.entries({
  syntheticApproval: r => { r.journeys[0].syntheticRequest = true },
  unverifiedBank: r => { r.journeys[0].bankVerified = false },
  noActualFunds: r => { r.journeys[0].fundsActuallyReceived = false },
  noReceivingAccount: r => { r.journeys[0].bankEvidence = null },
  missingReviewActor: r => { r.journeys[0].manualReview.actorId = null },
  noReviewReason: r => { r.journeys[0].manualReview.reason = '' },
  duplicateActivation: r => { r.journeys[0].replayActivationCount = 2 },
})) {
  test('Gate B fails closed: ' + name, () => { const r = gateBFixture(); mutate(r); assert.throws(() => gateB(r, 'source')) })
}

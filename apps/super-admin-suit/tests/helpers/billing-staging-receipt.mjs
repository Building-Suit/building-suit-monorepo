import assert from 'node:assert/strict'

// SAS-D012 v1: engineering/staging acceptance is separate from the first
// genuine incoming payment. This module validates receipt STRUCTURE only;
// authenticity of observations and artifacts remains an independent gate.
// Unit fixtures are never external/hosted acceptance evidence.
export const ENGINEERING_GATE_VERSION = 'sas-d012-gate-a-v1'
export const FIRST_PAYMENT_GATE_VERSION = 'sas-d012-gate-b-v1'

function assertCommon(receipt, sourceDigest, now) {
  assert.equal(receipt.taskId, 'SAS-M1-BILLING-001')
  assert.equal(receipt.executionId, 318)
  assert.equal(receipt.environment, 'staging')
  assert.equal(receipt.sourceDigest, sourceDigest, 'receipt source must match the Billing candidate')
  assert.equal(receipt.paymentWorkflow, 'manual-instapay')
  assert.equal(receipt.receivingIpa, 'building-suit@instapay')
  assert.equal(receipt.paymentGatewayUsed, false)
  assert.equal(receipt.decisionId, 'SAS-D012')
  assert.ok(receipt.independentObserver?.identity && receipt.independentObserver?.method === 'authenticated-browser-and-signed-adapter')
  const captured = Date.parse(receipt.capturedAt)
  assert.ok(Number.isFinite(captured) && captured <= now && captured >= now - 7 * 86400000, 'stale receipts cannot pass')
  assert.ok(receipt.sourceBindingId && receipt.targetBindingId && receipt.targetEnvironmentId)
  assert.ok(Array.isArray(receipt.artifacts) && receipt.artifacts.length > 0, 'observed artifacts are mandatory')
  for (const a of receipt.artifacts) assert.ok(a.path && /^[a-f0-9]{64}$/.test(a.sha256), 'artifact content must be bound')
}

function assertArtifactHashes(receipt, record) {
  assert.ok(record.artifactHashes?.length && record.artifactHashes.every(h => receipt.artifacts.some(a => a.sha256 === h)))
}

function findJourney(receipt, name) {
  const matching = receipt.journeys?.filter(row => row.name === name) ?? []
  assert.equal(matching.length, 1, 'journey must be present exactly once: ' + name)
  const result = matching[0]
  assert.equal(result.passed, true, name + ' was not independently observed as passing')
  assertArtifactHashes(receipt, result)
  return result
}

function assertNoRealFunds(record) {
  assert.equal(record.syntheticRequest, true)
  assert.equal(record.bankVerified, false, 'synthetic requests cannot attest received funds')
  assert.equal(record.fundsActuallyReceived, false)
  assert.ok(!record.bankEvidence, 'synthetic evidence cannot be presented as bank evidence')
}

/** Gate A: actual authenticated staging denial/rejection + disposable LOCAL
 * synthetic activation regression. Neither claims actual incoming funds. */
export function validateBillingStagingReceipt(receipt, sourceDigest, now = Date.now()) {
  assertCommon(receipt, sourceDigest, now)
  assert.equal(receipt.acceptanceVersion, ENGINEERING_GATE_VERSION)
  assert.equal(receipt.acceptanceGate, 'engineering-staging')
  assert.equal(receipt.firstRealPaymentAcceptance, 'pending')
  assert.equal(receipt.livePaidActivationPerformed, false)
  assert.equal(receipt.productionReleaseApproved, false)

  const rejected = findJourney(receipt, 'submit-evidence-under-review-reject')
  assertNoRealFunds(rejected)
  assert.ok(rejected.submissionId && rejected.evidenceId && rejected.requestId && rejected.correlationId && rejected.targetAuditId)

  const denied = findJourney(receipt, 'unverified-approval-denied')
  assertNoRealFunds(denied)
  assert.equal(denied.paidActivationDenied, true)
  assert.ok(denied.submissionId && denied.requestId && denied.correlationId && denied.denialCode)

  // Positive activation tests must NOT occur in a hosted staging database
  // without actual bank evidence. The artificial verification input here must
  // be used only in a disposable LOCAL database and identified as synthetic.
  const local = receipt.disposableLocalRegression
  assert.equal(local?.passed, true)
  assert.equal(local.environment, 'disposable-local')
  assert.equal(local.databaseIsDisposable, true)
  assert.equal(local.artificialBankInput, true)
  assertNoRealFunds(local)
  assert.ok(local.testCommand && local.testRunId && local.subscriptionId && local.commercialPeriodId && local.targetAuditId)
  assertArtifactHashes(receipt, local)
  assert.equal(local.activationCount, 1)
  assert.equal(local.replayActivationCount, 1)

  for (const name of ['private-evidence-access', 'unauthorized-evidence-denied', 'amount-mismatch', 'quota-no-destructive-side-effects', 'audit-correlation', 'approval-idempotency']) {
    assert.equal(receipt.checks?.find(c => c.name === name)?.passed, true, name + ' is mandatory')
  }
  return true
}

/** Gate B: separate *future* business acceptance. Never called to pass Gate A.
 * A receipt is NOT bank verification by itself; independently confirm the
 * actual receiving account before accepting a Gate B artifact. */
export function validateFirstRealPaymentReceipt(receipt, sourceDigest, now = Date.now()) {
  assertCommon(receipt, sourceDigest, now)
  assert.equal(receipt.acceptanceVersion, FIRST_PAYMENT_GATE_VERSION)
  assert.equal(receipt.acceptanceGate, 'first-real-payment')
  const approved = findJourney(receipt, 'resubmit-evidence-approve')
  assert.equal(approved.syntheticRequest, false)
  assert.equal(approved.bankVerified, true)
  assert.equal(approved.fundsActuallyReceived, true)
  assert.ok(approved.submissionId && approved.evidenceId && approved.requestId && approved.correlationId && approved.targetAuditId)
  assert.ok(approved.manualReview?.actorId && approved.manualReview?.authorizedOperator === true)
  assert.equal(approved.manualReview?.mode, 'owner-verified-incoming-transfer')
  assert.ok(approved.manualReview.reason)
  assert.equal(approved.bankEvidence?.observedThrough, 'receiving-account')
  assert.ok(approved.bankEvidence?.artifactHash && receipt.artifacts.some(a => a.sha256 === approved.bankEvidence.artifactHash))
  assert.ok(approved.manualReview.receivedAmount > 0 && approved.manualReview.receivedReference && approved.manualReview.receivedDate)
  assert.ok(approved.subscriptionId && approved.commercialPeriodId)
  assert.equal(approved.activationCount, 1)
  assert.equal(approved.replayActivationCount, 1)
  return true
}

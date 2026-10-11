import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { emptyOffer, offerCommand, amendOffer, shopOfferPayload, resourceKeys } from '../../app/utils/custom-offer.ts'

const id = () => crypto.randomUUID()
const draft = () => ({ ...emptyOffer(), definitionId: id(), recipientUserId: id(), companyId: id(), basePlanId: id(),
  displayName: 'Synthetic private offer', priceAmount: '123.45', currency: 'EGP', billingInterval: 'monthly',
  resourceLimits: JSON.stringify(Object.fromEntries(resourceKeys.map(key => [key, 2]))),
  entitlements: '{"synthetic_feature":true}', expiresAt: new Date(Date.now() + 3600000).toISOString() })
test('owner command preserves exact amount, resource and entitlement snapshots and amendment identity', () => {
  const input = offerCommand(id(), draft(), 'Synthetic negotiated terms', id)
  const version = { ...input.payload, id: id(), version: 1, bindingId: input.bindingId, targetBindingId: id(), targetEnvironmentId: id() }
  const mapped = shopOfferPayload(version, 'synthetic-suit')
  assert.equal(input.payload.priceAmount, '123.45')
  assert.deepEqual(input.payload.entitlements, { synthetic_feature: true })
  assert.equal(mapped.priceAmount, 123.45)
  assert.equal(mapped.shopId, version.companyId)
  assert.equal(mapped.recipientUserId, version.recipientUserId)
  assert.equal(mapped.targetEnvironmentId, version.targetEnvironmentId)
  assert.deepEqual(mapped.resourceLimits, input.payload.resourceLimits)
  mapped.resourceLimits.active_members = 99
  assert.equal(input.payload.resourceLimits.active_members, 2)
  const amended = amendOffer(version)
  assert.equal(amended.definitionId, input.payload.definitionId)
  assert.equal(amended.expectedVersion, 1)
  assert.equal(amended.entitlements, JSON.stringify(input.payload.entitlements))
})
test('malformed or expired commercial terms cannot form a command', () => {
  for (const patch of [{ priceAmount: '1.001' }, { currency: '' }, { expiresAt: '2000-01-01T00:00:00Z' },
    { recipientUserId: 'invalid' }, { resourceLimits: '{}' }, { entitlements: '[]' }, { expectedVersion: -1 }]) {
    assert.throws(() => offerCommand(id(), { ...draft(), ...patch }, 'Synthetic reviewed reason', id))
  }
})
// Captured from the genuine synthetic staging journey. This is a reproducible
// mapper regression; fresh staging acceptance remains separate evidence.
test('Admin mapping matches the registered Shop offer and frozen billing request', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/custom-offer-staging-parity.json', import.meta.url)))
  const mapped = shopOfferPayload(fixture.adminOffer, 'shop-suit')
  const target = structuredClone(fixture.targetRegistration)
  target.expiresAt = new Date(target.expiresAt).toISOString()
  mapped.expiresAt = new Date(mapped.expiresAt).toISOString()
  assert.deepEqual(mapped, target)
  const frozen = fixture.frozenBillingRequest
  assert.equal(mapped.priceAmount, frozen.expectedAmount)
  assert.equal(mapped.currency, frozen.currency)
  assert.equal(mapped.billingInterval, frozen.interval)
  assert.deepEqual(mapped.resourceLimits, frozen.limits)
  assert.deepEqual(mapped.entitlements, frozen.entitlements)
  assert.equal(frozen.redemptionCount, 1)
  assert.equal(frozen.status, 'submitted')
  assert.equal(frozen.subscriptionStatus, 'trialing')
})

// Target cases formerly blocked in issuer SQL: use real independently scoped
// customer identities, current target RPC denials, and the completed request.
test('installed staging redemption is idempotent, one-time and context-bound', { skip: process.env.BS_RUN_CUSTOM_OFFER_STAGING_ACCEPTANCE !== '1' ? 'Requires explicit authorization for live staging acceptance' : false }, async () => {
  const { targetEvidence } = await import('../custom-offer-target-evidence.mjs')
  const evidence = await targetEvidence()
  assert.equal(evidence.submissionId, evidence.expectedSubmissionId)
  assert.equal(evidence.replayStatus, 200)
  assert.equal(evidence.consumedStatus, 409)
  assert.deepEqual(evidence.denied, { recipient: 403, suitBinding: 403, environment: 403, token: 403 })
})

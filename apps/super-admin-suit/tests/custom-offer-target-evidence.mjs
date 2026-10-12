import assert from 'node:assert/strict'
import { readFileSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'
import { resolve, dirname } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

// Only existing synthetic staging identities and customer RPCs. No service key,
// hosted SQL, new successful notice, independent payment evidence or approval.
const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const configPath = process.env.BS_CUSTOM_OFFER_STAGING_CONFIG ?? resolve(process.env.XDG_CONFIG_HOME ?? resolve(homedir(), '.config'), 'building-suit-test-evidence/custom-offer-staging.json')
assert.equal(statSync(configPath).mode & 0o077, 0)
const config = JSON.parse(readFileSync(configPath))
const registry = JSON.parse(readFileSync(resolve(appRoot, '../../docs/architecture/environments.json')))
assert.equal(config.projectRef, registry.products['shop-suit'].staging.projectRef)
assert.equal(config.customerOrigin, registry.products['shop-suit'].staging.appUrl)
assert.equal(config.origin, `https://${config.projectRef}.supabase.co`)
const read = name => JSON.parse(readFileSync(resolve(config.evidenceRoot, name)))
function decrypt(name) {
  for (const file of [name, 'restore-identity.agekey']) assert.equal(statSync(resolve(config.evidenceRoot, file)).mode & 0o077, 0)
  return JSON.parse(execFileSync('age', ['-d', '-i', resolve(config.evidenceRoot, 'restore-identity.agekey'), resolve(config.evidenceRoot, name)], { stdio: ['ignore', 'pipe', 'pipe'] }))
}
const anon = decrypt(`${config.projectRef}.api-keys.json.age`).find(key => key.name === 'anon').api_key
async function call(path, body, token = anon) {
  const response = await fetch(`${config.origin}/${path}`, { method: 'POST', headers: { apikey: anon, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return { status: response.status, body: await response.json() }
}
export async function targetSession(other = false) {
  const identity = decrypt(other ? 'synthetic-customer.json.age' : 'synthetic-browser-customer.json.age')
  const result = await call('auth/v1/token?grant_type=password', { email: identity.email, password: identity.password })
  assert.equal(result.status, 200, 'Synthetic identity must genuinely authenticate')
  return result.body
}
export function redemptionCase() {
  const state = read('customer-browser-clean-identities.json')
  const binding = read('signed-binding-identities.json')
  const issued = decrypt('synthetic-browser-issued-offer.json.age')
  const original = read('customer-browser-redemption-receipt.json')
  assert.equal(original.offerId, state.offerId)
  assert.equal(original.paymentApproved, false)
  assert.equal(original.independentPaymentEvidence, false)
  assert.equal(original.syntheticNoticeOnly, true)
  assert.equal(createHash('sha256').update(readFileSync(resolve(config.evidenceRoot, 'customer-browser-submitted.png'))).digest('hex'), original.browserScreenshotSha256)
  return { config, original, state, issued, args: { p_offer_id: state.offerId, p_offer_version: 1, p_shop_id: state.shopId, p_target_binding_id: binding.targetBinding, p_target_environment_id: binding.targetEnvironment, p_redemption_token: issued.redemptionToken } }
}
export async function targetEvidence() {
  const { state, original, args } = redemptionCase()
  const [session, outsider] = await Promise.all([targetSession(), targetSession(true)])
  const denied = {}
  for (const [name, patch, token] of [
    ['recipient', {}, outsider.access_token],
    ['suitBinding', { p_target_binding_id: randomUUID() }, session.access_token],
    ['environment', { p_target_environment_id: randomUUID() }, session.access_token],
    ['token', { p_redemption_token: 'X'.repeat(43) }, session.access_token],
  ]) {
    const result = await call('rest/v1/rpc/shop_private_offer_read', { ...args, ...patch }, token)
    assert.equal(result.status, 403, `${name}: target must deny access`)
    denied[name] = result.status
  }
  const request = { ...args, p_request_id: original.nativeDatabaseObservation.requestId, p_paid_amount: 123.45, p_transfer_date: '2026-10-10', p_transfer_reference: 'SYNTHETIC BROWSER NOTICE ONLY — NO BANK TRANSFER' }
  const replay = await call('rest/v1/rpc/redeem_shop_private_offer', request, session.access_token)
  assert.equal(replay.status, 200)
  assert.equal(replay.body, original.nativeDatabaseObservation.submissionId)
  const consumed = await call('rest/v1/rpc/redeem_shop_private_offer', { ...request, p_request_id: randomUUID() }, session.access_token)
  assert.equal(consumed.status, 409, 'Used token must not create another notice')
  return { observedAt: new Date().toISOString(), offerId: state.offerId, submissionId: replay.body, expectedSubmissionId: original.nativeDatabaseObservation.submissionId, replayStatus: replay.status, consumedStatus: consumed.status, denied, paymentApproved: false }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(await targetEvidence())) }
  catch { console.error('Real staging Custom Offer acceptance unavailable or failed; no PASS'); process.exitCode = 1 }
}

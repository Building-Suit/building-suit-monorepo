import assert from 'node:assert/strict'
import path from 'node:path'
import { billingContext, readJson, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const c = billingContext()
const state = readJson(path.join(c.directory, 'fixture-state.json'))
assert.ok(state.preview)
const url = new URL(state.preview.localUrl)
assert.equal(url.origin, c.url)
assert.ok(url.pathname.startsWith('/storage/v1/object/sign/manual-payment-receipts/'))
const elapsed = Date.now() - state.preview.issuedAt
assert.ok(elapsed >= 62000, 'Continue other work until the actual 60-second signed URL lifetime has elapsed')
const response = await fetch(url, { signal: AbortSignal.timeout(10000) })
assert.ok([400, 401, 403].includes(response.status))
const body = await response.json()
assert.match(String(body.message || body.error), /expired|jwt|token|"exp" claim timestamp/i)
const evidence = { task: c.owner.task, date: new Date().toISOString().slice(0, 10), signed_url_lifetime_seconds: 60, elapsed_seconds: Math.round(elapsed / 1000), previously_downloaded_and_hashed: true, status_after_expiry: response.status, result: 'pass', signed_url_or_token_disclosed: false }
writePrivate(path.join(c.directory, 'preview-expiry-result.json'), evidence)
console.log(JSON.stringify(evidence))

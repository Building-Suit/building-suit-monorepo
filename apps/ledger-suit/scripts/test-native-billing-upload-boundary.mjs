// Actual oversized HTTP and direct Storage bypass attempts; no fixture cleanup.
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { billingContext, readJson, root, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const c = billingContext()
const state = readJson(path.join(c.directory, 'fixture-state.json'))
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const owner = createClient(c.url, c.credentials.anon, { auth: { persistSession: false, autoRefreshToken: false } })
const session = await owner.auth.signInWithPassword(state.actors.owner)
assert.equal(session.error, null)
const before = c.psql("select count(*) from public.manual_payment_evidence; select count(*) from storage.objects where bucket_id='manual-payment-receipts';")
const form = new FormData()
form.set('requestId', state.request); form.set('evidenceId', randomUUID()); form.set('reason', 'Synthetic oversized request')
form.set('receipt', new File([Buffer.alloc(5 * 1024 * 1024 + 16385)], 'oversized.pdf', { type: 'application/pdf' }))
const response = await fetch(c.url + '/functions/v1/manual-payment', { method: 'POST', headers: { apikey: c.credentials.anon, Authorization: `Bearer ${session.data.session.access_token}` }, body: form, signal: AbortSignal.timeout(30000) })
assert.equal(response.status, 400); assert.equal((await response.json()).error, 'RECEIPT_SIZE_INVALID')
const bytes = Buffer.from('%PDF-1.4\nSynthetic denied bypass\n%%EOF')
const bypass = await owner.storage.from('manual-payment-receipts').upload(`${state.organization}/${state.request}/${randomUUID()}`, bytes, { contentType: 'application/pdf', upsert: false })
assert.ok(bypass.error)
assert.equal(String(bypass.error.statusCode || bypass.error.status), '403')
assert.equal(c.psql("select count(*) from public.manual_payment_evidence; select count(*) from storage.objects where bucket_id='manual-payment-receipts';"), before)
let scanned = 0
const visit = directory => {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) visit(file)
    else if (/\.(?:js|mjs|map)$/.test(entry.name)) {
      const contents = readFileSync(file); scanned++
      for (const secret of [c.credentials.jwt, c.credentials.service]) assert.equal(contents.includes(Buffer.from(secret)), false, 'Privileged local credential in client asset')
    }
  }
}
visit(path.join(root, 'apps/ledger-suit/.output/public'))
assert.ok(scanned > 100)
const html = await (await fetch('http://127.0.0.1:60830/login')).text()
for (const secret of [c.credentials.jwt, c.credentials.service]) assert.equal(html.includes(secret), false, 'Privileged local credential in public HTML')
const evidence = { task: c.owner.task, date: new Date().toISOString().slice(0, 10), oversized_real_http_status: 400, direct_authenticated_storage_upload_status: 403, evidence_and_objects_unchanged: true, client_assets_value_scanned: scanned, public_html_value_scanned: true, privileged_values_found: 0, result: 'pass' }
writePrivate(path.join(c.directory, 'upload-boundary-result.json'), evidence)
console.log(JSON.stringify(evidence))

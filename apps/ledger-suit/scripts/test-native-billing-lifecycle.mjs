// Actual Auth/REST/Edge/Storage lifecycle in the fixed owned project only.
import assert from 'node:assert/strict'
import { randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { billingContext, digest, readJson, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2, 'No URL or credential arguments')
const c = billingContext()
const { createClient } = createRequire(import.meta.resolve('@nuxtjs/supabase'))('@supabase/supabase-js')
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
const admin = createClient(c.url, c.credentials.service, options)
const stateFile = path.join(c.directory, 'fixture-state.json')
const state = existsSync(stateFile) ? readJson(stateFile) : { run: randomUUID(), actors: {}, checks: [] }
const save = () => writePrivate(stateFile, state)
const passed = label => state.checks.some(check => check.label === label)
const pass = label => { state.checks.push({ label, at: new Date().toISOString() }); save() }
save()
const clients = {}
for (const role of ['owner', 'operator', 'viewer', 'outsider']) {
  const actor = state.actors[role] ||= { email: `billing-${role}-${state.run}@example.test`, password: randomBytes(24).toString('base64url') }
  save()
  const client = createClient(c.url, c.credentials.anon, options)
  if (!actor.id) {
    const result = role === 'owner'
      ? await client.auth.signUp({ email: actor.email, password: actor.password, options: { data: { full_name: 'Synthetic billing owner' } } })
      : await admin.auth.admin.createUser({ email: actor.email, password: actor.password, email_confirm: true, user_metadata: { full_name: `Synthetic billing ${role}` } })
    assert.equal(result.error, null, `Owned synthetic ${role} provision failed`)
    assert.ok(result.data.user?.id)
    if (role === 'owner') assert.equal(result.data.session, null, 'Unverified signup must not create a session')
    actor.id = result.data.user.id; save()
  }
  assert.match(actor.id, /^[\da-f-]{36}$/)
  if (role === 'owner' && !actor.verified) {
    const unverified = await client.auth.signInWithPassword({ email: actor.email, password: actor.password })
    assert.ok(unverified.error, 'Unverified email must be denied')
    let message
    for (let attempt = 0; attempt < 50 && !message; attempt++) {
      const listing = await (await fetch('http://127.0.0.1:60824/api/v1/messages')).json()
      message = listing.messages.find(item => item.To?.some(recipient => recipient.Address === actor.email))
      if (!message) await new Promise(resolve => setTimeout(resolve, 200))
    }
    assert.ok(message, 'Local confirmation email absent')
    const detail = await (await fetch(`http://127.0.0.1:60824/api/v1/message/${message.ID}`)).json()
    const links = detail.HTML.match(/https?:\/\/[^"'\s<>]+\/auth\/v1\/verify\?[^"'\s<>]+/g) || []
    const link = links.map(value => new URL(value.replaceAll('&amp;', '&'))).find(value => value.origin === c.url)
    assert.ok(link, 'Confirmation must bind the exact owned Auth provider')
    assert.ok([302, 303].includes((await fetch(link, { redirect: 'manual' })).status))
    actor.verified = true; save(); pass('Actual signup has no session, unverified login denied, local email confirmation succeeds')
  }
  const session = await client.auth.signInWithPassword({ email: actor.email, password: actor.password })
  assert.equal(session.error, null, `Owned ${role} password sign-in failed`)
  assert.equal(session.data.user.id, actor.id)
  clients[role] = { client, token: session.data.session.access_token }
}
const owner = clients.owner.client
const rpc = async (client, name, args) => {
  const result = await client.rpc(name, args)
  assert.equal(result.error, null, `Owned RPC failed: ${name}`)
  return result.data
}
if (!state.organization) {
  const result = await owner.from('organization_members').select('organization_id').eq('user_id', state.actors.owner.id)
  assert.equal(result.error, null)
  assert.ok(result.data.length <= 1, 'Inspect ambiguous fixture state')
  state.organization = result.data[0]?.organization_id || await rpc(owner, 'create_organization', { p_name: 'Synthetic billing lifecycle', p_base_currency: 'EGP' })
  save()
}
const org = state.organization
assert.match(org, /^[\da-f-]{36}$/)
// Trusted local fixture provisioning, never email-derived authority or a hosted operation.
c.psql("insert into app.platform_operators(user_id,role) values(:'operator'::uuid,'platform_admin') on conflict(user_id) do nothing; insert into public.organization_members(organization_id,user_id,role) values(:'org'::uuid,:'viewer'::uuid,'viewer') on conflict do nothing; insert into app.manual_payment_configuration(instructions) values('Synthetic local transfer instructions. No actual payment.') on conflict(singleton) do nothing;", { operator: state.actors.operator.id, org, viewer: state.actors.viewer.id })
const bytes = Buffer.from('%PDF-1.4\nSynthetic local billing proof; no actual payment.\n%%EOF\n')
const edge = async (role, evidence, contents = bytes, mime = 'application/pdf', requestId = state.request) => {
  const form = new FormData()
  form.set('requestId', requestId)
  form.set('evidenceId', evidence)
  form.set('reason', 'Reviewed synthetic local receipt')
  form.set('receipt', new File([contents], 'synthetic-receipt.pdf', { type: mime }))
  const response = await fetch(c.url + '/functions/v1/manual-payment', { method: 'POST', headers: { apikey: c.credentials.anon, Authorization: `Bearer ${clients[role].token}` }, body: form, signal: AbortSignal.timeout(30000) })
  return { status: response.status, body: await response.json() }
}
if (!passed('Trial financial write and exact posted receipt')) {
  assert.equal(await rpc(owner, 'subscription_access_state', { p_organization_id: org }), 'trialing')
  for (const [key, name, type, subtype] of [['bank', 'Synthetic billing bank', 'asset', 'bank'], ['revenue', 'Synthetic billing revenue', 'revenue', 'service_revenue']]) {
    if (!state[key]) { state[key] = await rpc(owner, 'create_account', { p_organization_id: org, p_name: name, p_type: type, p_subtype: subtype }); save() }
  }
  state.journal ||= await rpc(owner, 'record_income', { p_organization_id: org, p_amount_minor: '12345', p_destination_account_id: state.bank, p_revenue_account_id: state.revenue, p_transaction_date: '2026-10-25', p_description: 'Synthetic billing preservation receipt', p_idempotency_key: 'billing-' + state.run })
  save()
  assert.equal(c.psql("select count(*)||'|'||(sum(e.base_amount_minor) filter(where e.side='debit'))||'|'||(sum(e.base_amount_minor) filter(where e.side='credit')) from public.transaction_entries e where e.transaction_id=:'journal'::uuid", { journal: state.journal }), '2|12345|12345')
  pass('Trial financial write and exact posted receipt')
}
const financialFingerprint = () => digest(c.psql("select to_jsonb(t)::text from public.transactions t where organization_id=:'org'::uuid order by id; select to_jsonb(e)::text from public.transaction_entries e where organization_id=:'org'::uuid order by id;", { org }))
state.financialFingerprint ||= financialFingerprint(); save()
if (!passed('Expired trial preserves readable history and denies financial writes')) {
  c.psql("update public.subscriptions set trial_ends_at=now()-interval '1 second' where organization_id=:'org'::uuid", { org })
  assert.equal(await rpc(owner, 'subscription_access_state', { p_organization_id: org }), 'read_only')
  const read = await owner.from('transactions').select('id').eq('id', state.journal); assert.equal(read.error, null); assert.equal(read.data.length, 1)
  const blocked = await owner.rpc('create_account', { p_organization_id: org, p_name: 'Must be denied', p_type: 'asset', p_subtype: 'bank' }); assert.ok(blocked.error)
  assert.equal(financialFingerprint(), state.financialFingerprint)
  pass('Expired trial preserves readable history and denies financial writes')
}
if (!state.request) { state.request = randomUUID(); state.firstEvidence = randomUUID(); state.replacementEvidence = randomUUID(); save() }
if (!passed('Exact manual quote, retry identity and customer cancellation')) {
  if (!state.cancelledRequest) { state.cancelledRequest = state.request; state.request = randomUUID(); save() }
  const args = { p_id: state.request, p_organization_id: org, p_plan_key: 'starter', p_interval: 'monthly' }
  await rpc(owner, 'prepare_manual_payment', { ...args, p_id: state.cancelledRequest })
  assert.equal((await rpc(owner, 'cancel_manual_payment', { p_request_id: state.cancelledRequest, p_reason: 'Synthetic incorrect choice' })).status, 'cancelled')
  const quote = await rpc(owner, 'prepare_manual_payment', args)
  assert.equal(quote.status, 'draft'); assert.equal(String(quote.amount_minor), '59900')
  assert.equal((await rpc(owner, 'prepare_manual_payment', args)).id, quote.id)
  pass('Exact manual quote, retry identity and customer cancellation')
}
if (!passed('Real Edge rejects invalid bytes, viewer and outsider without creating evidence')) {
  const before = c.psql("select count(*) from public.manual_payment_evidence where request_id=:'request'::uuid", { request: state.request })
  const invalid = await edge('owner', randomUUID(), Buffer.from('not a PDF'))
  assert.equal(invalid.status, 400); assert.equal(invalid.body.error, 'RECEIPT_TYPE_INVALID')
  for (const role of ['viewer', 'outsider']) { const denied = await edge(role, randomUUID()); assert.equal(denied.status, 403); assert.equal(denied.body.error, 'PAYMENT_ACCESS_DENIED') }
  assert.equal(c.psql("select count(*) from public.manual_payment_evidence where request_id=:'request'::uuid", { request: state.request }), before)
  pass('Real Edge rejects invalid bytes, viewer and outsider without creating evidence')
}
if (!passed('Real receipt bytes uploaded, hashed, committed once and replayed')) {
  const first = await edge('owner', state.firstEvidence)
  assert.equal(first.status, 200); assert.equal(first.body.request.status, 'submitted')
  assert.equal((await edge('owner', state.firstEvidence)).body.request.evidence_id, state.firstEvidence)
  assert.equal(c.psql("select count(*)||'|'||min(sha256)||'|'||min(size_bytes) from public.manual_payment_evidence where request_id=:'request'::uuid", { request: state.request }), `1|${digest(bytes)}|${bytes.length}`)
  const key = `${org}/${state.request}/${state.firstEvidence}`
  const downloaded = await owner.storage.from('manual-payment-receipts').download(key); assert.equal(downloaded.error, null); assert.equal(digest(Buffer.from(await downloaded.data.arrayBuffer())), digest(bytes))
  for (const role of ['viewer', 'outsider']) { const denied = await clients[role].client.storage.from('manual-payment-receipts').download(key); assert.ok(denied.error) }
  pass('Real receipt bytes uploaded, hashed, committed once and replayed')
}
const review = (actor, evidence, action, command = randomUUID(), requestId = state.request) => rpc(clients[actor].client, 'platform_admin_review_payment', { p_command_id: command, p_request_id: requestId, p_evidence_id: evidence, p_action: action, p_reason: 'Reviewed synthetic local transfer', p_context: 'LS-BILL-NATIVE-001 local acceptance' })
if (!passed('Owner review denied; dedicated operator review, rejection and replacement preserve old evidence')) {
  assert.equal((await review('owner', state.firstEvidence, 'approved')).ok, false)
  assert.equal((await review('operator', state.firstEvidence, 'under_review')).ok, true)
  assert.equal((await review('operator', state.firstEvidence, 'rejected')).ok, true)
  const replaced = await edge('owner', state.replacementEvidence); assert.equal(replaced.status, 200); assert.equal(replaced.body.request.status, 'submitted')
  assert.equal(c.psql("select count(*) from public.manual_payment_evidence where request_id=:'request'::uuid", { request: state.request }), '2')
  assert.equal((await review('operator', state.firstEvidence, 'approved')).error, 'MANUAL_PAYMENT_STALE_EVIDENCE')
  pass('Owner review denied; dedicated operator review, rejection and replacement preserve old evidence')
}
if (!passed('Parallel real operator approvals grant one month once; command replay is stable')) {
  state.approvalCommand ||= randomUUID(); save()
  const results = await Promise.all([review('operator', state.replacementEvidence, 'approved', state.approvalCommand), review('operator', state.replacementEvidence, 'approved', state.approvalCommand)])
  assert.ok(results.every(result => result.ok)); assert.equal(results.filter(result => result.replayed).length, 1)
  const period = c.psql("select current_period_end=current_period_start+interval '1 month' from public.subscriptions where organization_id=:'org'::uuid", { org }); assert.equal(period, 't')
  assert.equal(c.psql("select count(*) from public.manual_payment_history where request_id=:'request'::uuid and after_state='approved'", { request: state.request }), '1')
  assert.equal(await rpc(owner, 'subscription_access_state', { p_organization_id: org }), 'active')
  assert.equal((await review('operator', state.replacementEvidence, 'approved', state.approvalCommand)).replayed, true)
  assert.equal(financialFingerprint(), state.financialFingerprint)
  pass('Parallel real operator approvals grant one month once; command replay is stable')
}
if (!passed('Receipt preview is audited, denies tenant/outsider access and survives only its bounded signed lifetime')) {
  const preview = async role => {
    const response = await fetch(c.url + '/functions/v1/platform-admin-receipt', { method: 'POST', headers: { apikey: c.credentials.anon, Authorization: `Bearer ${clients[role].token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ requestId: state.request }), signal: AbortSignal.timeout(30000) })
    return { status: response.status, body: await response.json() }
  }
  for (const role of ['owner', 'viewer', 'outsider']) assert.equal((await preview(role)).status, 403)
  const result = await preview('operator')
  assert.equal(result.status, 200); assert.equal(result.body.expiresIn, 60); assert.equal(result.body.evidenceId, state.replacementEvidence)
  const internal = new URL(result.body.url)
  // The pinned local CLI supplies http://kong:8000 to server SDKs. Translate
  // only this verified owned gateway host for this host-side provider probe.
  assert.ok(internal.origin === 'http://kong:8000' || internal.origin === c.url)
  const external = new URL(internal.pathname + internal.search, c.url)
  const downloaded = await fetch(external); assert.equal(downloaded.status, 200); assert.equal(digest(Buffer.from(await downloaded.arrayBuffer())), digest(bytes))
  state.preview = { localUrl: external.href, issuedAt: Date.now(), expiresIn: 60 }; save()
  c.psql("update app.platform_operators set enabled=false where user_id=:'actor'::uuid", { actor: state.actors.operator.id })
  try { assert.equal((await preview('operator')).status, 403); assert.equal((await fetch(external)).status, 200) }
  finally { c.psql("update app.platform_operators set enabled=true where user_id=:'actor'::uuid", { actor: state.actors.operator.id }) }
  assert.ok(Number(c.psql("select count(*) from app.platform_operator_audit where operation='read.payment_evidence' and target_id=:'request'::uuid", { request: state.request })) >= 5)
  pass('Receipt preview is audited, denies tenant/outsider access and survives only its bounded signed lifetime')
}
if (!passed('Real paid member quota reserves an invitation and rejects the next seat')) {
  const result = await rpc(owner, 'create_organization_invitation', { p_organization_id: org, p_email: 'billing-reserved-' + state.run + '@example.test', p_role: 'viewer' })
  assert.ok(result)
  const denied = await owner.rpc('create_organization_invitation', { p_organization_id: org, p_email: 'billing-blocked-' + state.run + '@example.test', p_role: 'viewer' })
  assert.equal(denied.error?.message.startsWith('PLAN_MEMBER_LIMIT_REACHED'), true)
  const usage = await rpc(owner, 'subscription_usage_summary', { p_organization_id: org })
  const seats = usage.find(row => row.quota_key === 'max_members')
  assert.equal(String(seats.used_value), '3'); assert.equal(String(seats.limit_value), '3')
  pass('Real paid member quota reserves an invitation and rejects the next seat')
}
if (!passed('Audited plan correction and replay preserve paid dates and financial entries')) {
  const dates = c.psql("select current_period_start||'|'||current_period_end from public.subscriptions where organization_id=:'org'::uuid", { org })
  const correct = (target, command) => rpc(clients.operator.client, 'platform_admin_correct_subscription', { p_command_id: command, p_organization_id: org, p_target_plan_key: target, p_reason: 'Synthetic reviewed entitlement correction', p_context: 'LS-BILL-NATIVE-001 local acceptance' })
  state.correctionCommand ||= randomUUID(); save()
  assert.equal((await correct('solo', state.correctionCommand)).ok, true)
  assert.equal((await correct('solo', state.correctionCommand)).replayed, true)
  const usage = await rpc(owner, 'subscription_usage_summary', { p_organization_id: org }); const seats = usage.find(row => row.quota_key === 'max_members')
  assert.equal(String(seats.used_value), '3'); assert.equal(String(seats.limit_value), '1'); assert.equal(seats.is_over_limit, true)
  assert.equal(c.psql("select count(*) from public.organization_members where organization_id=:'org'::uuid", { org }), '2')
  assert.equal(c.psql("select current_period_start||'|'||current_period_end from public.subscriptions where organization_id=:'org'::uuid", { org }), dates)
  assert.equal(financialFingerprint(), state.financialFingerprint)
  assert.equal((await correct('starter', randomUUID())).ok, true)
  pass('Audited plan correction and replay preserve paid dates and financial entries')
}
if (!passed('Manual access does not renew automatically; expired access renews only after a new reviewed receipt')) {
  const deniedCancel = await owner.rpc('cancel_manual_payment', { p_request_id: state.request, p_reason: 'Synthetic already approved payment' }); assert.equal(deniedCancel.error?.message, 'MANUAL_PAYMENT_INVALID_STATE')
  const early = await owner.rpc('prepare_manual_payment', { p_id: randomUUID(), p_organization_id: org, p_plan_key: 'starter', p_interval: 'monthly' }); assert.equal(early.error?.message, 'MANUAL_PAYMENT_CHECKOUT_UNAVAILABLE')
  // Simulated time boundary is confined to this owned fixture subscription.
  c.psql("update public.subscriptions set current_period_start=now()-interval '2 months',current_period_end=now()-interval '1 month' where organization_id=:'org'::uuid", { org })
  assert.equal(await rpc(owner, 'subscription_access_state', { p_organization_id: org }), 'read_only')
  state.renewalRequest ||= randomUUID(); state.renewalEvidence ||= randomUUID(); state.renewalCommand ||= randomUUID(); save()
  const renewed = await rpc(owner, 'prepare_manual_payment', { p_id: state.renewalRequest, p_organization_id: org, p_plan_key: 'starter', p_interval: 'monthly' }); assert.equal(renewed.status, 'draft')
  const submitted = await edge('owner', state.renewalEvidence, bytes, 'application/pdf', state.renewalRequest); assert.equal(submitted.status, 200)
  assert.equal((await review('operator', state.renewalEvidence, 'approved', state.renewalCommand, state.renewalRequest)).ok, true)
  assert.equal(await rpc(owner, 'subscription_access_state', { p_organization_id: org }), 'active')
  assert.equal(c.psql("select current_period_end=current_period_start+interval '1 month' from public.subscriptions where organization_id=:'org'::uuid", { org }), 't')
  assert.equal(financialFingerprint(), state.financialFingerprint)
  pass('Manual access does not renew automatically; expired access renews only after a new reviewed receipt')
}
assert.equal(financialFingerprint(), state.financialFingerprint)
const evidence = { task: 'LS-BILL-NATIVE-001', date: new Date().toISOString().slice(0, 10), result: 'pass', checks: state.checks, actual_services: ['GoTrue', 'Mailpit', 'PostgREST', 'Supabase Edge Runtime 1.74.3 / Deno 2.1.4', 'Storage 1.70.3', 'PostgreSQL 17.6'], fixture: { trusted_admin_provisioned_other_actors: true, owner_email_verified_through_real_local_provider: true, trial_expiry_simulated_by_owned_SQL: true, real_money_or_external_email: false }, exact_receipt_bytes: bytes.length, preserved_posted_journals: 1, preserved_entries: 2, preserved_debit_and_credit_minor: '12345', financial_sha256: state.financialFingerprint, limits: ['Native browser UI and real signed-URL expiry follow separately; no hosted or accountant UAT claim.'] }
writePrivate(path.join(c.directory, 'lifecycle-result.json'), evidence)
console.log(JSON.stringify(evidence))

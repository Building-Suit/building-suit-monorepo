// Independent raw-ledger oracle plus actual authenticated PostgREST transport checks.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { browserContext, root } from './native-browser-runtime.mjs'

const c = browserContext()
const directory = path.join(root, '.local/verification/journal-precision')
const fixture = JSON.parse(readFileSync(path.join(directory, 'fixture.json'), 'utf8'))
assert.equal(fixture.task, 'LS-FIN-PRECISION-002')
for (const key of ['organization', 'bank', 'equity', 'journal']) assert.match(fixture[key], /^[0-9a-f-]{36}$/)
const api = 'http://127.0.0.1:61021'
async function signIn(email) {
  const response = await fetch(api + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: c.credentials.anon, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'ledgersuit' }) })
  assert.equal(response.status, 200)
  return (await response.json()).access_token
}
const owner = await signIn('owner@alpha.test')
const outsider = await signIn('owner@beta.test')
async function request(route, token = owner, body) {
  return fetch(api + '/rest/v1/' + route, { method: body ? 'POST' : 'GET', headers: { apikey: c.credentials.anon, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
}
const searchArgs = { p_organization_id: fixture.organization, p_account_ids: [fixture.bank] }
const projected = await request('rpc/search_transactions?select=id,debit_minor::text,credit_minor::text,base_debit_minor::text,base_credit_minor::text', owner, searchArgs)
assert.equal(projected.status, 200)
const [row] = await projected.json()
for (const field of ['debit_minor', 'credit_minor', 'base_debit_minor', 'base_credit_minor']) assert.equal(row[field], fixture.expected_minor)
const linesResponse = await request('ledger_entries?select=side,amount_minor::text,base_amount_minor::text&transaction_id=eq.' + fixture.journal)
assert.equal(linesResponse.status, 200)
const lines = await linesResponse.json()
assert.equal(lines.length, 2)
for (const line of lines) { assert.equal(line.amount_minor, fixture.expected_minor); assert.equal(line.base_amount_minor, fixture.expected_minor) }
const stored = JSON.parse(c.sql(`select jsonb_build_object('entries',count(*),'debits',sum(base_amount_minor) filter(where side='debit')::text,'credits',sum(base_amount_minor) filter(where side='credit')::text) from public.transaction_entries where transaction_id='${fixture.journal}';`))
assert.equal(stored.entries, 2); assert.equal(stored.debits, fixture.expected_minor); assert.equal(stored.credits, fixture.expected_minor)
const assets = c.sql(`select coalesce(sum(case when e.side='debit' then e.base_amount_minor else -e.base_amount_minor end),0)::text from public.transaction_entries e join public.accounts a on a.id=e.account_id where e.organization_id='${fixture.organization}' and a.type='asset';`)
const summaryResponse = await request('rpc/read_exact_dashboard_summary', owner, { p_organization_id: fixture.organization })
assert.equal(summaryResponse.status, 200)
const summary = await summaryResponse.json()
assert.equal(summary.total_assets_minor, assets)
assert.equal(typeof summary.base_currency, 'string')
for (const [key, value] of Object.entries(summary)) if (key.endsWith('_minor')) assert.equal(typeof value, 'string', key)
const exactMatch = await request('rpc/search_transactions?select=id,debit_minor::text', owner, { ...searchArgs, p_min_amount_minor: fixture.expected_minor, p_max_amount_minor: fixture.expected_minor })
assert.equal(exactMatch.status, 200); assert.equal((await exactMatch.json()).length, 1)
const excluded = await request('rpc/search_transactions?select=id', owner, { ...searchArgs, p_min_amount_minor: (BigInt(fixture.expected_minor) + 1n).toString() })
assert.equal(excluded.status, 200); assert.deepEqual(await excluded.json(), [])
const denied = []
for (const [actor, token] of [['anonymous', c.credentials.anon], ['other_organization', outsider]]) {
  const response = await request('rpc/read_exact_dashboard_summary', token, { p_organization_id: fixture.organization })
  const error = await response.json()
  assert.ok([400, 401, 403].includes(response.status), `${actor}: HTTP ${response.status}`)
  assert.ok(['42501', 'P0001', '28000'].includes(error.code), `${actor}: unexpected error code`)
  denied.push({ actor, status: response.status, code: error.code })
}
assert.equal(c.sql("select prosecdef::text from pg_proc where oid='public.read_exact_dashboard_summary(uuid)'::regprocedure;"), 'false')
assert.equal(c.sql("select has_function_privilege('anon','public.read_exact_dashboard_summary(uuid)','execute')::text;"), 'false')
const before = JSON.parse(readFileSync(path.join(directory, 'before-migration.json'), 'utf8'))
const after = JSON.parse(readFileSync(path.join(directory, 'after-migration.json'), 'utf8'))
assert.deepEqual(before, after)
const evidence = { task: fixture.task, date: new Date().toISOString().slice(0, 10), parent_pr: 439, parent_sha: '6e2205ce81e06b9bf239a7d254aa0fa605e8cfdb', state: 'native_transport_passed_browser_qualification_in_progress', stored_minor: stored.debits, old_numeric_parse: JSON.parse(readFileSync(path.join(directory, 'old-transport.json'), 'utf8')).parsed_minor, exact_search_minor: row.debit_minor, summary_assets_minor: assets, exact_filter_match: true, one_cent_exclusion: true, cross_tenant_and_anonymous_denials: denied, invoker_authority: true, before_migrations: 107, after_migrations: 108, preserved_tables: before.length, preservation_sha256: createHash('sha256').update(JSON.stringify(after)).digest('hex'), financial_reset_or_delete: false, limits: ['No hosted/Automation mutation or accountant acceptance.', 'Numeric chart/percentage geometry is approximate; monetary labels and command/filter integers remain exact.'] }
writeFileSync(path.join(root, 'apps/ledger-suit/docs/accountant-system/v2-acceptance/journal-precision-verification-2026-10-28.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify({ task: fixture.task, exact_minor: stored.debits, assets_minor: assets, preserved_tables: before.length, denied }))

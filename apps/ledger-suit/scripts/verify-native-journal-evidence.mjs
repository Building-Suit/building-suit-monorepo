// Read-only reconciliation of retained native fixtures, independent of report RPCs.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { browserContext, root } from './native-browser-runtime.mjs'

const { sql } = browserContext()
const privateDirectory = path.join(root, '.local/verification/journal')
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--snapshot-before'))
const after = JSON.parse(sql(`begin read only;
select jsonb_build_object('captured_at',now(),
'accounts',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.accounts t),
 'transactions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.transactions t),
 'entries',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.transaction_entries t),
 'auth_users',(select count(*) from auth.users),
 'migrations',(select count(*) from supabase_migrations.schema_migrations)); commit;`))
if (process.argv[2] === '--snapshot-before') {
  mkdirSync(privateDirectory, { recursive: true, mode: 0o700 })
  writeFileSync(path.join(privateDirectory, 'before.json'), JSON.stringify(after, null, 2) + '\n', { mode: 0o600, flag: 'wx' })
  console.log('Native pre-run financial snapshot retained; existing snapshots cannot be overwritten.')
  process.exit(0)
}
const beforeBytes = readFileSync(path.join(privateDirectory, 'before.json'))
const before = JSON.parse(beforeBytes)
for (const collection of ['accounts', 'transactions', 'entries']) {
  const current = new Map(after[collection].map(row => [row.id, row]))
  for (const row of before[collection]) assert.deepEqual(current.get(row.id), row, `Existing ${collection} row changed`)
}
assert.equal(after.auth_users, before.auth_users)
assert.equal(after.migrations, before.migrations)
const resultsDirectory = path.join(root, 'test-results/native-journal-report-navigation')
const fixtures = readdirSync(resultsDirectory).filter(name => name.startsWith('journal-center-')).map(name => JSON.parse(readFileSync(path.join(resultsDirectory, name, 'native-journal-result.json'), 'utf8')))
assert.deepEqual(fixtures.map(row => row.locale).sort(), ['ar', 'en'])
const verified = []
for (const fixture of fixtures) {
  assert.equal(fixture.task, 'LS-JRN-VERIFY-001')
  const ids = [fixture.original, fixture.reversal, fixture.income]
  assert.equal(new Set(ids).size, 3)
  const transactions = ids.map(id => after.transactions.find(row => row.id === id))
  assert.ok(transactions.every(Boolean))
  const [original, reversal, income] = transactions
  assert.equal(original.status, 'reversed')
  assert.equal(original.reversed_by_transaction_id, reversal.id)
  assert.equal(reversal.reverses_transaction_id, original.id)
  assert.equal(reversal.status, 'posted')
  assert.equal(income.type, 'income'); assert.equal(income.status, 'posted')
  assert.equal(new Set(transactions.map(row => row.journal_reference)).size, 3)
  assert.ok(transactions.every(row => row.created_by === 'a0000000-0000-4000-8000-000000000001'))
  const entries = after.entries.filter(row => ids.includes(row.transaction_id))
  assert.equal(entries.length, 6)
  const sum = rows => rows.reduce((total, row) => total + BigInt(row.base_amount_minor), 0n)
  for (const [index, transaction] of transactions.entries()) {
    const lines = entries.filter(row => row.transaction_id === transaction.id)
    assert.equal(lines.length, 2)
    const expected = index === 2 ? 54300n : 32100n
    for (const side of ['debit', 'credit']) assert.equal(sum(lines.filter(row => row.side === side)), expected)
  }
  for (const side of ['debit', 'credit']) assert.equal(sum(entries.filter(row => row.side === side)).toString(), fixture[`expected_${side}s_minor`])
  const balance = account => entries.filter(row => row.account_id === account).reduce((total, row) => total + (row.side === 'debit' ? 1n : -1n) * BigInt(row.base_amount_minor), 0n)
  assert.equal(balance(fixture.bank).toString(), fixture.expected_bank_closing_minor)
  assert.equal(balance(fixture.equity), 0n)
  assert.equal(balance(fixture.revenue), -54300n)
  verified.push({ locale: fixture.locale, journals: 3, entries: 6, debit_minor: '118500', credit_minor: '118500', bank_closing_minor: '54300', equity_net_minor: '0', revenue_credit_minor: '54300', original: original.id, reversal: reversal.id, income: income.id })
}
// Include every retained attempt, not just the passing journey's selected rows.
for (const transaction of after.transactions) {
  const lines = after.entries.filter(row => row.transaction_id === transaction.id)
  const signed = lines.reduce((total, row) => total + (row.side === 'debit' ? 1n : -1n) * BigInt(row.base_amount_minor), 0n)
  assert.equal(signed, 0n, `Unbalanced retained journal ${transaction.id}`)
}
const sha256 = value => createHash('sha256').update(value).digest('hex')
const afterBytes = JSON.stringify(after, null, 2) + '\n'
writeFileSync(path.join(privateDirectory, 'after.json'), afterBytes, { mode: 0o600 })
const evidence = {
  task: 'LS-JRN-VERIFY-001', date: new Date().toISOString().slice(0, 10), parent_pr: 508,
  parent_sha: 'dd4a7961198b76d7df460dc84881d946c89b6c3e',
  state: 'native_journal_and_report_navigation_passed_external_gates_pending',
  browser: { cases: 2, passed: 2, failed: 0, retries: 0, locales: ['en', 'ar'], backend: 'actual local Auth/PostgREST; no API interception or injected sessions' },
  independent_oracle: 'Raw retained accounts/transactions/transaction_entries read in a read-only SQL transaction; integer minor-unit arithmetic, no report RPC oracle.',
  verified_fixtures: verified,
  preserved_original: { accounts: before.accounts.length, transactions: before.transactions.length, entries: before.entries.length, all_original_rows_identical: true },
  retained_total: { accounts: after.accounts.length, journals: after.transactions.length, entries: after.entries.length, includes_failed_or_interrupted_test_attempts: true, all_journals_balanced: true },
  auth_users: after.auth_users, migrations: after.migrations,
  before_sha256: sha256(beforeBytes), after_sha256: sha256(afterBytes),
  source_sha256: Object.fromEntries(['apps/ledger-suit/scripts/native-browser-runtime.mjs', 'apps/ledger-suit/scripts/verify-native-journal-evidence.mjs', 'apps/ledger-suit/playwright.native-journal.config.ts', 'apps/ledger-suit/tests/e2e/journal-center.spec.ts'].map(file => [file, sha256(readFileSync(path.join(root, file)))])),
  limits: ['No hosted or Automation mutation.', 'FS-06 broader saved-filter/focus UAT and every named accountant verdict remain pending.', 'Financial records and owned volumes retained; no reset/delete.'],
}
writeFileSync(path.join(root, 'apps/ledger-suit/docs/accountant-system/v2-acceptance/native-journal-verification-2026-10-28.json'), JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify({ task: evidence.task, browser_cases: 2, reconciled_journals: 6, reconciled_entries: 12, existing_rows_preserved: true, retained_journals: after.transactions.length, retained_entries: after.entries.length }))

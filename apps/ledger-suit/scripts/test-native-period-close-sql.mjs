// Original rollback fixtures on the guarded period-close project only.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { periodContext, privateResult, root } from './native-period-close-runtime.mjs'
assert.equal(process.argv.length, 2)
const c = periodContext()
const tables = c.sql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','app') order by 1;").split('\n')
assert.ok(tables.length >= 122)
for (const name of tables) assert.match(name, /^(public|app)\.[a-z0-9_]+$/)
const fingerprint = () => createHash('sha256').update(c.sql(tables.map(name => `select '${name}',count(*),encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text,'sha256'),'hex') from ${name} t;`).join('\n'))).digest('hex')
const before = fingerprint()
const checks = []
for (const file of ['35_accounting_periods_test.sql', '39_opening_balance_migrations_test.sql', '42_bank_reconciliation_test.sql', '45_approved_egypt_vat_test.sql']) {
  const output = c.sql(readFileSync(path.join(root, 'apps/ledger-suit/supabase/tests', file), 'utf8'))
  privateResult(file + '.log', output)
  assert.doesNotMatch(output, /^not ok|^Bail out!/m, file)
  const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)]
  assert.equal(plans.length, 1)
  const assertions = [...output.matchAll(/^ok \d+(?:\s|$)/gm)].length
  assert.equal(assertions, Number(plans[0][1]), 'Require every planned native assertion')
  checks.push({ file, assertions, result: 'pass' })
}
assert.equal(fingerprint(), before, 'Rollback fixtures changed retained public/app data')
const evidence = { task: 'LS-REL-CLOSE-001', checks, preserved_tables: tables.length, before_after_sha256: before, execution: 'Original pgTAP SQL through native PostgreSQL/psql; not the CLI pg_prove runner.', result: 'pass' }
privateResult('sql-result.json', evidence)
console.log(JSON.stringify(evidence))

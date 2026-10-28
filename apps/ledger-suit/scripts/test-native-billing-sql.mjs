// Relevant rollback fixtures against the exact owned billing database only.
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { billingContext, digest, root, writePrivate } from './native-billing-context.mjs'
assert.equal(process.argv.length, 2)
const c = billingContext()
const source = path.join(root, 'apps/ledger-suit/supabase')
const migrations = readdirSync(path.join(source, 'migrations')).filter(file => file.endsWith('.sql')).sort()
assert.deepEqual(c.psql('select version from supabase_migrations.schema_migrations order by version').split('\n'), migrations.map(file => file.split('_')[0]))
const tables = c.psql("select schemaname||'.'||tablename from pg_tables where schemaname in ('public','app') order by 1").split('\n')
assert.ok(tables.length >= 122)
for (const name of tables) assert.match(name, /^(public|app)\.[a-z0-9_]+$/)
const fingerprints = () => digest(c.psql(tables.map(name => `select '${name}',count(*),encode(extensions.digest(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]'::jsonb)::text,'sha256'),'hex') from ${name} t;`).join('\n')))
const before = fingerprints()
const checks = []
for (const file of ['77_manual_payment_test.sql', '78_platform_admin_test.sql', '79_platform_admin_operations_test.sql']) {
  const output = c.psql(readFileSync(path.join(source, 'tests', file), 'utf8'))
  writePrivate(path.join(c.directory, file + '.log'), output)
  assert.doesNotMatch(output, /^not ok|^Bail out!/m, `Native SQL fixture failed: ${file}`)
  const plans = [...output.matchAll(/^1\.\.(\d+)$/gm)]
  assert.equal(plans.length, 1, 'Require one actual pgTAP plan')
  const assertions = [...output.matchAll(/^ok \d+(?:\s|$)/gm)].length
  assert.equal(assertions, Number(plans[0][1]), 'Every planned assertion must execute')
  checks.push({ file, assertions, result: 'pass' })
}
assert.equal(fingerprints(), before, 'Rollback fixtures changed retained public/app data')
const evidence = { task: 'LS-BILL-NATIVE-001', migrations: migrations.length, checks, preserved_tables: tables.length, before_after_sha256: before, fixture_actions: 'Actual pgTAP/SQL assertions; each source fixture rolls back', result: 'pass' }
writePrivate(path.join(c.directory, 'sql-result.json'), evidence)
console.log(JSON.stringify(evidence))

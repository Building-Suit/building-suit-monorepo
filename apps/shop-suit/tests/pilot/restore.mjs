import { randomUUID, createHash } from 'node:crypto'
import { readFile, mkdir, writeFile, chmod } from 'node:fs/promises'
import { requireDisposable, localCommand, sql, container, suites, root } from './local-backend.mjs'

// A whole LOCAL synthetic database exercise. No URL, project ref, source
// database, destination database, or dump file can be supplied by the caller.
const id = randomUUID().replaceAll('-', '')
const database = `ss_pilot_restore_${id}`
const archive = `/tmp/${database}.dump`
let created = false
let dumped = false
const started = Date.now()

// Compare every row, including immutable snapshots/audit/idempotency records,
// using order-independent hashes. No row contents leave the local database.
const fingerprint = `
create temporary table pilot_fingerprint (relation text, rows bigint, digest text);
do $$ declare t record; begin
  for t in select schemaname, tablename from pg_tables
    where schemaname in ('public', 'shop_private', 'auth') order by 1, 2
  loop
    execute format('insert into pilot_fingerprint select %L, count(*), md5(coalesce(string_agg(md5(to_jsonb(t)::text), %L order by md5(to_jsonb(t)::text)), %L)) from %I.%I t',
      t.schemaname || '.' || t.tablename, '', '', t.schemaname, t.tablename);
  end loop;
end $$;
select jsonb_agg(to_jsonb(f) order by relation) from pilot_fingerprint f;
`

try {
  requireDisposable()
  // Do not call this against a busy backend: stop the browser/app writers first.
  const before = sql(fingerprint, 'postgres', 'supabase_admin')
  const counts = JSON.parse(before)
  for (const name of ['public.shops', 'public.shop_locations', 'public.appointments', 'public.invoices', 'public.payments', 'public.sale_receipts', 'public.cash_sessions']) {
    if (!counts.some(row => row.relation === name && row.rows > 0)) throw new Error(`Restore proof needs synthetic pilot journey data in ${name}; run the authenticated matrix first`)
  }
  dumped = true
  localCommand('docker', ['exec', container, 'sh', '-c', 'umask 077; exec pg_dump "$@"', 'sh', '-U', 'supabase_admin', '-d', 'postgres', '--format=custom', '--file', archive])
  sql(`CREATE DATABASE ${database} TEMPLATE template0;`, 'postgres', 'supabase_admin')
  created = true
  localCommand('docker', ['exec', container, 'pg_restore', '-U', 'supabase_admin', '-d', database, '--exit-on-error', '--clean', '--if-exists', archive])
  const after = sql(fingerprint, database, 'supabase_admin')
  if (before !== after) throw new Error('Restored row counts/content differ; restore is NOT qualified')
  if (before !== sql(fingerprint, 'postgres', 'supabase_admin')) throw new Error('Source changed during drill; stop writers and repeat')
  for (const suite of suites) {
    const source = await readFile(new URL(`../../supabase/tests/${suite}.sql`, import.meta.url), 'utf8')
    sql(`BEGIN;\n${source.replace(/\bshop_crm\b/g, 'public')}\nROLLBACK;`, database)
  }
  const directory = `${root}/.local/ss-pilot-001`
  await mkdir(directory, { recursive: true, mode: 0o700 })
  await chmod(directory, 0o700)
  await writeFile(`${directory}/restore-evidence.json`, JSON.stringify({
    task: 'SS-PILOT-001', scope: 'synthetic local database only',
    head: localCommand('git', ['rev-parse', 'HEAD']), completedAt: new Date().toISOString(),
    elapsedMs: Date.now() - started, relationCount: counts.length,
    fingerprintSha256: createHash('sha256').update(after).digest('hex'),
    rowComparison: 'passed', regressionSuites: suites, hostedRecovery: 'unverified',
  }, null, 2) + '\n', { mode: 0o600 })
  console.log('Disposable restore: row fingerprints and all pilot SQL suites passed. Evidence: .local/ss-pilot-001/restore-evidence.json')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  try {
    if (created) sql(`DROP DATABASE ${database};`, 'postgres', 'supabase_admin')
  } catch {
    console.error(`Disposable cleanup failed; operator must remove only ${database} in the local Shop container.`)
    process.exitCode = 1
  }
  try {
    if (dumped) localCommand('docker', ['exec', container, 'rm', '-f', '--', archive])
  } catch {
    console.error(`Archive cleanup failed; operator must remove only ${archive} in the local Shop container.`)
    process.exitCode = 1
  }
}

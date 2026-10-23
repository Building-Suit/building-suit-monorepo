import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { measurementUnits } from '../../apps/shop-suit/app/utils/measurement.js'
import { ensureDisposableImage } from '../releases/docker-harness.mjs'

// All Shop-owned objects replay their actual migrations. Provider interfaces are
// explicit stand-ins: this is a schema regression, NOT full Supabase acceptance.
// No caller can select a hosted URL, existing container or database.
const args = process.argv.slice(2)
const regressions = args.includes('--regressions')
if (regressions) args.splice(args.indexOf('--regressions'), 1)
assert.ok(!args.length || (args.length === 2 && args[0] === '--types' && args[1]), 'Expected optional --regressions and --types output-file')
const regressionFailures = []
const name = `bs-shop-measurement-${randomUUID()}`
const network = `${name}-types`
const dbImage = 'postgres:17-alpine'
const metaImage = 'public.ecr.aws/supabase/postgres-meta:v0.98.0'
const app = new URL('../../apps/shop-suit/', import.meta.url)
const migrations = new URL('supabase/migrations/', app)
function docker(command, input) {
  const result = spawnSync('docker', command, { input, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  if (result.status !== 0) throw new Error(result.stderr || String(result.error || 'Disposable Docker command failed'))
  return result.stdout.trim()
}
const sql = statement => docker(['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'], statement)
ensureDisposableImage(dbImage)
try {
  docker(['run', '-d', '--name', name, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', dbImage])
  for (let count = 0; ; count++) {
    if (spawnSync('docker', ['exec', name, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) break
    assert.ok(count < 100, 'Disposable PostgreSQL startup timeout')
    await delay(100)
  }
  sql(readFileSync(new URL('supabase/tests/fixtures/measurement_provider_standins.sql', app), 'utf8'))
  const names = readdirSync(migrations).filter(file => file.endsWith('.sql')).sort()
  assert.ok(names.includes('20261022185512_measurement_foundation.sql'), 'Measurement migration missing')
  for (const file of names) {
    if (file === '20260929190000_canonical_plan_catalog.sql') {
      // Same maintained historical upgrade seed used by the real Supabase jobs.
      const seed = readFileSync(new URL('supabase/seed.sql', app), 'utf8').split('select shop_private.reconcile_plan_catalog();')[0]
      assert.ok(seed.includes("'Basic', 'basic'") && seed.includes("'Pro', 'pro'"))
      sql(seed.replaceAll("'EGP', 7,", "'EGP', 14,"))
    }
    let source = readFileSync(new URL(file, migrations), 'utf8')
    if (file === '20261013115916_xpay_checkout_readiness_scheduler.sql') {
      for (const extension of ['pg_cron with schema pg_catalog', 'pg_net with schema extensions']) {
        const declaration = `create extension if not exists ${extension};`
        assert.equal(source.split(declaration).length, 2, 'External fixture boundary changed; review required')
        source = source.replace(declaration, '-- Schema-fixture provider stand-in; invocation throws.')
      }
    }
    if (file === '20261022185512_measurement_foundation.sql') {
      // One session retains temp upgrade fixtures across the actual migration.
      source = readFileSync(new URL('supabase/tests/fixtures/measurement_upgrade_setup.sql', app), 'utf8')
        + '\n' + source + '\n' + readFileSync(new URL('supabase/tests/fixtures/measurement_upgrade_assert.sql', app), 'utf8')
    }
    try { sql(source) } catch (error) { throw new Error(`Migration failed: ${file}`, { cause: error }) }
  }
  sql(`BEGIN;\n${readFileSync(new URL('supabase/tests/shop_measurement_foundation.sql', app), 'utf8')}\nROLLBACK;`)
  sql(`BEGIN;\n${readFileSync(new URL('supabase/tests/shop_measured_retail.sql', app), 'utf8')}\nROLLBACK;`)
  console.log('Electrical measured merchant journey: PASS')
  for (const suite of regressions ? ['shop_crm_product_catalog', 'shop_sale_issuance', 'shop_stock_counts_corrections', 'shop_supplier_payables_returns', 'shop_service_materials', 'shop_partial_returns', 'shop_storefront_bundle_offers', 'shop_operating_reports', 'shop_website_catalog'] : []) {
    const fixture = readFileSync(new URL(`supabase/tests/${suite}.sql`, app), 'utf8').replace(/\bshop_crm\b/g, 'public')
    try {
      sql(`BEGIN;\n${fixture}\nROLLBACK;`)
      console.log(`${suite}: PASS in schema fixture; provider acceptance separate`)
    } catch (error) {
      regressionFailures.push(suite)
      console.error(`Existing regression FAILED: ${suite}; ${error.message}`)
    }
  }
  // Two actual database sessions, with a readiness probe on the blocking lock.
  // The product lock is held BEFORE configuration commits, so the stock writer
  // must wait, re-read its measurement status and reject the now-prepared item.
  sql(readFileSync(new URL('supabase/tests/fixtures/measurement_concurrency_setup.sql', app), 'utf8'))
  const race = JSON.parse(sql('select row_to_json(f) from measurement_test.race f;'))
  const authenticated = body => `set request.jwt.claim.sub='${race.owner_id}'; set request.jwt.claim.role='authenticated'; set role authenticated; ${body}`
  const parallelSql = statement => new Promise((resolve, reject) => {
    const child = spawn('docker', ['exec', '-i', name, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-Atq'])
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.on('error', reject)
    child.on('close', code => resolve({ code, stdout, stderr }))
    child.stdin.end(statement)
  })
  const preparing = parallelSql(`begin;set application_name='measurement-config-race';${authenticated(`select public.prepare_product_measurement('${race.shop_id}','${race.product_id}','m','0.01','Concurrent measurement preparation');`)}select pg_sleep(1.5);commit;`)
  let observedLock = false
  for (let attempt = 0; attempt < 40; attempt++) {
    if (sql("select count(*) from pg_stat_activity where application_name='measurement-config-race' and wait_event='PgSleep';") === '1') { observedLock = true; break }
    await delay(25)
  }
  assert.ok(observedLock, 'Configuration race did not reach its held-lock barrier')
  const receiving = parallelSql(authenticated(`select public.adjust_stock(gen_random_uuid(),'${race.shop_id}','${race.product_id}',100,25,'Concurrent opening receipt');`))
  const [configured, received] = await Promise.all([preparing, receiving])
  assert.equal(configured.code, 0, configured.stderr)
  assert.notEqual(received.code, 0, 'Concurrent old writer accepted prepared stock')
  assert.ok(received.stderr.includes('MEASUREMENT_WORKFLOW_NOT_READY'), 'Concurrent receipt failed for an unexpected reason')
  assert.equal(sql(`select count(*) from public.inventory_batches where product_id='${race.product_id}';`), '0')
  assert.equal(sql(`select count(*) from public.product_measurement_changes where product_id='${race.product_id}';`), '1')
  console.log('Configuration/stock race: PASS; second session rechecks prepared status after product-lock wait; no stock or partial movement')
  const registry = JSON.parse(sql("select jsonb_agg(jsonb_build_object('code',code,'factor',case when canonical_conversion_factor is null then null else trim_scale(canonical_conversion_factor)::text end,'precision',allowed_precision,'nameEn',name_en,'nameAr',name_ar,'symbol',symbol,'dimension',dimension,'isActive',is_active) order by code) from public.units_of_measure;"))
  assert.deepEqual(registry, measurementUnits.map(unit => ({ code: unit.code, factor: unit.factor, precision: unit.allowedPrecision, nameEn: unit.nameEn, nameAr: unit.nameAr, symbol: unit.symbol, dimension: unit.dimension, isActive: unit.isActive })).sort((a, b) => a.code.localeCompare(b.code, 'en')))
  if (args.length) {
    ensureDisposableImage(metaImage, 'docker.io/supabase/postgres-meta:v0.98.0')
    docker(['network', 'create', network])
    docker(['network', 'connect', network, name])
    const types = docker(['run', '--rm', '--network', network,
      '-e', 'PG_META_GENERATE_TYPES=typescript', '-e', 'PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public',
      '-e', 'PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true',
      '-e', `PG_META_DB_HOST=${name}`, '-e', 'PG_META_DB_USER=postgres', '-e', 'PG_META_DB_NAME=postgres',
      '-e', 'PG_META_DB_PASSWORD=postgres', metaImage])
    assert.ok(types.startsWith('export type Json') && types.includes('product_measurement_changes:'), 'Expected generated public schema contract')
    writeFileSync(args[1], types + '\n')
  }
  if (regressionFailures.length) throw new Error(`Core measurement checks passed; existing regression failures retained: ${regressionFailures.join(', ')}`)
  console.log(`PASS: ${names.length} Shop business migrations, exact conversion/configuration/RLS/legacy tests and JS/SQL registry conformance. Provider stand-ins; full Supabase acceptance remains separate.`)
} finally {
  // Only uniquely named resources owned by this invocation are removed.
  spawnSync('docker', ['rm', '-fv', name], { stdio: 'ignore', timeout: 30000 })
  spawnSync('docker', ['network', 'rm', network], { stdio: 'ignore', timeout: 10000 })
}

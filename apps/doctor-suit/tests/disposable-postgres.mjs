import { verifyPracticeBillingConcurrency } from './practice-billing-concurrency.mjs'
import { verifySaasLifecycleRequestConcurrency } from './saas-lifecycle-request-concurrency.mjs'
import{verifyReportsConcurrency}from'./reports-concurrency.mjs'
import{pullPinnedDoctorMetaImage}from'./pinned-meta-image.mjs'
import{verifyImportConcurrency}from'./import-concurrency.mjs'
import{verifyFulfillmentConcurrency}from'./fulfillment-concurrency.mjs'
import{verifyOutboxConcurrency}from'./outbox-concurrency.mjs'
import{verifyContactConcurrency}from'./contacts-concurrency.mjs'
import{verifyWorklistConcurrency}from'./worklists-concurrency.mjs'
import{verifyWaitlistConcurrency}from './waitlist-concurrency.mjs'
import{verifyConsultationConcurrency}from './consultations-concurrency.mjs'
import {verifyClinicalConcurrency} from './clinical-concurrency.mjs'
// SQL/RLS fallback for small executors. This is not a Supabase service integration test.
import { verifyAnnualPricingUpgrade } from './annual-pricing-upgrade.mjs'
import{verifyReceptionConcurrency}from'./reception-concurrency.mjs'
import{verifyDoctorIsolatedRecovery}from'./recovery-isolated.mjs'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { validateLocalDoctorTarget } from './local-lifecycle.mjs'
import { verifyOnboardingConcurrency } from './onboarding-concurrency.mjs'
import { verifyInvitationConcurrency } from './invitations-concurrency.mjs'
import { verifyPatientConcurrency } from './patients-concurrency.mjs'
import { verifyDocumentConcurrency } from './documents-concurrency.mjs'
import { verifyAvailabilityConcurrency } from './availability-concurrency.mjs'
import { verifyAppointmentConcurrency } from './appointments-concurrency.mjs'
import { verifyAccountConcurrency } from './account-concurrency.mjs'
import { verifyCandidateAdmissionConcurrency } from './candidate-admission-concurrency.mjs'
import { verifyDoctorAdministrationProtocol } from './administration-protocol-postgres.mjs'
import { verifySaasReconciliationConcurrency } from './saas-reconciliation-concurrency.mjs'
import { verifySaasQuoteConcurrency } from './saas-quote-concurrency.mjs'
import { verifyManualPaymentConcurrency } from './manual-payments-concurrency.mjs'
import { verifySaasTrialConcurrency } from './saas-trial-concurrency.mjs'
import { verifySaasQuotaConcurrency } from './saas-quota-concurrency.mjs'
import { verifySaasReservationConcurrency } from './saas-reservation-concurrency.mjs'
import { verifySaasWriteConcurrency } from './saas-write-concurrency.mjs'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const app = `${root}apps/doctor-suit/`
const argv=process.argv.slice(2)
const focused=argv[0]==='--suite'&&argv.length===2&&/^dos-m3-00[6-9]\.sql$|^dos-m3-010\.sql$/.test(argv[1])?argv[1]:null
const generate = focused?[]:argv
if (generate.length && (generate.length !== 1 || generate[0] !== '--types')) throw new Error('Only --types is supported')
validateLocalDoctorTarget(JSON.parse(await readFile(`${root}docs/architecture/environments.json`, 'utf8')), await readFile(`${app}supabase/config.toml`, 'utf8'), process.env)
const container = `doctor-sql-${randomUUID()}`
const directory = await mkdtemp(path.join(tmpdir(), 'doctor-sql-'))
const pgImage = 'postgres:17-alpine@sha256:b0f9560a2de083e2cc7382e75f808c7381a32852a7ec49117deedb300e552b24'
const pgtapCommit = '968eb53a33114e83042b3bdb0c664b5b80cf8bdf'
function docker(args, input) {
  const result = spawnSync('docker', args, { input, encoding: 'utf8', timeout: 120000, maxBuffer: 8 * 1024 * 1024 })
  if (result.error || result.status !== 0) throw new Error(`Disposable Docker step failed: ${args[0]}\n${result.stderr || ''}`)
  return result.stdout
}
function sql(input) { return docker(['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At'], input) }
async function source(name, hash) {
  const response = spawnSync('curl', ['--fail', '--silent', '--show-error', '--location', '--max-time', '30',
    `https://raw.githubusercontent.com/theory/pgtap/${pgtapCommit}/${name}`], { encoding: 'utf8', timeout: 35000, maxBuffer: 2 * 1024 * 1024 })
  if (response.error || response.status !== 0) throw new Error('Pinned pgTAP source unavailable')
  const value = response.stdout
  if (createHash('sha256').update(value).digest('hex') !== hash) throw new Error('Pinned pgTAP source mismatch')
  return value
}
try {
  const definition = await source('sql/pgtap.sql.in', '383ecd73edfd1c7ed5f3b835134ee1fe74e201ee31599346c92ea029b65dcdce')
  const control = await source('pgtap.control', 'b073089908333a1522c925ca9968cebb04d9fa0b1f99e932bda635ffaecdca55')
  // These are the upstream Makefile's PostgreSQL >= 10 substitutions, without legacy compatibility patches.
  await writeFile(`${directory}/pgtap--1.3.4.sql`, definition.replaceAll('MODULE_PATHNAME', 'pgtap').replaceAll('__OS__', 'linux').replaceAll('__VERSION__', '1.3'), { mode: 0o644 })
  await writeFile(`${directory}/pgtap.control`, control, { mode: 0o644 })
  // The image briefly runs a socket-only initialization server before restarting.
  // Delay that phase deliberately so every run exercises the readiness boundary.
  await writeFile(`${directory}/doctor-readiness.sql`, 'select pg_sleep(1);\n', { mode: 0o644 })
  await chmod(`${directory}/doctor-readiness.sql`, 0o644)
  docker(['create', '--name', container, '--network', 'none', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', pgImage])
  docker(['cp', `${directory}/doctor-readiness.sql`, `${container}:/docker-entrypoint-initdb.d/doctor-readiness.sql`])
  docker(['start', container])
  let ready = false
  for (let n = 0; n < 60; n++) {
    if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break }
    await new Promise(resolve => setTimeout(resolve, 250))
  }
  if (!ready) throw new Error('Disposable PostgreSQL did not become ready')
  console.log('Final TCP server ready after the deliberately delayed socket-only initialization phase')
  for (const file of ['pgtap.control', 'pgtap--1.3.4.sql']) docker(['cp', `${directory}/${file}`, `${container}:/usr/local/share/postgresql/extension/${file}`])
  docker(['exec', container, 'chmod', '644', '/usr/local/share/postgresql/extension/pgtap.control', '/usr/local/share/postgresql/extension/pgtap--1.3.4.sql'])
  sql(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,is_anonymous boolean default false,banned_until timestamptz,deleted_at timestamptz,raw_user_meta_data jsonb);
    create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz,created_at timestamptz default now());
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
    grant usage on schema auth,extensions to anon,authenticated,service_role;
    grant execute on function auth.uid() to anon,authenticated;`)
  // Minimal Storage interface scaffold for PostgreSQL policy/metadata tests only.
  // Real Storage HTTP/byte validation belongs to the separate actual-provider run.
  sql(`create schema storage;
    create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text not null references storage.buckets(id),name text not null,metadata jsonb);
    alter table storage.buckets enable row level security; alter table storage.objects enable row level security;
    grant usage on schema storage to anon,authenticated,service_role;
    grant select,insert,update,delete on storage.buckets,storage.objects to anon,authenticated,service_role;`)
  // Emulate configured bucket metadata only; the actual provider fixture uses
  // the supported Storage API and checks HTTP/private bytes independently.
  sql(`insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('doctor-private-documents','doctor-private-documents',false,5242880,array['application/pdf','image/png','image/jpeg']);`)
  sql(`insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('doctor-payment-evidence','doctor-payment-evidence',false,5242880,array['application/pdf','image/png','image/jpeg']);`)
  // Publication interface only. No logical replication service is run here.
  sql('create publication supabase_realtime;')
  const migrations = (await readdir(`${app}supabase/migrations`)).filter(file => file.endsWith('.sql')).sort()
  for (const file of migrations) {
    const migration = await readFile(`${app}supabase/migrations/${file}`, 'utf8')
    if (file === '20261018154514_doctor_annual_discount_32.sql') verifyAnnualPricingUpgrade(sql, migration, await readFile(`${app}supabase/tests/dos-instapay-manual.sql`, 'utf8'))
    sql(migration)
  }
  const suites = (await readdir(`${app}supabase/tests`)).filter(file => file.endsWith('.sql')&&(!focused||file===focused)).sort()
  if (!suites.length) throw new Error('No Doctor SQL suites found')
  // Preserve psql's file-relative includes for shared, test-only fixtures.
  docker(['cp', `${app}supabase/tests`, `${container}:/doctor-tests`])
  for (const file of suites) {
    const result = docker(['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-f', `/doctor-tests/${file}`])
    const plan = result.match(/^1\.\.(\d+)$/m)
    const passed = result.match(/^ok \d+\b/gm) ?? []
    if (!plan || Number(plan[1]) < 1 || Number(plan[1]) !== passed.length || /^not ok\b|^Bail out!/m.test(result)) throw new Error(`${file}: SQL assertions failed\n${result}`)
    console.log(`${file}: ${passed.length} SQL assertions passed`)
  }
  if(!focused){
  await verifyReportsConcurrency(container)
  await verifyImportConcurrency(container)
  await verifyFulfillmentConcurrency(container)
  await verifyOutboxConcurrency(container)
  await verifyContactConcurrency(container)
  await verifyWorklistConcurrency(container)
  await verifyReceptionConcurrency(container)
  await verifyWaitlistConcurrency(container)
  await verifyConsultationConcurrency(container)
  await verifyClinicalConcurrency(container)
  await verifyOnboardingConcurrency(container)
  await verifyInvitationConcurrency(container)
  await verifyPatientConcurrency(container)
  await verifyDocumentConcurrency(container)
  await verifyAvailabilityConcurrency(container)
  await verifyAppointmentConcurrency(container)
  await verifyAccountConcurrency(container)
  await verifyCandidateAdmissionConcurrency(container)
  await verifySaasTrialConcurrency(container)
  await verifySaasQuotaConcurrency(container)
  await verifySaasWriteConcurrency(container)
  await verifySaasReservationConcurrency(container)
  await verifySaasQuoteConcurrency(container)
  await verifySaasReconciliationConcurrency(container)
  await verifyDoctorAdministrationProtocol(container)
  await verifyManualPaymentConcurrency(container)
  await verifySaasLifecycleRequestConcurrency(container)
  await verifyPracticeBillingConcurrency(container)
  await verifyDoctorIsolatedRecovery(container)
  }
  if (generate.length) {
    // Registry throttling must remain a failed check after bounded retries; it
    // cannot waive schema generation or select an unpinned image.
    // Official v0.98.0 release publishes this same build to GHCR, ECR and Docker Hub:
    // https://github.com/supabase/postgres-meta/blob/v0.98.0/.github/workflows/release.yml
    const metaImage=await pullPinnedDoctorMetaImage(image=>spawnSync('docker',['pull',image],{encoding:'utf8',timeout:120000,maxBuffer:1024*1024}))
    const output = docker(['run', '--rm', '--network', `container:${container}`,
      '-e', 'PG_META_DB_HOST=127.0.0.1', '-e', 'PG_META_DB_NAME=postgres', '-e', 'PG_META_DB_USER=postgres',
      '-e', 'PG_META_GENERATE_TYPES=typescript', '-e', 'PG_META_GENERATE_TYPES_INCLUDED_SCHEMAS=public',
      '-e', 'PG_META_GENERATE_TYPES_DETECT_ONE_TO_ONE_RELATIONSHIPS=true', metaImage])
    if (!output.startsWith('export type Json') || !output.includes('doctor_onboard:')) throw new Error('Unexpected PostgreSQL Meta type output')
    await mkdir(`${app}app/types`, { recursive: true })
    await writeFile(`${app}app/types/database.types.ts`, output)
    await mkdir(`${app}supabase/functions/_shared`, { recursive: true })
    await writeFile(`${app}supabase/functions/_shared/database.types.ts`, output)
    console.log('Generated public schema types from the migrated disposable database using CLI-pinned PostgreSQL Meta v0.98.0')
  }
  console.log(focused?'FOCUSED diagnostic only; inherited suites/races/recovery not executed.':'Full SQL regression completed.');
  console.log('SQL/RLS verification only. Minimal Auth/Storage interfaces only; actual Supabase Auth, Storage and Realtime service integration: UNRUN in this SQL runner.')
} finally {
  spawnSync('docker', ['rm', '-f', '-v', container], { stdio: 'ignore' })
  await rm(directory, { recursive: true, force: true })
}

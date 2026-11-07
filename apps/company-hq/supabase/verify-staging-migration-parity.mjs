import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const manifestPath = path.join(root, 'apps/company-hq/supabase/staging-migration-parity.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const migrationsDir = path.join(root, 'apps/company-hq/supabase/migrations')
const activeNames = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
const pending = manifest.pendingMigrations || []
const expectedNames = [...manifest.appliedMigrations, ...pending].map(row => row.file).sort()
const failures = []

// Phase 2 is an explicitly unmerged source-preparation stack. This inventory
// never asserts a hosted migration or authorizes deployment/merge.
const compatibility = pending.filter(row => row.phase === 'worker-status-compatibility')
if (compatibility.length > 1 || compatibility.some(row => row.file !== '20261107133124_hq_worker_status_compatibility.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown worker compatibility source')
const phase1 = pending.filter(row => row.phase === 'admission-fence')
const trialSkills = pending.filter(row => row.phase === 'trial-skills-review-only')
if (trialSkills.length > 1 || trialSkills.some(row => row.file !== '20261107040848_hq_trial_failure_and_assigned_skills.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial skills source')
const trialDelivery = pending.filter(row => row.phase === 'trial-delivery-review-only')
if (trialDelivery.length > 1 || trialDelivery.some(row => row.file !== '20261107034418_hq_workforce_trial_delivery.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial delivery source')
const phase2 = pending.filter(row => row.phase === 'contract2-review-only')
const contract2Sources = [
  {
    "file": "20261107024306_hq_department_staffing_needs.sql",
    "proposal": "tooling/hq-agent-host/proposed-migrations/20261106000000_hq_department_staffing_needs.sql"
  },
  {
    "file": "20261107024314_hq_department_orchestration_contract.sql",
    "proposal": "tooling/hq-agent-host/proposed-migrations/20261106010000_hq_department_orchestration_contract.sql"
  },
  {
    "file": "20261107024322_hq_supervised_worker_trials.sql",
    "proposal": "tooling/hq-agent-host/proposed-migrations/20261106020000_hq_supervised_worker_trials.sql"
  },
  {
    "file": "20261107024331_hq_qualified_research_web_search.sql",
    "proposal": "tooling/hq-agent-host/proposed-migrations/20261106030000_hq_qualified_research_web_search.sql"
  },
  {
    "file": "20261107024338_hq_worker_model_execution_receipts.sql",
    "proposal": "tooling/hq-agent-host/proposed-migrations/20261106114053_hq_worker_model_execution_receipts.sql"
  },
  {
    "file": "20261107024348_hq_worker_release_capability.sql",
    "proposal": "tooling/hq-agent-host/database-release-contract.sql"
  }
]
if (phase1.length !== 1 || phase1.some(row => row.status !== 'approved-source-not-deployed' || !/^\d{14}_hq_worker_admission_fence\.sql$/.test(row.file))) failures.push('approved phase-1 fence inventory changed')
if (pending.length !== phase1.length + phase2.length + trialDelivery.length + trialSkills.length + compatibility.length || ![0,6].includes(phase2.length)) failures.push('incomplete or unknown pending migration phase')
for (const [index,row] of phase2.entries()) {
  if (row.status !== 'source-only-live-approval-required' || row.file !== contract2Sources[index].file || row.proposal !== contract2Sources[index].proposal) failures.push('contract-2 source/order differs from reviewed proposals')
}
if (pending.map(row => row.file).join() !== pending.map(row => row.file).sort().join()) failures.push('pending migration order is not chronological')
if (new Set(expectedNames).size !== expectedNames.length) failures.push('duplicate migration inventory')
if (manifest.schemaVersion !== 1 || manifest.environment !== 'staging') failures.push('manifest identity is invalid')
if (activeNames.length !== expectedNames.length || activeNames.some((name, index) => name !== expectedNames[index])) {
  failures.push(`active migration set differs from reviewed staging baseline (expected ${expectedNames.length}, found ${activeNames.length})`)
}
for (const expected of [...manifest.appliedMigrations, ...pending]) {
  const bytes = readFileSync(path.join(migrationsDir, expected.file))
  if (bytes.length !== expected.bytes || digest('md5', bytes) !== expected.md5 || digest('sha256', bytes) !== expected.sha256) {
    failures.push(`migration differs from its reviewed source: ${expected.file}`)
  }
}
for (const expected of pending) {
  const proposal = readFileSync(path.join(root, expected.proposal))
  const canonical = readFileSync(path.join(migrationsDir, expected.file))
  if (['contract2-review-only', 'trial-delivery-review-only', 'trial-skills-review-only', 'worker-status-compatibility'].includes(expected.phase)) {
    if (!canonical.equals(proposal)) failures.push('contract-2 canonical SQL differs from tested proposal')
    continue
  }
  const header = Buffer.from('-- Canonical phase-1 forward migration: fence and exact staging-worker initial pause.\n')
  const pause = readFileSync(path.join(root, 'tooling/hq-agent-host/bootstrap/initial-staging-pause.sql'))
  const body = proposal.subarray(0, proposal.length - Buffer.byteLength('commit;\n'))
  if (!proposal.toString().endsWith('commit;\n') || !canonical.equals(Buffer.concat([header, body, pause, Buffer.from('commit;\n')]))) failures.push('pending fence differs from tested proposal')
}
const archivePath = path.join(root, 'supabase/legacy/company-hq/migrations', manifest.archivedUnapplied.file)
const archived = readFileSync(archivePath)
if (archived.length !== manifest.archivedUnapplied.bytes
  || digest('md5', archived) !== manifest.archivedUnapplied.md5
  || digest('sha256', archived) !== manifest.archivedUnapplied.sha256) {
  failures.push(`archived unapplied migration changed: ${manifest.archivedUnapplied.file}`)
}
if (activeNames.includes(manifest.archivedUnapplied.file)) failures.push('unapplied migration is present in the active migration directory')

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Staging source parity verified: ${manifest.appliedMigrations.length} applied baseline migrations; ${pending.length} pending forward migration(s); archived unapplied SQL preserved.`)
}

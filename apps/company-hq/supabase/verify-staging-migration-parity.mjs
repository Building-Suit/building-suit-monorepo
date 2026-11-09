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
const staffing = pending.filter(row => row.phase === 'staffing-approval-review-only')
const taskEvidence = pending.filter(row => row.phase === 'task-evidence-context-review-only')
const taskBrowser = pending.filter(row => row.phase === 'task-browser-review-only')
const qualificationBudget = pending.filter(row => row.phase === 'qualification-query-budget-review-only')
const publicDiscovery = pending.filter(row => row.phase === 'public-discovery-mcp-review-only')
const researchStatus = pending.filter(row => row.phase === 'public-research-status-review-only')
const evaluatorQualification = pending.filter(row => row.phase === 'evaluator-qualification-review-only')
if (evaluatorQualification.length > 1 || evaluatorQualification.some(row => row.file !== '20261108200149_hq_evaluator_qualification_status.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown evaluator qualification source')
const retailDiscovery = pending.filter(row => row.phase === 'public-retail-discovery-review-only')
const repositoryRead = pending.filter(row => row.phase === 'public-repository-read-review-only')
const repositoryCompatibility = pending.filter(row => row.phase === 'repository-worker-compatibility-review-only')
if (repositoryCompatibility.length > 1 || repositoryCompatibility.some(row => row.file !== '20261109024147_hq_repository_worker_compatibility.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'tooling/hq-agent-host/proposed-migrations/hq_repository_worker_compatibility.sql')) failures.push('unknown repository worker compatibility source')
if (repositoryRead.length > 1 || repositoryRead.some(row => row.file !== '20261108212105_hq_public_repository_read.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown public repository read source')
if (retailDiscovery.length > 1 || retailDiscovery.some(row => row.file !== '20261108200632_hq_public_retail_discovery.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown retail discovery source')
if (researchStatus.length > 1 || researchStatus.some(row => row.file !== '20261108180216_hq_public_research_trial_status.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown public research status source')
if (publicDiscovery.length > 1 || publicDiscovery.some(row => row.file !== '20261108153026_hq_public_discovery_mcp.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown public discovery MCP source')
if (qualificationBudget.length > 1 || qualificationBudget.some(row => row.file !== '20261108054818_hq_qualification_query_budget.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown qualification query budget source')
if (taskBrowser.length > 1 || taskBrowser.some(row => row.file !== '20261108041146_hq_task_browser.sql' || row.status !== 'source-only-live-approval-required')) failures.push('unknown task browser source')
if (taskEvidence.length > 1 || taskEvidence.some(row => row.file !== '20261108030332_hq_task_evidence_context.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'tooling/hq-agent-host/proposed-migrations/hq_task_evidence_context.sql')) failures.push('unknown task evidence context source')
if (staffing.length > 1 || staffing.some(row => row.file !== '20261107231929_hq_staffing_approval_workflow.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown staffing preparation source')
const trialContext = pending.filter(row => row.phase === 'trial-context-review-only')
if (trialContext.length > 1 || trialContext.some(row => row.file !== '20261107201336_hq_supervised_trial_context_packet.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial context source')
if (compatibility.length > 1 || compatibility.some(row => row.file !== '20261107133124_hq_worker_status_compatibility.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown worker compatibility source')
const phase1 = pending.filter(row => row.phase === 'admission-fence')
const trialSkills = pending.filter(row => row.phase === 'trial-skills-review-only')
if (trialSkills.length > 1 || trialSkills.some(row => row.file !== '20261107040848_hq_trial_failure_and_assigned_skills.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial skills source')
const trialDelivery = pending.filter(row => row.phase === 'trial-delivery-review-only')
if (trialDelivery.length > 1 || trialDelivery.some(row => row.file !== '20261107034418_hq_workforce_trial_delivery.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial delivery source')
const phase2 = pending.filter(row => row.phase === 'contract2-review-only')
const resume = pending.filter(row => row.phase === 'admission-resume-review-only')
if (resume.length > 1 || (resume.length && (phase2.length !== 6 || trialDelivery.length !== 1 || trialSkills.length !== 1)) || resume.some(row => row.file !== '20261107142302_hq_worker_admission_resume.sql' || row.status !== 'source-only-live-approval-required')) failures.push('unknown activation source')
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
if (pending.length !== phase1.length + phase2.length + trialDelivery.length + trialSkills.length + compatibility.length + resume.length + trialContext.length + staffing.length + taskEvidence.length + taskBrowser.length + qualificationBudget.length + publicDiscovery.length + researchStatus.length + evaluatorQualification.length + retailDiscovery.length + repositoryRead.length + repositoryCompatibility.length || ![0,6].includes(phase2.length)) failures.push('incomplete or unknown pending migration phase')
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
  if (expected.phase === 'admission-resume-review-only' || expected.phase === 'task-browser-review-only' || expected.phase === 'qualification-query-budget-review-only' || expected.phase === 'public-discovery-mcp-review-only' || expected.phase === 'public-research-status-review-only' || expected.phase === 'evaluator-qualification-review-only' || expected.phase === 'public-retail-discovery-review-only' || expected.phase === 'public-repository-read-review-only') continue
  const proposal = readFileSync(path.join(root, expected.proposal))
  const canonical = readFileSync(path.join(migrationsDir, expected.file))
  if (['contract2-review-only', 'trial-delivery-review-only', 'trial-skills-review-only', 'worker-status-compatibility', 'trial-context-review-only', 'staffing-approval-review-only', 'task-evidence-context-review-only', 'repository-worker-compatibility-review-only'].includes(expected.phase)) {
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

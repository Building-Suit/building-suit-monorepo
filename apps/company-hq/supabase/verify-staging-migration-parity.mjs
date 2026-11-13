import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const manifestPath = path.join(root, 'apps/company-hq/supabase/staging-migration-parity.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const digest = (algorithm, bytes) => createHash(algorithm).update(bytes).digest('hex')
const migrationsDir = path.join(root, 'apps/company-hq/supabase/migrations')
const activeNames = readdirSync(migrationsDir).filter(name => name.endsWith('.sql')).sort()
const pending = manifest.pendingMigrations || []
const recovered = manifest.recoveredAppliedMigrations || []
const expectedNames = [...manifest.appliedMigrations, ...pending, ...recovered].map(row => row.file).sort()
const failures = []

// Historical source recovery, not a new forward operation or a fabricated Git
// origin. Pin the observed one-statement ledger bytes independently of editable
// inventory hashes. Never query, repair, or replay the hosted ledger here.
const recoveredSource = {
  file: '20261111013758_hq_retire_meetings_and_voice_greeting.sql',
  bytes: 11060,
  md5: '6991a79261ccf83eef863251d0d11583',
  sha256: '06f92be9097abc12b585eb8ef1e51ae23b9bd3e0f343f55b7310565d66d9a8ef',
  provenance: 'apps/company-hq/supabase/recovered-migrations/20261111013758.json',
}
const recoveredProvenance = {
  schemaVersion: 1, environment: 'staging', projectRef: 'dpruoncalmwicrqhqelu',
  migrationVersion: '20261111013758', migrationName: 'hq_retire_meetings_and_voice_greeting',
  source: { type: 'hosted-migration-ledger', table: 'supabase_migrations.schema_migrations', column: 'statements', statementCount: 1, statementIndex: 1 },
  verification: { observedOn: '2026-11-11', bytes: recoveredSource.bytes, lineFeeds: 177, md5: recoveredSource.md5, sha256: recoveredSource.sha256, matchingLiveFunctionBodies: 5 },
  gitOrigin: { commit: null, status: 'not-found-in-inspected-history' },
}
if (manifest.projectRef !== recoveredProvenance.projectRef || !isDeepStrictEqual(recovered, [recoveredSource])) failures.push('unknown or altered recovered applied migration inventory')
const provenance = JSON.parse(readFileSync(path.join(root, recoveredSource.provenance), 'utf8'))
if (!isDeepStrictEqual(provenance, recoveredProvenance)) failures.push('recovered migration provenance differs from observed staging ledger evidence')

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
const resendConnection = pending.filter(row => row.phase === 'resend-connection-test')
if (resendConnection.length !== 2 || resendConnection.some(row => !['20261112213000_hq_resend_connection_test.sql','20261113070000_hq_resend_test_worker_compatibility.sql'].includes(row.file) || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown Resend connection test source')
const employeeParallelism = pending.filter(row => row.phase === 'bounded-employee-parallelism')
if (employeeParallelism.length !== 1 || employeeParallelism.some(row => row.file !== '20261112140052_hq_bounded_employee_parallelism.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown bounded employee parallelism source')
const shopSuitStaff = pending.filter(row => row.phase === 'shop-suit-staff-snapshot')
if (shopSuitStaff.length !== 1 || shopSuitStaff.some(row => row.file !== '20261113023602_hq_shop_suit_staff_snapshot.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown Shop Suit staff snapshot source')
const shopSuitWorker = pending.filter(row => row.phase === 'shop-suit-worker-compatibility')
const expectedShopSuitWorker = [
  ['20261113023924_hq_shop_suit_worker_compatibility.sql', 'approved-source-not-deployed'],
  ['20261113203337_hq_shop_suit_assistant_worker_compatibility.sql', 'source-only-live-approval-required'],
  ['20261113205600_hq_shop_product_price_worker_compatibility.sql', 'source-only-live-approval-required'],
]
if (!isDeepStrictEqual(shopSuitWorker.map(row => [row.file, row.status]), expectedShopSuitWorker)
  || shopSuitWorker.some(row => row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown Shop Suit worker compatibility source')
const retailAssignment = pending.filter(row => row.phase === 'retail-assignment-context')
if (retailAssignment.length !== 1 || retailAssignment.some(row => row.file !== '20261111033000_hq_retail_assignment_context.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown retail assignment context source')
const repositoryV2 = pending.filter(row => row.phase === 'repository-worker-compatibility-v2-review-only')
if (repositoryV2.length !== 1 || repositoryV2.some(row => row.file !== '20261111020000_hq_repository_worker_compatibility_v2.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown repository compatibility v2 source')
const repositoryRead = pending.filter(row => row.phase === 'public-repository-read-review-only')
const repositoryCompatibility = pending.filter(row => row.phase === 'repository-worker-compatibility-review-only')
const activityWebPush = pending.filter(row => row.phase === 'activity-web-push-review-only')
const trialReviewPlanCache = pending.filter(row => row.phase === 'trial-review-plan-cache-review-only')
const skillEvidencePlanReuse = pending.filter(row => row.phase === 'skill-evidence-plan-reuse-review-only')
if (skillEvidencePlanReuse.length !== 1 || skillEvidencePlanReuse.some(row => row.file !== '20261110002441_hq_skill_evidence_plan_reuse.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown skill evidence plan reuse source')
const trialReviewPlanning = pending.filter(row => row.phase === 'trial-review-planning')
if (trialReviewPlanning.length !== 1 || trialReviewPlanning.some(row => row.file !== '20261110160612_hq_trial_review_planning.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial review planning source')
const repositoryReviewPlanning = pending.filter(row => row.phase === 'repository-review-planning')
if (repositoryReviewPlanning.length !== 1 || repositoryReviewPlanning.some(row => row.file !== '20261110165424_hq_repository_review_planning.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown repository review planning source')
const statusProjection = pending.filter(row => row.phase === 'trial-status-projection')
if (statusProjection.length !== 1 || statusProjection.some(row => row.file !== '20261110140432_hq_trial_status_projection.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial status projection source')
const founderSharedAuthorization = pending.filter(row => row.phase === 'founder-shared-authorization')
if (founderSharedAuthorization.length !== 1 || founderSharedAuthorization.some(row => row.file !== '20261110140541_hq_founder_shared_authorization.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown founder authorization source')
const liveDispatch = pending.filter(row => row.phase === 'live-dispatch-activation')
const adaptiveDispatch = pending.filter(row => row.phase === 'live-dispatch-adaptive-activation')
if (adaptiveDispatch.length !== 1 || adaptiveDispatch.some(row => row.file !== '20261109182552_hq_live_dispatch_adaptive_activation.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown adaptive dispatch activation source')
if (liveDispatch.length !== 1 || liveDispatch.some(row => row.file !== '20261109150515_hq_live_dispatch_activation.sql' || row.status !== 'approved-source-not-deployed' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown live dispatch activation source')
if (trialReviewPlanCache.length > 1 || trialReviewPlanCache.some(row => row.file !== '20261109124713_hq_trial_review_plan_cache.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown trial review plan cache source')
if (activityWebPush.length > 1 || activityWebPush.some(row => row.file !== '20261109032511_hq_activity_web_push.sql' || row.status !== 'source-only-live-approval-required' || row.proposal !== 'apps/company-hq/supabase/migrations/' + row.file)) failures.push('unknown HQ activity web push source')
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
if (pending.length !== phase1.length + phase2.length + trialDelivery.length + trialSkills.length + compatibility.length + resume.length + trialContext.length + staffing.length + taskEvidence.length + taskBrowser.length + qualificationBudget.length + publicDiscovery.length + researchStatus.length + evaluatorQualification.length + retailDiscovery.length + retailAssignment.length + employeeParallelism.length + resendConnection.length + shopSuitStaff.length + shopSuitWorker.length + repositoryV2.length + repositoryRead.length + repositoryCompatibility.length + activityWebPush.length + trialReviewPlanCache.length + skillEvidencePlanReuse.length + trialReviewPlanning.length + repositoryReviewPlanning.length + statusProjection.length + founderSharedAuthorization.length + liveDispatch.length + adaptiveDispatch.length || ![0,6].includes(phase2.length)) failures.push('incomplete or unknown pending migration phase')
for (const [index,row] of phase2.entries()) {
  if (row.status !== 'source-only-live-approval-required' || row.file !== contract2Sources[index].file || row.proposal !== contract2Sources[index].proposal) failures.push('contract-2 source/order differs from reviewed proposals')
}
if (pending.map(row => row.file).join() !== pending.map(row => row.file).sort().join()) failures.push('pending migration order is not chronological')
if (new Set(expectedNames).size !== expectedNames.length) failures.push('duplicate migration inventory')
if (manifest.schemaVersion !== 1 || manifest.environment !== 'staging') failures.push('manifest identity is invalid')
if (activeNames.length !== expectedNames.length || activeNames.some((name, index) => name !== expectedNames[index])) {
  failures.push(`active migration set differs from reviewed staging baseline (expected ${expectedNames.length}, found ${activeNames.length})`)
}
for (const expected of [...manifest.appliedMigrations, ...pending, ...recovered]) {
  const bytes = readFileSync(path.join(migrationsDir, expected.file))
  if (bytes.length !== expected.bytes || digest('md5', bytes) !== expected.md5 || digest('sha256', bytes) !== expected.sha256) {
    failures.push(`migration differs from its reviewed source: ${expected.file}`)
  }
}
for (const expected of pending) {
  if (expected.phase === 'live-dispatch-adaptive-activation') {
    const canonical = readFileSync(path.join(migrationsDir, expected.file), 'utf8')
    const proposal = readFileSync(path.join(root, 'tooling/hq-agent-host/proposed-migrations/hq_live_dispatch_adaptive.sql'), 'utf8')
    const start = '-- BEGIN EXACT ADAPTIVE PROPOSAL BODY\n', end = '-- END EXACT ADAPTIVE PROPOSAL BODY\n'
    if (digest('sha256', proposal) !== 'e996f6bc9522cbedd2db50236bc6974226d1a35e9bdb1a9983133ede042d9238'
      || canonical.split(start).length !== 2 || canonical.split(end).length !== 2
      || canonical.split(start)[1]?.split(end)[0] !== proposal) failures.push('adaptive activation differs from exact reviewed proposal')
    continue
  }
  if (expected.phase === 'bounded-employee-parallelism' || expected.phase === 'shop-suit-staff-snapshot' || expected.phase === 'shop-suit-worker-compatibility' || expected.phase === 'retail-assignment-context' || expected.phase === 'repository-worker-compatibility-v2-review-only' || expected.phase === 'live-dispatch-activation' || expected.phase === 'admission-resume-review-only' || expected.phase === 'task-browser-review-only' || expected.phase === 'qualification-query-budget-review-only' || expected.phase === 'public-discovery-mcp-review-only' || expected.phase === 'public-research-status-review-only' || expected.phase === 'evaluator-qualification-review-only' || expected.phase === 'public-retail-discovery-review-only' || expected.phase === 'public-repository-read-review-only' || expected.phase === 'activity-web-push-review-only' || expected.phase === 'trial-review-plan-cache-review-only' || expected.phase === 'skill-evidence-plan-reuse-review-only' || expected.phase === 'trial-review-planning' || expected.phase === 'repository-review-planning' || expected.phase === 'trial-status-projection' || expected.phase === 'founder-shared-authorization') continue
  const proposal = readFileSync(path.join(root, expected.proposal))
  const canonical = readFileSync(path.join(migrationsDir, expected.file))
  if (['resend-connection-test', 'contract2-review-only', 'trial-delivery-review-only', 'trial-skills-review-only', 'worker-status-compatibility', 'trial-context-review-only', 'staffing-approval-review-only', 'task-evidence-context-review-only', 'repository-worker-compatibility-review-only'].includes(expected.phase)) {
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
  console.log(`Staging source parity verified: ${manifest.appliedMigrations.length} applied baseline migrations; ${pending.length} pending forward migration(s); ${recovered.length} recovered applied migration(s); archived unapplied SQL preserved.`)
}

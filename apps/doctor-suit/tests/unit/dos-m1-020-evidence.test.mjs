import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { summarizeDoctorWorkspace,doctorWorkspaceEvidenceIssues,doctorAggregateClaimIssues,doctorAggregateBrowserScope,summarizeDoctorEvidenceLog,doctorShopLaunchEvidenceIssues,doctorEvidenceInputPathAllowed,doctorShopHostnameEvidenceIssues } from '../m1-aggregate-evidence.mjs'
const head = '1'.repeat(40)
function report() { return { stats: { expected: 111,skipped: 1,unexpected: 0,flaky: 0 },suites: [{ specs: Array.from({ length: 112 },(_,n) => ({ file: 'synthetic.spec.ts',title: n===111 ? 'Shop signup, product persistence and independent Ledger sessions' : `Synthetic case ${n}`,tests: [{ expectedStatus: n===111 ? 'skipped' : 'passed',results: [{ status: n===111 ? 'skipped' : 'passed',error: { message: 'PRIVATE_PAYLOAD_SENTINEL' } }] }] })) }] } }
function packet() { return { independentAcceptance: 'pending',domainApprovalGranted: false,integration: 'not-claimed',deployment: 'not-performed',tasks: Array.from({ length: 20 },(_,n) => ({ taskId: `DOS-M1-${String(n+1).padStart(3,'0')}`,canonicalTaskSha256: 'a'.repeat(64) })) } }
test('C03 aggregate summary retains the explicit skipped backend and held n8n obligations without private errors',() => { const summary = summarizeDoctorWorkspace(report(),head);assert.deepEqual(doctorWorkspaceEvidenceIssues(summary,head),[]);assert.equal(summary.cases.filter(row => row.status==='skipped').length,1);assert.equal(summary.held[0].status,'unrun');assert.equal(JSON.stringify(summary).includes('PRIVATE_PAYLOAD_SENTINEL'),false);const log = summarizeDoctorEvidenceLog('ℹ pass 1831\nℹ skipped 23\n111 passed (3.8m)\ndos-m1-020.sql: 29 SQL assertions passed\nPRIVATE_PAYLOAD_SENTINEL');assert.equal(log.nodePass,1831);assert.equal(log.nodeSkipped,23);assert.deepEqual(log.browserPassed,[111]);assert.deepEqual(log.sqlCases,[{ task: 'DOS-M1-020',count: 29 }]);assert.equal(JSON.stringify(log).includes('PRIVATE_PAYLOAD_SENTINEL'),false);assert.equal(summarizeDoctorEvidenceLog('unavailable').nodePass,null) })
test('C03 missing cases, unexplained skips, failed cases and a wrong candidate never satisfy aggregate evidence',() => { for(const mutate of [value => { value.cases.pop() },value => { value.cases[0].status='skipped' },value => { value.cases[0].status='failed' },value => { value.stats.expected=0 },value => { value.candidateSha='2'.repeat(40) }]) { const summary = summarizeDoctorWorkspace(report(),head);mutate(summary);assert.ok(doctorWorkspaceEvidenceIssues(summary,head).length>0) } })
test('C04 automated evidence cannot approve clinical authority integration or deployment, or include M2 work',() => { assert.deepEqual(doctorAggregateClaimIssues(packet(),false),[]);for(const change of [{ independentAcceptance: 'approved' },{ domainApprovalGranted: true },{ integration: 'merged' },{ deployment: 'deployed' }])assert.ok(doctorAggregateClaimIssues({ ...packet(),...change },false).length>0);assert.ok(doctorAggregateClaimIssues(packet(),true).includes('m2-excluded')) })
test('C04 omitted, duplicated or altered task contracts cannot satisfy the twenty-task aggregate',() => { for(const mutate of [value => { value.tasks.pop() },value => { value.tasks[0].taskId=value.tasks[1].taskId },value => { value.tasks[0].canonicalTaskSha256='' }]) { const value = packet();mutate(value);assert.ok(doctorAggregateClaimIssues(value,false).includes('task-traceability')) } })

test('M1 scope covers the requested aggregate and its first stg integration, preserving ordinary browser coverage later',() => {
  assert.equal(doctorAggregateBrowserScope({ eventName: 'pull_request',prNumber: 345 }),true)
  assert.equal(doctorAggregateBrowserScope({ eventName: 'pull_request',prNumber: 366 }),false)
  assert.equal(doctorAggregateBrowserScope({ eventName: 'push',ref: 'refs/heads/stg',headHasManifest: true,parentHasManifest: false }),true)
  for(const change of [{ parentHasManifest: true },{ ref: 'refs/heads/main' },{ headHasManifest: false }])assert.equal(doctorAggregateBrowserScope({ eventName: 'push',ref: 'refs/heads/stg',headHasManifest: true,parentHasManifest: false,...change }),false)
})

test('failed or skipped Shop launch qualification blocks C03/C04 despite other green Doctor evidence',() => {
  const branch='codex/doctor-suit/milestone-contracts'
  const run={ head_sha: head,head_branch: branch,event: 'pull_request',path: '.github/workflows/shop-website-launch-disposable.yml',status: 'completed',conclusion: 'success' }
  const job={ name: 'website-launch',status: 'completed',conclusion: 'success',steps: ['Full maintained Shop regression and public website SQL matrix','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/public-changelog.config.ts','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts'].map(name => ({ name,conclusion: 'success' })) }
  assert.deepEqual(doctorShopLaunchEvidenceIssues(run,job,head,branch),[])
  for(const conclusion of ['failure','skipped','cancelled',null]) {
    assert.ok(doctorShopLaunchEvidenceIssues({ ...run,conclusion },job,head,branch).length)
    assert.ok(doctorShopLaunchEvidenceIssues(run,{ ...job,conclusion },head,branch).length)
    for(let index=0;index<3;index++)assert.ok(doctorShopLaunchEvidenceIssues(run,{ ...job,steps: job.steps.map((step,n) => n===index ? { ...step,conclusion } : step) },head,branch).length)
  }
  for(const patch of [{ head_sha: '2'.repeat(40) },{ head_branch: 'stg' },{ event: 'push' },{ path: '.github/workflows/doctor-disposable.yml' }])assert.ok(doctorShopLaunchEvidenceIssues({ ...run,...patch },job,head,branch).length)
  assert.ok(doctorShopLaunchEvidenceIssues(run,{ ...job,steps: [] },head,branch).length)
  assert.ok(doctorShopLaunchEvidenceIssues(undefined,undefined,head,branch).length)
})

test('every bound acceptance input is reviewable without allowing unrelated Shop/tooling files or traversal',() => {
  const manifest=JSON.parse(readFileSync(new URL('../../../../docs/work-packages/doctor-suit/implementation/m1-acceptance-inputs.json',import.meta.url),'utf8'))
  for(const file of Object.keys(manifest.inputHashes))assert.equal(doctorEvidenceInputPathAllowed(file),true,file)
  for(const file of ['../release-fragments/private.json','apps/doctor-suit/../../.env','/apps/doctor-suit/tests/proof.mjs','apps/shop-suit/app/composables/usePlans.ts','tooling/releases/publisher.mjs','tooling/releases/catalog-disposable.mjs/child','apps/shop-suit/tests/unit/unreviewed.test.mjs',null,{}])assert.equal(doctorEvidenceInputPathAllowed(file),false)
})

test('hostname suffix and owner qualification cannot be skipped behind green launch or Doctor results',() => {
  const branch='codex/doctor-suit/milestone-contracts'
  const run={ head_sha: head,head_branch: branch,event: 'pull_request',path: '.github/workflows/shop-website-hostname-disposable.yml',status: 'completed',conclusion: 'success' }
  const job={ name: 'website-hostnames',status: 'completed',conclusion: 'success',steps: ['ss-web-launch-001','website-hostname-suffix','website-hostname-owner'].map(name => ({ name: `Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/${name}.config.ts`,conclusion: 'success' })) }
  assert.deepEqual(doctorShopHostnameEvidenceIssues(run,job,head,branch),[])
  for(const conclusion of ['failure','skipped','cancelled',null]) {
    assert.ok(doctorShopHostnameEvidenceIssues({ ...run,conclusion },job,head,branch).length)
    assert.ok(doctorShopHostnameEvidenceIssues(run,{ ...job,conclusion },head,branch).length)
    for(let index=0;index<3;index++)assert.ok(doctorShopHostnameEvidenceIssues(run,{ ...job,steps: job.steps.map((step,n) => n===index ? { ...step,conclusion } : step) },head,branch).length)
  }
  for(const patch of [{ head_sha: '2'.repeat(40) },{ head_branch: 'stg' },{ event: 'push' },{ path: '.github/workflows/shop-website-launch-disposable.yml' }])assert.ok(doctorShopHostnameEvidenceIssues({ ...run,...patch },job,head,branch).length)
  assert.ok(doctorShopHostnameEvidenceIssues(run,{ ...job,steps: [] },head,branch).length)
  assert.ok(doctorShopHostnameEvidenceIssues(undefined,undefined,head,branch).length)
})

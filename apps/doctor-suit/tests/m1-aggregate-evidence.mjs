// Read-only exact-candidate evidence reconciliation. No merge, provider setup,
// clinical decision, Automation operation or independent human acknowledgement.
import { readFile,writeFile,mkdir,appendFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync,spawnSync } from 'node:child_process'
import path from 'node:path'
import { stripVTControlCharacters } from 'node:util'
import { fileURLToPath } from 'node:url'
import { doctorMilestoneReceiptIssues } from './milestone-evidence.mjs'
const root = fileURLToPath(new URL('../../../',import.meta.url))
const packetPath = 'docs/work-packages/doctor-suit/implementation/m1-acceptance-inputs.json'
const backendCase = 'Shop signup, product persistence and independent Ledger sessions'
const shopChangelogEvidenceFiles = new Set(['apps/shop-suit/tests/e2e/public-changelog.config.ts','apps/shop-suit/tests/e2e/public-changelog.spec.ts','apps/shop-suit/tests/e2e/public-changelog.setup.mjs','apps/shop-suit/tests/e2e/public-changelog-fixture-server.mjs','apps/shop-suit/tests/unit/public-changelog-harness.test.mjs','tooling/releases/catalog-disposable.mjs'])
export function doctorEvidenceInputPathAllowed(file) { return typeof file==='string' && !file.includes('..') && !path.isAbsolute(file) && (['apps/doctor-suit/','docs/work-packages/doctor-suit/','packages/testing/','.github/workflows/','release-fragments/'].some(prefix => file.startsWith(prefix)) || shopChangelogEvidenceFiles.has(file)) }
export function doctorAggregateBrowserScope({ eventName,prNumber,ref,headHasManifest,parentHasManifest }) { return (eventName==='pull_request' && prNumber===345) || (eventName==='push' && ref==='refs/heads/stg' && headHasManifest && !parentHasManifest) }
export function summarizeDoctorWorkspace(report,candidateSha) {
  const cases = []
  function visit(suite) { for(const spec of suite.specs || [])for(const test of spec.tests || [])cases.push({ file: spec.file || suite.file,title: spec.title,status: test.results?.at(-1)?.status || test.status,expectedStatus: test.expectedStatus });for(const child of suite.suites || [])visit(child) }
  for(const suite of report.suites || [])visit(suite)
  return { candidateSha,stats: report.stats,cases,held: [{ suite: 'atomic-automation.spec.ts',status: 'unrun',reason: 'Explicit user no-n8n constraint; no suite or gate is relabeled as passed' }] }
}
export function doctorWorkspaceEvidenceIssues(summary,head) {
  const issues = []
  if(summary?.candidateSha!==head)issues.push('workspace-candidate')
  if(summary?.stats?.expected!==111 || summary?.stats?.skipped!==1 || summary?.stats?.unexpected!==0 || summary?.stats?.flaky!==0 || summary?.cases?.length!==112)issues.push('workspace-population')
  if(summary?.cases?.some(row => row.status!=='passed' && !(row.status==='skipped' && row.title===backendCase)))issues.push('workspace-unexplained-result')
  if(summary?.cases?.filter(row => row.status==='skipped' && row.title===backendCase).length!==1)issues.push('workspace-backend-hold')
  return issues
}
export function doctorAggregateClaimIssues(packet,m2Present) {
  const issues = []
  if(packet?.independentAcceptance!=='pending' || packet?.domainApprovalGranted!==false || packet?.integration!=='not-claimed' || packet?.deployment!=='not-performed')issues.push('unsupported-claim')
  if(packet?.tasks?.length!==20 || new Set(packet.tasks.map(row => row.taskId)).size!==20 || packet.tasks.some((row,index) => row.taskId!==`DOS-M1-${String(index+1).padStart(3,'0')}` || !/^[0-9a-f]{64}$/.test(row.canonicalTaskSha256)))issues.push('task-traceability')
  if(m2Present)issues.push('m2-excluded')
  return issues
}
export function doctorShopLaunchEvidenceIssues(run,job,head,branch) {
  const issues = []
  if(run?.head_sha!==head || run?.head_branch!==branch || run?.event!=='pull_request' || run?.path!=='.github/workflows/shop-website-launch-disposable.yml' || run?.status!=='completed' || run?.conclusion!=='success')issues.push('shop-launch-workflow')
  if(job?.name!=='website-launch' || job?.status!=='completed' || job?.conclusion!=='success')issues.push('shop-launch-job')
  for(const name of ['Full maintained Shop regression and public website SQL matrix','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/public-changelog.config.ts','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts'])if(job?.steps?.find(step => step.name===name)?.conclusion!=='success')issues.push('shop-launch-required-step')
  return issues
}
export function summarizeDoctorEvidenceLog(value) {
  const text = stripVTControlCharacters(value);const last = pattern => [...text.matchAll(pattern)].at(-1)?.[1]
  return { nodePass: Number(last(/(?:ℹ|#)\s*pass\s+(\d+)/g)) || null,nodeSkipped: last(/(?:ℹ|#)\s*skipped\s+(\d+)/g)===undefined ? null : Number(last(/(?:ℹ|#)\s*skipped\s+(\d+)/g)),browserPassed: [...text.matchAll(/\b(\d+)\s+passed\s+\(/g)].map(row => Number(row[1])),sqlCases: [...text.matchAll(/dos-m1-(\d{3})\.sql:\s*(\d+)\s+SQL assertions passed/g)].map(row => ({ task: `DOS-M1-${row[1]}`,count: Number(row[2]) })),actualShopBackend: text.includes('Actual Shop backend: 1 passed'),actualCombined: text.includes('Actual M1 combined slice:'),actualFinal: text.includes('Synthetic actual-provider acceptance passed.') }
}
const git = args => execFileSync('git',args,{ cwd: root,encoding: 'utf8',stdio: ['ignore','pipe','pipe'] }).trim()
const sha256 = value => createHash('sha256').update(value).digest('hex')
async function captureWorkspace(reportFile,out,head) { await mkdir(out,{ recursive: true });const summary = summarizeDoctorWorkspace(JSON.parse(await readFile(reportFile,'utf8')),head);await writeFile(path.join(out,'workspace-summary.json'),JSON.stringify(summary,null,2)+'\n',{ mode: 0o600 });if(doctorWorkspaceEvidenceIssues(summary,head).length)throw new Error('WORKSPACE_EVIDENCE_FAILED') }
async function evaluate(out) {
  if(process.env.GITHUB_ACTIONS!=='true' || process.env.GITHUB_REPOSITORY!=='Building-Suit/building-suit-monorepo')throw new Error('INDEPENDENT_CI_CONTEXT_REQUIRED')
  await mkdir(out,{ recursive: true })
  const head = process.env.M1_HEAD_SHA;const eventBase = process.env.M1_BASE_SHA;const runId = process.env.GITHUB_RUN_ID;const token = process.env.GH_TOKEN
  const issues = [];const packet = JSON.parse(await readFile(path.join(root,packetPath),'utf8'));const base = packet.baseSha;const hashes = {}
  if(!/^[0-9a-f]{40}$/.test(head || '') || !/^[0-9a-f]{40}$/.test(base || '') || git(['rev-parse','HEAD'])!==head)issues.push('exact-candidate-binding')
  if(spawnSync('git',['merge-base','--is-ancestor',base,head],{ cwd: root }).status!==0)issues.push('staging-base-not-in-candidate')
  for(const [file,expected]of Object.entries(packet.inputHashes)) { if(!doctorEvidenceInputPathAllowed(file))throw new Error('INPUT_PATH_INVALID');const value = sha256(await readFile(path.join(root,file)));hashes[file] = value;if(value!==expected)issues.push(`input:${file}`) }
  if(git(['status','--porcelain']))issues.push('dirty-candidate')
  if(spawnSync('git',['diff','--quiet','4ca7110f4d6efa828e0b41213e5c059bf02ba9db','--','docs/work-packages/doctor-suit/planning-v0.4'],{ cwd: root }).status!==0)issues.push('planning-changed')
  for(const row of packet.tasks)if(row.sourceHead && spawnSync('git',['merge-base','--is-ancestor',row.sourceHead,head],{ cwd: root }).status!==0)issues.push(`ancestry:${row.taskId}`)
  if(git(['rev-parse','--is-shallow-repository'])!=='false')issues.push('incomplete-history')
  const ancestors = new Set(git(['rev-list',head]).split('\n'))
  for(const excluded of packet.excludedSourceHeads || [])if(!/^[0-9a-f]{40}$/.test(excluded) || ancestors.has(excluded))issues.push('excluded-source-in-history')
  issues.push(...doctorAggregateClaimIssues(packet,existsSync(path.join(root,'docs/work-packages/doctor-suit/implementation/dos-m2-001.md')) || existsSync(path.join(root,'release-fragments/dos-m2-001.json'))))
  const workspace = JSON.parse(await readFile(path.join(out,'workspace-summary.json'),'utf8'));issues.push(...doctorWorkspaceEvidenceIssues(workspace,head))
  const shopBackend = JSON.parse(await readFile(path.join(out,'shop-backend-summary.json'),'utf8'))
  if(shopBackend.candidateSha!==head || shopBackend.passed!==1 || shopBackend.skipped!==0 || !shopBackend.loopbackOnly || !shopBackend.sourceMigrationsUnchanged)issues.push('actual-shop-backend-binding')
  for(const [product,directory]of [['shop','apps/shop-suit/supabase/migrations'],['ledger','apps/ledger-suit/supabase/migrations']])for(const file of await (await import('node:fs/promises')).readdir(path.join(root,directory)))if(file.endsWith('.sql') && shopBackend.migrationHashes[`${product}/${file}`]!==sha256(await readFile(path.join(root,directory,file))))issues.push(`backend-source:${product}/${file}`)
  async function api(endpoint) { const result = await fetch(`https://api.github.com/repos/Building-Suit/building-suit-monorepo/${endpoint}`,{ headers: { Authorization: `Bearer ${token}`,Accept: 'application/vnd.github+json' },signal: AbortSignal.timeout(20000) });if(!result.ok)throw new Error('GITHUB_EVIDENCE_READ_FAILED');return result.json() }
  const run = await api(`actions/runs/${runId}`);if(run.head_sha!==head || run.head_branch!==packet.candidateRef)issues.push('workflow-head')
  const staging = await api('branches/stg');if(staging.commit.sha!==base)issues.push('staging-advanced')
  let doctorRun,shopLaunchRun;const deadline = Date.now()+480000
  while(Date.now()<deadline) {
    const [runs,shopRuns] = await Promise.all([api(`actions/workflows/doctor-disposable.yml/runs?head_sha=${head}&per_page=100`),api(`actions/workflows/shop-website-launch-disposable.yml/runs?head_sha=${head}&per_page=100`)])
    doctorRun = runs.workflow_runs.find(row => row.head_sha===head && row.head_branch==='codex/doctor-suit/milestone-contracts' && row.event==='pull_request')
    shopLaunchRun = shopRuns.workflow_runs.find(row => row.head_sha===head && row.head_branch===packet.candidateRef && row.event==='pull_request')
    if(doctorRun?.status==='completed' && shopLaunchRun?.status==='completed')break
    await new Promise(resolve => setTimeout(resolve,10000))
  }
  if(!doctorRun || doctorRun.head_sha!==head || doctorRun.conclusion!=='success')issues.push('doctor-workflow')
  const rootJobs = (await api(`actions/runs/${runId}/jobs?per_page=100`)).jobs
  const doctorJobs = doctorRun ? (await api(`actions/runs/${doctorRun.id}/jobs?per_page=100`)).jobs : []
  const shopLaunchJobs = shopLaunchRun ? (await api(`actions/runs/${shopLaunchRun.id}/jobs?per_page=100`)).jobs : []
  const shopLaunchJob = shopLaunchJobs.find(row => row.name==='website-launch')
  issues.push(...doctorShopLaunchEvidenceIssues(shopLaunchRun,shopLaunchJob,head,packet.candidateRef))
  const observed = {}
  await Promise.all([['unit',rootJobs.find(row => row.name==='review')],['workspace',rootJobs.find(row => row.name==='verify')],['shop-backend',rootJobs.find(row => row.name==='doctor-m1-shop-backend')],['shop-launch',shopLaunchJob],...doctorJobs.map(job => [job.name,job])].map(async ([name,job]) => {
    if(!job) { issues.push(`log:${name}:missing`);return }
    for(let attempt=0;attempt<3;attempt++) {
      try {
        const response = await fetch(`https://api.github.com/repos/Building-Suit/building-suit-monorepo/actions/jobs/${job.id}/logs`,{ headers: { Authorization: `Bearer ${token}` },signal: AbortSignal.timeout(20000) })
        if(!response.ok)throw new Error('LOG_UNAVAILABLE')
        const text = await response.text();if(text.length>20000000)throw new Error('LOG_LIMIT')
        observed[name] = summarizeDoctorEvidenceLog(text);return
      } catch { if(attempt<2)await new Promise(resolve => setTimeout(resolve,2000)) }
    }
    issues.push(`log:${name}:unavailable`)
  }))
  const counts = packet.expectedEvidenceCounts
  if(observed.unit?.nodePass!==counts.rootPassed || observed.unit?.nodeSkipped!==counts.rootSkipped)issues.push('root-unit-population')
  if(!observed.workspace?.browserPassed.includes(counts.workspacePassed) || !observed.workspace?.browserPassed.includes(counts.shopRegressions) || !observed.workspace?.browserPassed.includes(counts.changelogPassed))issues.push('workspace-log-population')
  if(!observed['doctor-browser']?.browserPassed.includes(counts.doctorPublic))issues.push('doctor-public-population')
  if(!observed['doctor-auth-protocol']?.browserPassed.includes(counts.doctorAuth) || !observed['doctor-auth-protocol']?.browserPassed.includes(counts.doctorStress))issues.push('doctor-auth-population')
  if(!observed['shared-settings-browser']?.browserPassed.includes(counts.sharedAuth) || !observed['shared-settings-browser']?.browserPassed.includes(counts.sharedSettings))issues.push('shared-consumer-population')
  if(observed['doctor-sql']?.sqlCases.reduce((total,row) => total+row.count,0)!==counts.sqlTotal || !observed['doctor-sql']?.sqlCases.some(row => row.task==='DOS-M1-020' && row.count===counts.sqlCombined))issues.push('sql-population')
  if(!observed['shop-backend']?.actualShopBackend || !observed['shop-backend']?.browserPassed.includes(counts.shopBackend))issues.push('actual-shop-backend-result')
  if(!observed['doctor-actual-provider']?.actualCombined || !observed['doctor-actual-provider']?.actualFinal)issues.push('actual-combined-result')
  if(!observed['shop-launch']?.browserPassed.includes(counts.changelogPassed) || !observed['shop-launch']?.browserPassed.includes(counts.shopLaunchPassed))issues.push('shop-launch-browser-population')
  const commands = []
  function command(id,jobs,jobName,stepName,argv) {
    const job = jobs.find(row => row.name===jobName);const step = job?.steps.find(row => row.name===stepName)
    commands.push({ id,argv,status: step?.conclusion==='success' ? 'passed' : step?.conclusion || 'unavailable',exitCode: step?.conclusion==='success' ? 0 : null,exitCodeSource: 'GitHub successful run-step conclusion; no continue-on-error on this command',startedAt: step?.started_at || null,finishedAt: step?.completed_at || null,immutableLog: job ? `${job.html_url}#step:${step?.number || 0}:1` : null,jobId: job?.id || null })
  }
  command('release',rootJobs,'review','Validate task release fragments',['node','tooling/releases/check.mjs'])
  command('boundary',rootJobs,'review','Run pnpm check',['pnpm','check'])
  command('unit',rootJobs,'review','Run pnpm test',['pnpm','test'])
  command('typecheck',rootJobs,'verify','Run pnpm typecheck --concurrency=2',['pnpm','typecheck','--concurrency=2'])
  command('lint',rootJobs,'verify','Run pnpm lint',['pnpm','lint'])
  command('build',rootJobs,'verify','Run pnpm build --concurrency=2',['pnpm','build','--concurrency=2'])
  command('built-assets',rootJobs,'verify','Run pnpm test:built-assets',['pnpm','test:built-assets'])
  command('workspace-browser',rootJobs,'verify','Verify permitted Doctor M1 aggregate browsers',['pnpm','exec','playwright','test','-c','packages/testing/playwright.doctor-workspace.config.ts'])
  command('shared-regressions',rootJobs,'verify','Verify shared Shop regressions for Doctor M1',['pnpm','test:e2e:shared-regressions'])
  command('public-changelog',rootJobs,'verify','Verify deployed-only Shop landing changelog discovery',['pnpm','exec','playwright','test','-c','apps/shop-suit/tests/e2e/public-changelog.config.ts'])
  command('shop-backend',rootJobs,'doctor-m1-shop-backend','Verify actual Shop signup, persistence and independent Ledger session',['node','apps/doctor-suit/tests/shop-backend-actual-provider.mjs'])
  command('shop-launch-sql',shopLaunchJobs,'website-launch','Full maintained Shop regression and public website SQL matrix',['node','tooling/database/test-shop-website-launch-local.mjs'])
  command('shop-launch-changelog',shopLaunchJobs,'website-launch','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/public-changelog.config.ts',['pnpm','exec','playwright','test','-c','apps/shop-suit/tests/e2e/public-changelog.config.ts'])
  command('shop-launch',shopLaunchJobs,'website-launch','Run pnpm exec playwright test -c apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts',['pnpm','exec','playwright','test','-c','apps/shop-suit/tests/e2e/ss-web-launch-001.config.ts'])
  command('sql',doctorJobs,'doctor-sql','Apply actual migrations and assert SQL/RLS authorization with synthetic fixtures',['node','apps/doctor-suit/tests/disposable-postgres.mjs'])
  command('doctor-public',doctorJobs,'doctor-browser','Verify synthetic Doctor preview in both locales, themes and viewport sizes',['pnpm','exec','playwright','test','-c','apps/doctor-suit/tests/e2e/playwright.config.ts'])
  command('doctor-auth',doctorJobs,'doctor-auth-protocol','Verify account protocol journeys without external mail or credential artifacts',['pnpm','exec','playwright','test','-c','apps/doctor-suit/tests/e2e/playwright.auth.config.ts'])
  command('doctor-stress',doctorJobs,'doctor-auth-protocol','Verify delegation under slower CPU and RPC timing',['pnpm','exec','playwright','test','-c','apps/doctor-suit/tests/e2e/playwright.auth.config.ts','--grep','two doctors','--repeat-each=2'])
  command('shared-auth',doctorJobs,'shared-settings-browser','Verify existing shared auth and access presentation retains default behavior',['pnpm','exec','playwright','test','-c','packages/testing/playwright.auth-parity.config.ts'])
  command('shared-settings',doctorJobs,'shared-settings-browser','Verify settings in existing consumers with local-only targets and no n8n access',['pnpm','exec','playwright','test','-c','packages/testing/playwright.settings-focus.config.ts'])
  command('actual-provider',doctorJobs,'doctor-actual-provider','Verify actual disposable Doctor Auth, Storage and Functions',['node','apps/doctor-suit/tests/disposable-provider.mjs'])
  const receipt = { shopBackend,candidateSha: head,baseSha: base,eventBaseSha: eventBase,protectedBaseSource: 'Fresh official stg branch SHA, present in the exact candidate',observed,executionId: `${runId}:${process.env.GITHUB_RUN_ATTEMPT}:doctor-m1-evidence`,verifierIdentity: 'GitHub Actions exact-candidate evidence evaluator',inputHashes: hashes,cases: { 'DOS-M1-020-C03': 'passed','DOS-M1-020-C04': 'passed' },commands,heldObligations: [...workspace.held,{ suite: 'Optional root infrastructure tests',status: 'skipped',count: observed.unit?.nodeSkipped ?? null,reason: 'Not counted as passing product coverage' },{ case: backendCase,status: 'skipped-in-ui-sweep',coverage: 'Executed separately with actual isolated backends; separate one-pass/zero-skip receipt required' }],milestoneAccepted: false,domainApprovalGranted: false,integrationClaimed: false,deploymentClaimed: false,mergeAuthorization: 'Prior PR345 merge hold remains for parent resolution' }
  issues.push(...doctorMilestoneReceiptIssues({ ...packet,headSha: head },receipt))
  if(issues.length) { receipt.cases['DOS-M1-020-C03'] = 'failed';receipt.cases['DOS-M1-020-C04'] = 'failed' }
  receipt.issues = [...new Set(issues)]
  const body = JSON.stringify(receipt,null,2)+'\n';await writeFile(path.join(out,'m1-aggregate-evidence.json'),body,{ mode: 0o600 })
  await writeFile(path.join(out,'artifact-manifest.json'),JSON.stringify({ candidateSha: head,baseSha: base,files: { 'm1-aggregate-evidence.json': sha256(body),'workspace-summary.json': sha256(await readFile(path.join(out,'workspace-summary.json'))),'shop-backend-summary.json': sha256(await readFile(path.join(out,'shop-backend-summary.json'))) } },null,2)+'\n',{ mode: 0o600 })
  console.log(`DOS-M1-020-C03: ${receipt.cases['DOS-M1-020-C03']}; DOS-M1-020-C04: ${receipt.cases['DOS-M1-020-C04']}; held obligations remain explicit; no milestone/domain/merge approval supplied`)
  if(issues.length)process.exitCode = 1
}
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  try {
    const [mode,out,report] = process.argv.slice(2)
    if(mode==='scope') {
      const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH,'utf8'));const marker = 'docs/work-packages/doctor-suit/implementation/m1-aggregate.md'
      const present = ref => spawnSync('git',['cat-file','-e',`${ref}:${marker}`],{ cwd: root,stdio: 'ignore' }).status===0
      const active = doctorAggregateBrowserScope({ eventName: process.env.GITHUB_EVENT_NAME,prNumber: event.pull_request?.number,ref: process.env.GITHUB_REF,headHasManifest: present('HEAD'),parentHasManifest: present('HEAD^1') })
      await appendFile(process.env.GITHUB_OUTPUT,`active=${active}\n`)
    } else { if(!out)throw new Error('OUTPUT_REQUIRED');if(mode==='workspace')await captureWorkspace(report,out,process.env.M1_HEAD_SHA);else if(mode==='evaluate')await evaluate(out);else throw new Error('MODE_INVALID') }
  }
  catch(error) { const known = new Set(['INPUT_PATH_INVALID','INDEPENDENT_CI_CONTEXT_REQUIRED','GITHUB_EVIDENCE_READ_FAILED','OUTPUT_REQUIRED','MODE_INVALID','WORKSPACE_EVIDENCE_FAILED']);console.error(`Doctor aggregate evidence unavailable or invalid; reason: ${known.has(error?.message) ? error.message : 'UNCLASSIFIED'}; no passing evaluation is supplied`);process.exitCode = 1 }
}

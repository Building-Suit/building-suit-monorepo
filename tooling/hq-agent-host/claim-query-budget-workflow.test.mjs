import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const workflow = readFileSync(new URL('../../.github/workflows/hq-live-dispatch-disposable.yml', import.meta.url), 'utf8')
const step = workflow.match(/ {6}- name: Prove claim query budget and concurrent freshness\n([\s\S]*?)(?= {6}- name:)/)[1]
const script = step.split('        run: |\n')[1].replace(/^ {10}/gm, '')

test('native claim checks retain the four existing jobs and run once without a host port', () => {
  assert.match(workflow, /cron-background-workers: \['on', 'off'\]/)
  assert.match(workflow, /cron-source: \['upstream-1-6-4', 'packaged'\]/)
  assert.match(step, /if: matrix.cron-source == 'upstream-1-6-4' && matrix.cron-background-workers == 'on'/)
  assert.match(workflow, /node --test tooling\/hq-agent-host\/live-dispatch-native-check.mjs/)
  assert.match(step, /--name hq-claim-budget-fixture --network hq-live-dispatch-fixture/)
  assert.match(step, /POSTGRES_DB=hq_claim_budget_disposable/)
  assert.doesNotMatch(step, /--publish|--network[= ]host|(?:^|\s)-p\s|secrets\./)
  assert.doesNotMatch(workflow, /continue-on-error/)
  assert.match(workflow, /name: Remove disposable database\n {8}if: always\(\)\n {8}run: \|\n {10}docker rm -f hq-claim-budget-fixture/)
})

test('native path filters include harness, fixture, worker modules and dependency inputs', () => {
  const paths = workflow.split('  workflow_dispatch:')[0]
  for (const input of ['tooling/hq-agent-host/*.mjs', 'tooling/hq-agent-host/test-fixtures/**',
    'tooling/hq-agent-host/bootstrap/admission-pause.sql', 'tooling/hq-agent-host/live-dispatch-native.Dockerfile',
    'apps/company-hq/supabase/migrations/**', 'package.json', 'pnpm-lock.yaml']) {
    assert.ok(paths.includes(`'${input}'`), input)
  }
})

test('a failed native assertion fails the CI shell rather than being masked by version inspection', () => {
  const stub = `
docker() {
  if [[ "$*" == *"node --test tooling/hq-agent-host/claim-query-budget-native-check.mjs"* ]]; then
    return "$FIXTURE_EXIT"
  fi
  if [[ "$*" == *"SELECT current_setting"* ]]; then printf '170011\\n'; fi
  return 0
}
timeout() { shift 3; "$@"; }
`
  for (const code of [0, 42]) {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', stub + script], {
      encoding: 'utf8', env: { ...process.env, FIXTURE_EXIT: String(code), GITHUB_WORKSPACE: '/disposable-fixture' },
    })
    assert.equal(result.status, code, result.stderr)
  }
})

test('founder race checks use a separate fixed disposable database and propagate failure',()=>{
 const founderStep=workflow.match(/ {6}- name: Prove founder authorization concurrency\n([\s\S]*?)(?= {6}- name:)/)[1]
 assert.match(founderStep,/if: matrix.cron-source == 'upstream-1-6-4' && matrix.cron-background-workers == 'on'/)
 assert.match(founderStep,/POSTGRES_DB=hq_founder_bind_disposable/)
 assert.match(founderStep,/-e HQ_FOUNDER_NATIVE=1/)
 assert.match(founderStep,/apps\/company-hq\/tests\/unit\/founder-bind-db.test.mjs/)
 assert.doesNotMatch(founderStep,/--publish|--network[= ]host|(?:^|\s)-p\s|secrets\./)
 assert.match(workflow,/docker rm -f hq-founder-bind-fixture \|\| true/)
 assert.ok(workflow.split('  workflow_dispatch:')[0].includes("'apps/company-hq/tests/unit/founder-bind-db.test.mjs'"))
 const founderScript=founderStep.split('        run: |\n')[1].replace(/^ {10}/gm,'')
 const stub=`docker(){ if [[ "$*" == *"node --test apps/company-hq/tests/unit/founder-bind-db.test.mjs"* ]]; then return "$FIXTURE_EXIT"; fi; if [[ "$*" == *"SELECT current_setting"* ]]; then printf '170011\\n'; fi; return 0; }; timeout(){ shift 3; "$@"; }\n`
 for(const code of [0,42]){
  const result=spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',stub+founderScript],{encoding:'utf8',env:{...process.env,FIXTURE_EXIT:String(code),GITHUB_WORKSPACE:'/disposable-fixture'}})
  assert.equal(result.status,code,result.stderr)
 }
})

test('trial review planning runs cold native checks in a fresh fixed database and propagates failure', () => {
  const reviewStep = workflow.match(/ {6}- name: Prove trial review planning with four cold sessions\n([\s\S]*?)(?= {6}- name:)/)[1]
  assert.match(reviewStep, /if: matrix.cron-source == 'upstream-1-6-4' && matrix.cron-background-workers == 'on'/)
  assert.match(reviewStep, /--name hq-trial-review-fixture --network hq-live-dispatch-fixture/)
  assert.match(reviewStep, /POSTGRES_DB=hq_trial_review_planning_disposable/)
  assert.match(reviewStep, /tooling\/hq-agent-host\/trial-review-planning-native-check.mjs/)
  assert.match(reviewStep, /330s docker exec/)
  assert.doesNotMatch(reviewStep, /--publish|--network[= ]host|(?:^|\s)-p\s|secrets\./)
  assert.match(workflow, /docker rm -f hq-trial-review-fixture \|\| true/)
  const reviewScript = reviewStep.split('        run: |\n')[1].replace(/^ {10}/gm, '')
  const stub = `docker(){ if [[ "$*" == *"node --test tooling/hq-agent-host/trial-review-planning-native-check.mjs"* ]]; then return "$FIXTURE_EXIT"; fi; if [[ "$*" == *"SELECT current_setting"* ]]; then printf '170011\\n'; fi; return 0; }; timeout(){ shift 3; "$@"; }\n`
  for (const code of [0, 42]) {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', stub + reviewScript], {
      encoding: 'utf8', env: { ...process.env, FIXTURE_EXIT: String(code), GITHUB_WORKSPACE: '/disposable-fixture' },
    })
    assert.equal(result.status, code, result.stderr)
  }
})

test('repository review uses an independent fixed native job and propagates assertion failure', () => {
  const job = workflow.match(/ {2}repository-review-planning:\n([\s\S]*)$/)[1]
  assert.match(job, /timeout-minutes: 15/)
  assert.match(job, /docker build --target runtime .*live-dispatch-native.Dockerfile/)
  assert.match(job, /docker network create --internal hq-repository-review-fixture/)
  assert.match(job, /--name hq-repository-review-fixture --network hq-repository-review-fixture/)
  assert.match(job, /POSTGRES_DB=hq_repository_review_planning_disposable/)
  assert.match(job, /test "\$RUNNER_ENVIRONMENT" = github-hosted/)
  assert.match(job, /if: always\(\)[\s\S]*docker rm -f hq-repository-review-fixture/)
  assert.doesNotMatch(job, /--publish|--network[= ]host|(?:^|\s)-p\s|secrets\.|continue-on-error/)
  const step = job.match(/ {6}- name: Prove repository review cold and repeated concurrency\n([\s\S]*?)(?= {6}- name:)/)[1]
  assert.match(step, /390s docker exec/)
  assert.match(step, /'170011'/)
  const script = step.split('        run: |\n')[1].replace(/^ {10}/gm, '')
  const stub = `docker(){ if [[ "$*" == *"node --test tooling/hq-agent-host/repository-review-planning-native-check.mjs"* ]]; then return "$FIXTURE_EXIT"; fi; if [[ "$*" == *"SELECT current_setting"* ]]; then printf '170011\\n'; fi; return 0; }; timeout(){ shift 3; "$@"; }\n`
  for (const code of [0, 42]) {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', stub + script], {
      encoding: 'utf8', env: { ...process.env, FIXTURE_EXIT: String(code), GITHUB_WORKSPACE: '/disposable-fixture' },
    })
    assert.equal(result.status, code, result.stderr)
  }
})

test('repository native test pins the target and retains the eight-second cap and repeated batches', () => {
  const source = readFileSync(new URL('./repository-review-planning-native-check.mjs', import.meta.url), 'utf8')
  assert.match(source, /const database = 'hq_repository_review_planning_disposable'/)
  assert.match(source, /host: '127.0.0.1', port: 5432/)
  assert.match(source, /version: '170011'/)
  assert.doesNotMatch(source, /process\.env|connectionString|DATABASE_URL/)
  assert.match(source, /Array.from\(\{ length: 4 \}/)
  assert.match(source, /connect\(`hq-repository-\$\{phase\}-\$\{i\}`, 8000\)/)
  assert.match(source, /round <= 3/)
  assert.match(source, /candidate-cold/)
  assert.match(source, /candidate-repeated/)
  assert.match(source, /repository\.qualified, true/)
})

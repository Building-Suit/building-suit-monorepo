import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { planValidation } from '../../ci/plan.mjs'
import { assertReadiness } from '../../ci/readiness.mjs'

const workflow = readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
const jobs = Object.fromEntries([...workflow.matchAll(/^ {2}([a-z-]+):\n([\s\S]*?)(?=^ {2}[a-z-]+:|$(?![\s\S]))/gm)].map(match => [match[1], match[2]]))
const expression = id => jobs[id].match(/^ {4}if: >-\n((?: {6}.*\n)+)/m)[1].trim()
const names = id => jobs[id].match(/^ {4}name: \$\{\{ (.*) \}\}/m)[1]
function evaluate(expression, github, needs = {}, cancelled = false) {
  const source = expression.replace(/(?:github|needs)(?:\.[A-Za-z_][A-Za-z_0-9-]*)+/g, path => {
    const [root, ...keys] = path.split('.')
    return root + keys.map(key => `?.[${JSON.stringify(key)}]`).join('')
  })
  return Function('github', 'needs', 'cancelled', `return (${source})`)(github, needs, () => cancelled)
}
function event(action, changes, event_name = 'pull_request', base_ref = 'stg') {
  return { event_name, base_ref, event: { action, changes, pull_request: { base: { ref: base_ref } } } }
}
function ready(kind, eventName = 'pull_request') {
  const keys = kind === 'review' ? ['plan', 'unit-review', 'hq-invariants', 'hq-browser', 'release-catalog'] : ['plan', 'review', 'static-checks', 'build', 'browser-tests', 'branch-policy']
  const needs = Object.fromEntries(keys.map(key => [key, { result: key === 'branch-policy' && eventName === 'push' ? 'skipped' : 'success' }]))
  needs.plan.outputs = { validate: 'true', full: 'true' }
  return needs
}

test('metadata edits keep distinct contexts and never cancel code validation', () => {
  for (const changes of [{ title: {} }, { body: {} }]) {
    const payload = event('edited', changes)
    assert.deepEqual(planValidation(payload.event_name, payload.event), { validate: false, full: false })
    for (const job of ['review', 'verify']) {
      assert.equal(evaluate(names(job), payload), `metadata-${job}`)
      assert.equal(evaluate(expression(job), payload), false)
    }
  }
  assert.match(workflow, /group: verify-\$\{\{ github.ref \}\}-/)
  assert.match(workflow, /'metadata' \|\| 'code'/)
  assert.match(workflow, /types: \[opened, synchronize, reopened, edited\]/)
})

test('retarget, code, ambiguous edit and protected pushes keep full validation', () => {
  for (const payload of [event('opened'), event('synchronize'), event('reopened'), event('edited'), event('edited', {base:{}}), event('edited', {title:{},base:{}}), event(undefined,undefined,'push')]) {
    assert.deepEqual(planValidation(payload.event_name, payload.event), {validate:true,full:true})
    for (const id of ['review', 'verify']) {
      assert.equal(evaluate(names(id), payload), id)
      assert.equal(evaluate(expression(id), payload), true)
      assert.equal(evaluate(expression(id), payload, {}, true), false)
    }
  }
  const child=event('synchronize',undefined,'pull_request','codex/shared/parent')
  assert.deepEqual(planValidation(child.event_name,child.event),{validate:true,full:false})
  assert.equal(evaluate(expression('verify'),child),false)
  assert.match(workflow, /push:\n {4}branches: \[stg, main\]/)
  assert.throws(()=>planValidation('workflow_run',{}),/Unsupported/)
})

test('review and verify fail closed for each missing, failed, cancelled or skipped dependency', () => {
  for (const kind of ['review','verify']) for(const eventName of ['push','pull_request']) {
    const needs=ready(kind,eventName)
    assert.equal(assertReadiness(kind,needs,eventName),true)
    for(const key of Object.keys(needs)) for(const result of ['failure','cancelled','skipped','success',undefined]) {
      if(result===needs[key].result) continue
      const changed=structuredClone(needs)
      if(result===undefined) delete changed[key]
      else changed[key].result=result
      assert.throws(()=>assertReadiness(kind,changed,eventName),/expected|planned/)
    }
    for(const output of ['false',undefined]) {
      const changed=structuredClone(needs); changed.plan.outputs.validate=output
      assert.throws(()=>assertReadiness(kind,changed,eventName),/not planned/)
    }
  }
  const needs=ready('verify');needs.plan.outputs.full='false'
  assert.throws(()=>assertReadiness('verify',needs,'pull_request'),/not planned/)
  assert.throws(()=>assertReadiness('anything',{},'push'),/Unknown/)
  assert.throws(()=>assertReadiness('verify',{},'workflow_run'),/Unknown/)
})

test('independent lanes start without waiting for review or a global validation lock',()=>{
  assert.doesNotMatch(workflow,/workspace-full-validation/)
  for(const id of ['static-checks','build']) {
    assert.match(jobs[id],/needs: \[plan, branch-policy\]/)
    const needs={plan:{outputs:{full:'true'}},'branch-policy':{result:'success'}}
    assert.equal(evaluate(expression(id),event('synchronize'),needs),true)
    assert.equal(evaluate(expression(id),event('synchronize'),needs,true),false)
    assert.equal(evaluate(expression(id),event('synchronize'),{...needs,'branch-policy':{result:'failure'}}),false)
    assert.equal(evaluate(expression(id),event(undefined,undefined,'push'),{...needs,'branch-policy':{result:'skipped'}}),true)
  }
  assert.match(jobs.review,/needs: \[plan, unit-review, hq-invariants, hq-browser, release-catalog\]/)
  assert.match(jobs.verify,/needs: \[plan, branch-policy, review, static-checks, build, browser-tests\]/)
  assert.match(jobs.verify,/name: Reject cancelled validation as readiness evidence\n {8}if: cancelled\(\)\n {8}run: exit 1/)
})

test('every old validation obligation remains, with isolated complete browser shards',()=>{
  for(const command of ['pnpm check','pnpm test','node tooling/releases/check.mjs']) assert.ok(jobs['unit-review'].includes(command))
  assert.match(jobs['hq-invariants'],/node --test --test-concurrency=2 tooling\/hq-agent-host\/\*\.test\.mjs/)
  assert.match(jobs['hq-invariants'],/python3 -m unittest discover/)
  assert.match(jobs['hq-browser'],/task-cancellation\.spec\.ts/)
  for(const script of ['catalog-disposable.mjs','catalog-postgrest-disposable.mjs']) assert.ok(jobs['release-catalog'].includes(script))
  assert.match(jobs['static-checks'],/check: \[typecheck, lint\]/)
  assert.match(jobs['static-checks'],/pnpm typecheck --concurrency=2/)
  assert.match(jobs['static-checks'],/pnpm lint/)
  assert.match(jobs.build,/pnpm build --concurrency=2/)
  assert.match(jobs.build,/pnpm test:built-assets/)
  const suites=[...jobs['browser-tests'].matchAll(/- suite: (\w+)\n {12}shard: (\d)\/(\d)/g)]
  for(const suite of ['foundation','shared','changelog']) {
    const rows=suites.filter(row=>row[1]===suite),count=Number(rows[0]?.[3])
    assert.ok(count>0); assert.equal(rows.length,count)
    assert.deepEqual(rows.map(row=>Number(row[2])).sort(),Array.from({length:count},(_,i)=>i+1))
    assert.ok(rows.every(row=>Number(row[3])===count))
  }
  for(const config of ['packages/testing/playwright.config.ts','packages/testing/playwright.shared-regressions.config.ts','apps/shop-suit/tests/e2e/public-changelog.config.ts']) assert.ok(jobs['browser-tests'].includes(config))
  assert.match(jobs['browser-tests'],/fail-fast: false/)
  assert.match(jobs['browser-tests'],/playwright test -c "\$config" --shard="\$SHARD"/)
  assert.doesNotMatch(workflow,/continue-on-error:|--pass-with-no-tests/)
})

test('build reuse is confined to this run and SHA, with publication gates unchanged',()=>{
  assert.match(jobs.build,/name: workspace-build-\$\{\{ github.sha \}\}-\$\{\{ github.run_attempt \}\}/)
  assert.match(jobs.build,/artifact-id: \$\{\{ steps.build-artifact.outputs.artifact-id \}\}/)
  assert.match(jobs.build,/uses: actions\/upload-artifact@v4\n {8}id: build-artifact/)
  assert.match(jobs['browser-tests'],/artifact-ids: \$\{\{ needs.build.outputs.artifact-id \}\}/)
  assert.match(jobs['browser-tests'],/BUILD_ARTIFACT_ID: \$\{\{ needs.build.outputs.artifact-id \}\}/)
  assert.ok(jobs['browser-tests'].includes('[[ "$BUILD_ARTIFACT_ID" =~ ^[1-9][0-9]*$ ]]'))
  assert.doesNotMatch(jobs['browser-tests'],/name: workspace-build-/)

  assert.match(jobs['browser-tests'],/merge-multiple: true/)
  assert.match(jobs['browser-tests'],/sha256sum --check workspace-build.tar.gz.sha256/)
  assert.match(jobs['browser-tests'],/test "\$\(cat \.ci-build-sha\)" = "\$VALIDATION_SHA"/)
  assert.doesNotMatch(jobs['browser-tests'],/run-id:|repository:|github-token:/)
  assert.match(jobs['publish-releases'],/needs: \[verify\]/)
  assert.match(jobs['publish-releases'],/needs.verify.result == 'success'/)
  assert.match(jobs['publish-hq-worker'],/needs: \[verify\]/)
  assert.match(jobs['publish-hq-worker'],/needs.verify.result == 'success'/)
  assert.match(jobs['publish-hq-worker'],/group: hq-worker-stg-release\n {6}cancel-in-progress: false/)
  assert.match(jobs['publish-releases'],/group: release-catalog-/)
  assert.match(jobs['publish-releases'],/cancel-in-progress: false/)
})

test('consolidated Shop qualification retains unique hostname, catalog and reminder obligations', () => {
  const launch = readFileSync(new URL('../../../.github/workflows/shop-website-launch-disposable.yml', import.meta.url), 'utf8')
  const sql = readFileSync(new URL('../../database/test-shop-website-launch-local.mjs', import.meta.url), 'utf8')
  for (const suite of ['website-slug', 'website-profile', 'website-catalog', 'website-public', 'appointment-access', 'customer-portal', 'public-booking']) {
    assert.ok(sql.includes(`test-shop-${suite}-local.mjs`), `SQL obligation: ${suite}`)
  }
  for (const config of ['website-catalog', 'website-hostname-suffix', 'website-hostname-owner', 'ss-appt-002', 'ss-appt-002-settings']) {
    assert.ok(launch.includes(`playwright test -c apps/shop-suit/tests/e2e/${config}.config.ts`), `Browser obligation: ${config}`)
  }
  assert.match(launch, /run: node tooling\/database\/test-shop-appointment-email-local\.mjs/)
  assert.match(launch, /deno check --no-config/)
  assert.match(launch, /LAUNCH_FULL_SHOP_DB: '1'/)
  assert.match(launch, /if: failure\(\) \|\| cancelled\(\)/)
})

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Lock the actual YAML trigger block, including its indentation. An exact allowlist
// fails closed on additional events, aliases, duplicate keys or changed filters.
const allowedTriggers = `on:
  workflow_run:
    workflows: [Verify workspace]
    types: [completed]
    branches: [stg, main]
  schedule:
    - cron: '37 * * * *'
  workflow_dispatch:
`
function assertSafeTriggers(source) {
  const block = source.match(/^on:\n[\s\S]*?(?=^[^\s#])/m)?.[0]
  assert.equal(block, allowedTriggers)
  assert.equal((source.match(/^on:/gm) ?? []).length, 1)
}
const workflow = readFileSync(new URL('../../.github/workflows/releases.yml', import.meta.url), 'utf8')

test('actual fallback release workflow allows only non-recursive protected-ref wake-ups', () => {
  assertSafeTriggers(workflow)
  assert.match(workflow, /^ {4}environment: \$\{\{ matrix.environment \}\}$/m)
  assert.match(workflow, /^ {6}group: release-catalog-\$\{\{ matrix.environment \}\}$/m)
  assert.match(workflow, /^ {6}cancel-in-progress: false$/m)
  assert.match(workflow, /^ {8}run: node tooling\/releases\/publisher.mjs$/m)
})

test('deployment events emitted by environment jobs cannot be reintroduced as wake-ups', () => {
  for (const event of ['deployment_status', 'deployment', 'check_run', 'status']) {
    assert.throws(() => assertSafeTriggers(workflow.replace('  schedule:', `  ${event}:\n  schedule:`)))
  }
  assert.throws(() => assertSafeTriggers(workflow.replace('branches: [stg, main]', 'branches: ["**"]')))
  assert.throws(() => assertSafeTriggers(`${workflow}\non:\n  deployment_status:\n`))
})

// Evaluate the actual checked-in job guard/matrix with GitHub-context fixtures.
// No publisher, environment API or hosted endpoint is invoked.
function targets(change={}) {
  const github={repository:'Building-Suit/building-suit-monorepo',ref:'refs/heads/stg',ref_name:'stg',event_name:'workflow_dispatch',event:{},...change}
  const condition=workflow.match(/^ {4}if: >-\n((?: {6}.*\n)+)/m)?.[1].trim()
  const matrix=workflow.match(/^ {6}matrix: \$\{\{ (.*) \}\}$/m)?.[1]
  assert.ok(condition);assert.ok(matrix)
  try {
    if(!Function('github',`return (${condition})`)(github))return []
    return Function('github','fromJSON',`return (${matrix})`)(github,JSON.parse).include
  }catch{return []}
}
const staging=[{environment:'staging',branch:'stg'}],production=[{environment:'production',branch:'main'}]
const completed=(branch='main',event='push',repository='Building-Suit/building-suit-monorepo')=>({workflow_run:{event,head_branch:branch,head_repository:{full_name:repository}}})
test('fallback admits only the environment matching its protected triggering ref',()=>{
  assert.deepEqual(targets(),staging)
  assert.deepEqual(targets({ref:'refs/heads/main',ref_name:'main'}),production)
  assert.deepEqual(targets({event_name:'schedule',ref:'refs/heads/main',ref_name:'main'}),production)
  assert.deepEqual(targets({ref:'refs/heads/feature',ref_name:'feature'}),[])
  assert.deepEqual(targets({ref:'refs/pull/1/merge'}),[])
  assert.deepEqual(targets({repository:'another/repository'}),[])
})
test('default-branch workflow_run cannot enter staging or consume PR/fork verification',()=>{
  const main={event_name:'workflow_run',ref:'refs/heads/main',ref_name:'main'}
  assert.deepEqual(targets({...main,event:completed('stg')}),[])
  assert.deepEqual(targets({...main,event:completed()}),production)
  assert.deepEqual(targets({event_name:'workflow_run',event:completed('stg')}),staging)
  assert.deepEqual(targets({...main,event:completed('main','pull_request')}),[])
  assert.deepEqual(targets({...main,event:completed('main','push','foreign/fork')}),[])
  assert.deepEqual(targets({...main,event:{}}),[])
})
test('protected pushes publish only after authoritative workspace verification',()=>{
  assert.deepEqual(targets({event_name:'push'}),[])
  const ci=readFileSync(new URL('../../.github/workflows/ci.yml',import.meta.url),'utf8')
  assert.deepEqual(new Set(ci.match(/^ {2}push:\n {4}branches: \[(.+)\]/m)[1].split(',').map(value=>value.trim())),new Set(['stg','main']))
  assert.match(ci,/publish-releases:\n {4}needs: \[verify\]\n {4}if: always\(\) && github.event_name == 'push' && needs.verify.result == 'success'/)
  assert.match(ci,/environment: \$\{\{ github.ref_name == 'stg' && 'staging' \|\| 'production' \}\}/)
})

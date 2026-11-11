import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const workflow = readFileSync(new URL('../../.github/workflows/hq-live-dispatch-disposable.yml', import.meta.url), 'utf8')
const step = workflow.match(/ {6}- name: Prove recovered migration selection, clean effects, and rollback\n([\s\S]*?)(?= {6}- name:)/)[1]
const script = step.split('        run: |\n')[1].replace(/^ {10}/gm, '')

test('historical recovery uses three fresh offline clusters and retains existing checks', () => {
  assert.match(step, /for scenario in hosted clean rollback; do/)
  assert.match(step, /container="hq-retirement-reconciliation-\$scenario"/)
  assert.match(step, /--name "\$container" --network none/)
  assert.match(step, /POSTGRES_DB=hq_retirement_reconciliation_disposable/)
  assert.match(step, /HQ_RETIREMENT_RECONCILIATION_CASE="\$scenario"/)
  assert.doesNotMatch(step, /--publish|--network[= ]host|(?:^|\s)-p\s|secrets\./)
  assert.doesNotMatch(workflow, /continue-on-error/)
  assert.match(workflow, /name: Remove repository review database\n {8}if: always\(\)/)
  assert.match(workflow, /docker rm -f hq-retirement-reconciliation-hosted hq-retirement-reconciliation-clean hq-retirement-reconciliation-rollback \|\| true/)
  for (const suite of ['live-dispatch-native-check', 'claim-query-budget-native-check', 'repository-review-planning-native-check', 'repository-worker-compatibility-v2-native-check', 'retail-assignment-context-native-check']) {
    assert.ok(workflow.includes(`${suite}.mjs`), suite)
  }
})

test('native recovery routing covers source, provenance, helper and dependency changes', () => {
  const paths = workflow.split('  workflow_dispatch:')[0]
  for (const input of ['tooling/hq-agent-host/*.mjs', 'tooling/hq-agent-host/test-fixtures/**',
    'tooling/hq-agent-host/live-dispatch-native.Dockerfile', 'apps/company-hq/supabase/migrations/**',
    'apps/company-hq/supabase/recovered-migrations/**', 'package.json', 'pnpm-lock.yaml']) {
    assert.ok(paths.includes(`'${input}'`), input)
  }
})

test('each failing native recovery scenario fails the actual CI shell', () => {
  const stub = `
docker() {
  if [[ "$*" == *"node --test tooling/hq-agent-host/retirement-reconciliation-native-check.mjs"* ]]; then
    if [[ "$*" == *"hq-retirement-reconciliation-$FAIL_CASE "* ]]; then return 42; fi
  fi
  if [[ "$*" == *"SELECT current_setting"* ]]; then printf '170011\\n'; fi
  return 0
}
timeout() { shift 3; "$@"; }
`
  for (const scenario of ['none', 'hosted', 'clean', 'rollback']) {
    const result = spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', stub + script], {
      encoding: 'utf8', env: { ...process.env, FAIL_CASE: scenario, GITHUB_WORKSPACE: '/disposable-fixture' },
    })
    assert.equal(result.status, scenario === 'none' ? 0 : 42, result.stderr)
  }
})

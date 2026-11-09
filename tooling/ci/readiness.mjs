import { pathToFileURL } from 'node:url'

export function assertReadiness(kind, needs, eventName) {
  const required = kind === 'review'
    ? ['plan', 'unit-review', 'hq-invariants', 'hq-browser', 'release-catalog']
    : kind === 'verify'
      ? ['plan', 'review', 'static-checks', 'build', 'browser-tests', 'branch-policy']
      : null
  if (!required) throw new Error('Unknown readiness gate')
  if (!['push', 'pull_request'].includes(eventName)) throw new Error('Unknown validation event')
  if (needs?.plan?.outputs?.validate !== 'true') throw new Error('Code validation was not planned')
  if (kind === 'verify' && needs.plan.outputs.full !== 'true') throw new Error('Full validation was not planned')
  for (const name of required) {
    const expected = name === 'branch-policy' && eventName === 'push' ? 'skipped' : 'success'
    if (needs[name]?.result !== expected) throw new Error(`${name}: expected ${expected}, received ${needs[name]?.result ?? 'missing'}`)
  }
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  assertReadiness(process.argv[2], JSON.parse(process.env.CI_NEEDS), process.env.GITHUB_EVENT_NAME)
  console.log(`${process.argv[2]}: every required validation lane succeeded for this run`)
}

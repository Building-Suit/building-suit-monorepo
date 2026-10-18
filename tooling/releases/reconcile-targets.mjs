import { appendFileSync, readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const targets = new Map([
  ['refs/heads/stg', { environment: 'staging', branch: 'stg' }],
  ['refs/heads/main', { environment: 'production', branch: 'main' }],
])

/** Environment admission uses the triggering workflow ref, never checkout.ref.
 * Default-branch workflow_run events cannot impersonate a stg workflow ref. */
export function reconciliationTargets({ eventName, ref, repository, event = {} }) {
  const target = targets.get(ref)
  if (!target || repository !== 'Building-Suit/building-suit-monorepo') return []
  if (eventName === 'workflow_run') {
    const run = event.workflow_run
    if (!run || run.event !== 'push' || run.conclusion !== 'success'
      || run.head_branch !== target.branch || run.head_repository?.full_name !== repository) return []
  }
  else if (!['push', 'schedule', 'workflow_dispatch'].includes(eventName)) return []
  return [{ ...target }]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const include = reconciliationTargets({
    eventName: process.env.GITHUB_EVENT_NAME,
    ref: process.env.GITHUB_REF,
    repository: process.env.GITHUB_REPOSITORY,
    event: JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')),
  })
  appendFileSync(process.env.GITHUB_OUTPUT, `enabled=${include.length > 0}\nmatrix=${JSON.stringify({ include })}\n`)
  console.log(include.length ? `Reconcile ${include[0].environment} from admitted ${include[0].branch} workflow ref` : 'No authoritative, admissible protected-ref reconciliation target')
}

import { readFileSync } from 'node:fs'
import { collectBatch, fragmentTree, git, workspaceGraph } from './fragments.mjs'
import { buildCandidate, readTree, validatePublicTaskCoverage } from './candidate.mjs'
const base = process.env.RELEASE_BASE_SHA || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/stg')
const head = process.env.RELEASE_HEAD_SHA || 'HEAD'
const taskBase = git('merge-base', base, head)
let fork = taskBase
// A promotion PR may contain pre-automation history absent from main. Never turn it into raw notes.
if (base === 'origin/main' || process.env.GITHUB_BASE_REF === 'main') {
  const { activationAnchor } = JSON.parse(readFileSync(new URL('./policy.json',import.meta.url)))
  if (git('merge-base', activationAnchor, head) !== activationAnchor) throw new Error('Promotion lacks activation ancestry')
  fork = activationAnchor
}
const fragments = collectBatch(head, fork, workspaceGraph(process.cwd()))
const inventory = JSON.parse(readTree(head, 'release-changes/items.json'))
const knownFragments = new Set(fragmentTree(head).map(({row}) => row.id))
for (const item of inventory) for (const source of item.sources ?? []) if (!knownFragments.has(source)) throw new Error('Unknown inventory provenance fragment')
const candidate = buildCandidate('origin/main', head)
const reviewed = new Set([...fragmentTree(taskBase), ...fragmentTree(base)].map(({row}) => row.id))
const supersessions = readTree(head, 'release-changes/supersessions.json')
validatePublicTaskCoverage({fragments,inventory,candidate,base:taskBase,main:'origin/main',head,reviewed,supersessions:supersessions ? JSON.parse(supersessions) : []})
console.log('Task provenance and current main-to-stg net candidate coverage, evidence and bilingual public boundaries passed')

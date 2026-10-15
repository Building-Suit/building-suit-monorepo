import { readFileSync } from 'node:fs'
import { collectBatch, git, workspaceGraph } from './fragments.mjs'
const base = process.env.RELEASE_BASE_SHA || (process.env.GITHUB_BASE_REF ? `origin/${process.env.GITHUB_BASE_REF}` : 'origin/stg')
const head = process.env.RELEASE_HEAD_SHA || 'HEAD'
let fork = git('merge-base', base, head)
// A promotion PR may contain pre-automation history absent from main. Never turn it into raw notes.
if (base === 'origin/main' || process.env.GITHUB_BASE_REF === 'main') {
  const { activationAnchor } = JSON.parse(readFileSync(new URL('./policy.json',import.meta.url)))
  if (git('merge-base', activationAnchor, head) !== activationAnchor) throw new Error('Promotion lacks activation ancestry')
  fork = activationAnchor
}
collectBatch(head, fork, workspaceGraph(process.cwd()))
console.log('Release fragment classification, translations, path coverage and public boundary checks passed')

import assert from 'node:assert/strict'
import test from 'node:test'
import { branchWarnings, checkPullRequestPolicy, parseWorktrees, repositoryFromRemote } from '../policy.mjs'

const repo = { full_name: 'Building-Suit/building-suit-monorepo' }
const pr = (number, head, base, extra = {}) => ({ number, state: 'open', head: { ref: head, repo }, base: { ref: base, repo }, ...extra })

test('one staging feature can receive both independent and stacked feature PRs', () => {
  const prs = [pr(1, 'codex/ledger/a', 'stg'), pr(2, 'codex/shop/b', 'codex/ledger/a'), pr(3, 'codex/shop/c', 'codex/shop/b')]
  for (const current of prs) assert.deepEqual(checkPullRequestPolicy(prs, current.number), [])
})
test('a second stg PR is rejected even when it belongs to another app or is draft', () => {
  const prs = [pr(1, 'codex/ledger/a', 'stg'), pr(2, 'codex/shop/b', 'stg', { draft: true })]
  assert.match(checkPullRequestPolicy(prs, 2).join(' '), /Only one PR/)
})
test('a merged parent requires repairing the child target', () => {
  const prs = [pr(1, 'codex/ledger/a', 'stg', { state: 'closed', merged_at: '2026-09-19T00:00:00Z' }), pr(2, 'codex/ledger/b', 'codex/ledger/a')]
  assert.match(checkPullRequestPolicy(prs, 2).join(' '), /parent may have merged/)
  prs[1].base.ref = 'stg'
  assert.deepEqual(checkPullRequestPolicy(prs, 2), [])
})
test('GitHub auto-retarget after a merge cannot silently create two staging PRs', () => {
  const prs = [pr(1, 'retired', 'stg', { state: 'closed' }), pr(2, 'child', 'stg'), pr(3, 'next-batch', 'stg')]
  assert.match(checkPullRequestPolicy(prs, 2).join(' '), /Only one PR/)
  prs[1].base.ref = 'next-batch'
  assert.deepEqual(checkPullRequestPolicy(prs, 2), [])
})
test('cycles and unknown/closed current PRs fail', () => {
  const prs = [pr(1, 'a', 'b'), pr(2, 'b', 'a')]
  assert.match(checkPullRequestPolicy(prs, 1).join(' '), /cycle/)
  assert.match(checkPullRequestPolicy(prs, 99).join(' '), /no longer open/)
})
test('production promotion must originate from this repository stg branch', () => {
  assert.deepEqual(checkPullRequestPolicy([pr(1, 'stg', 'main')], 1), [])
  assert.match(checkPullRequestPolicy([pr(1, 'feature', 'main')], 1).join(' '), /Only the repository stg/)
  const foreign = pr(1, 'stg', 'main')
  foreign.head.repo = { full_name: 'elsewhere/fork' }
  assert.match(checkPullRequestPolicy([foreign], 1).join(' '), /Only the repository stg/)
})
test('worktree parsing retains spaces, locked and detached state', () => {
  assert.deepEqual(parseWorktrees('worktree /tmp/a b\0HEAD abc\0branch refs/heads/feature\0\0worktree /tmp/c\0HEAD def\0detached\0locked busy\0\0'), [
    { path: '/tmp/a b', head: 'abc', branch: 'feature', locked: false, prunable: false },
    { path: '/tmp/c', head: 'def', branch: null, locked: 'busy', prunable: false },
  ])
})
test('GitHub merged state retires a branch even after squash merging with different SHAs', () => {
  const warnings = branchWarnings({ branch: 'feature', latestPr: { number: 1, state: 'closed', merged_at: 'now' }, remoteMissing: true })
  assert.match(warnings.join(' '), /was merged/)
  assert.match(warnings.join(' '), /never recreate/)
})
test('manual remote commits and protected-base checkouts are reported', () => {
  assert.match(branchWarnings({ branch: 'feature', behind: 2 }).join(' '), /behind its upstream by 2/)
  assert.match(branchWarnings({ branch: 'stg' }).join(' '), /do not commit directly/)
  assert.match(branchWarnings({ branch: null }).join(' '), /Detached HEAD/)
  const promoted = branchWarnings({ branch: 'stg', latestPr: { number: 4, state: 'closed', merged_at: 'now' } })
  assert.doesNotMatch(promoted.join(' '), /Retire/)
})
test('origin parsing supports GitHub remotes and rejects embedded credentials or other hosts', () => {
  assert.equal(repositoryFromRemote('https://github.com/Building-Suit/building-suit-monorepo.git'), repo.full_name)
  assert.equal(repositoryFromRemote('git@github.com:Building-Suit/building-suit-monorepo.git'), repo.full_name)
  assert.throws(() => repositoryFromRemote('https://token@github.com/owner/repo.git'))
  assert.throws(() => repositoryFromRemote('https://other.example/owner/repo'))
})

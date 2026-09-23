import assert from 'node:assert/strict'
import test from 'node:test'
import { branchWarnings, checkPullRequestPolicy, parseWorktrees, repositoryFromRemote, stackKey } from '../policy.mjs'

const repo = { full_name: 'Building-Suit/building-suit-monorepo' }
const pr = (number, head, base, extra = {}) => ({ number, state: 'open', head: { ref: head, repo }, base: { ref: base, repo }, ...extra })

test('independent app roots may coexist and stack keys come from branch names', () => {
  const prs = [pr(1, 'codex/ledger-suit/a', 'stg'), pr(2, 'codex/shop-suit/b', 'stg')]
  for (const current of prs) assert.deepEqual(checkPullRequestPolicy(prs, current.number), [])
  assert.equal(stackKey('codex/shop-suit/catalog'), 'shop-suit')
  assert.equal(stackKey('shop-suit/catalog'), null)
})
test('duplicate shop and ledger roots are rejected independently, including drafts', () => {
  const shop = [pr(1, 'codex/shop-suit/a', 'stg'), pr(2, 'codex/shop-suit/b', 'stg', { draft: true })]
  const ledger = [pr(3, 'codex/ledger-suit/a', 'stg'), pr(4, 'codex/ledger-suit/b', 'stg')]
  assert.match(checkPullRequestPolicy(shop, 2).join(' '), /one active stg root.*shop-suit/i)
  assert.match(checkPullRequestPolicy(ledger, 4).join(' '), /one active stg root.*ledger-suit/i)
})
test('valid shop and ledger child chains remain within their own stack', () => {
  const prs = [
    pr(1, 'codex/shop-suit/root', 'stg'),
    pr(2, 'codex/shop-suit/child', 'codex/shop-suit/root'),
    pr(3, 'codex/ledger-suit/root', 'stg'),
    pr(4, 'codex/ledger-suit/child', 'codex/ledger-suit/root'),
  ]
  assert.deepEqual(checkPullRequestPolicy(prs, 2), [])
  assert.deepEqual(checkPullRequestPolicy(prs, 4), [])
})
test('cross-stack parenting is rejected in both directions', () => {
  const shopOnLedger = [pr(1, 'codex/ledger-suit/root', 'stg'), pr(2, 'codex/shop-suit/child', 'codex/ledger-suit/root')]
  const ledgerOnShop = [pr(3, 'codex/shop-suit/root', 'stg'), pr(4, 'codex/ledger-suit/child', 'codex/shop-suit/root')]
  assert.match(checkPullRequestPolicy(shopOnLedger, 2).join(' '), /Cross-stack parent/)
  assert.match(checkPullRequestPolicy(ledgerOnShop, 4).join(' '), /Cross-stack parent/)
})
test('a merged parent requires repairing the child target', () => {
  const prs = [pr(1, 'codex/ledger-suit/a', 'stg', { state: 'closed', merged_at: '2026-09-19T00:00:00Z' }), pr(2, 'codex/ledger-suit/b', 'codex/ledger-suit/a')]
  assert.match(checkPullRequestPolicy(prs, 2).join(' '), /parent may have merged/)
  prs[1].base.ref = 'stg'
  assert.deepEqual(checkPullRequestPolicy(prs, 2), [])
})
test('GitHub auto-retarget after a merge cannot silently create duplicate same-stack roots', () => {
  const prs = [pr(1, 'codex/shop-suit/retired', 'stg', { state: 'closed' }), pr(2, 'codex/shop-suit/child', 'stg'), pr(3, 'codex/shop-suit/next', 'stg')]
  assert.match(checkPullRequestPolicy(prs, 2).join(' '), /one active stg root/i)
  prs[1].base.ref = 'codex/shop-suit/next'
  assert.deepEqual(checkPullRequestPolicy(prs, 2), [])
})
test('cycles and unknown/closed current PRs fail', () => {
  const prs = [pr(1, 'codex/shop-suit/a', 'codex/shop-suit/b'), pr(2, 'codex/shop-suit/b', 'codex/shop-suit/a')]
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
test('feature stacks require canonical branch names and same-repository branches', () => {
  assert.match(checkPullRequestPolicy([pr(1, 'feature', 'stg')], 1).join(' '), /codex\/<stack>\/<feature>/)
  const foreign = pr(1, 'codex/shop-suit/a', 'stg')
  foreign.head.repo = { full_name: 'elsewhere/fork' }
  assert.match(checkPullRequestPolicy([foreign], 1).join(' '), /fork-based/)
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

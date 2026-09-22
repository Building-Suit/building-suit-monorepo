import { resolve } from 'node:path'
import { api, briefPr, git, latestBranchPr, openPullRequests, repository, run } from './github.mjs'
import { branchWarnings, checkPullRequestPolicy, parseWorktrees } from './policy.mjs'

try {
  const repo = repository()
  // Fetch updates remote-tracking refs only. Never pull, stash, reset, rebase or delete user work.
  git(['fetch', 'origin', '--prune'])
  const root = git(['rev-parse', '--show-toplevel'])
  const prs = openPullRequests(repo)
  const errors = checkPullRequestPolicy(prs)
  const worktrees = []
  for (const tree of parseWorktrees(git(['worktree', 'list', '--porcelain', '-z']))) {
    if (tree.prunable) { worktrees.push({ ...tree, warnings: ['Prunable worktree; inspect before any cleanup.'] }); continue }
    const upstream = tree.branch ? git(['for-each-ref', '--format=%(upstream:short)', `refs/heads/${tree.branch}`]) : ''
    let counts = null
    let remoteMissing = false
    if (upstream) {
      try { counts = git(['rev-list', '--left-right', '--count', `HEAD...${upstream}`], tree.path).split(/\s+/).map(Number) }
      catch { remoteMissing = true }
    }
    const latestPr = tree.branch ? latestBranchPr(repo, tree.branch) : null
    const warnings = branchWarnings({ branch: tree.branch, latestPr, behind: counts?.[1] ?? 0, remoteMissing })
    if (resolve(tree.path) === resolve(root) && !['main', 'stg'].includes(tree.branch) && latestPr?.state === 'closed') errors.push(...warnings)
    if (resolve(tree.path) === resolve(root) && counts?.[1] > 0) errors.push('Current branch has upstream commits not present locally; reconcile before editing or publishing.')
    if (resolve(tree.path) === resolve(root) && remoteMissing) errors.push('Current upstream is missing; verify its GitHub merge/closure state before publishing.')
    if (latestPr?.state === 'open') {
      const policyErrors = checkPullRequestPolicy(prs, latestPr.number)
      warnings.push(...policyErrors)
      if (resolve(tree.path) === resolve(root)) errors.push(...policyErrors)
    }
    worktrees.push({ ...tree, upstream: upstream || null, ahead: counts?.[0], behind: counts?.[1], changes: git(['status', '--short'], tree.path).split('\n').filter(Boolean), recentCommits: git(['log', '-3', '--format=%h %s'], tree.path).split('\n'), latestPr: latestPr ? briefPr(latestPr) : null, warnings })
  }
  const stgSha = git(['rev-parse', 'origin/stg'])
  const status = api(`repos/${repo}/commits/${stgSha}/status`)
  const checks = api(`repos/${repo}/commits/${stgSha}/check-runs?per_page=100`)
  const merged = JSON.parse(run('gh', ['pr', 'list', '--repo', repo, '--state', 'merged', '--base', 'stg', '--limit', '10', '--json', 'number,title,mergedAt,mergeCommit,url']))
  console.log(JSON.stringify({ observedAt: new Date().toISOString(), repository: repo, currentWorktree: root, stgSha, worktrees, openPrs: prs.map(briefPr), recentStagingMerges: merged, stagingChecks: { state: status.state, statuses: status.statuses.map(s => ({ context: s.context, state: s.state, url: s.target_url })), checks: checks.check_runs.map(c => ({ name: c.name, status: c.status, conclusion: c.conclusion, url: c.html_url })) }, errors: [...new Set(errors)], note: 'This is a current observation, not a reservation. Re-run before pushing, creating/retargeting a PR, or merging. Provider deployment state may require its dashboard.' }, null, 2))
  if (errors.length) process.exitCode = 1
}
catch (error) {
  // Do not echo HTTP credentials, environment variables or entire failed subprocess output.
  console.error(`Preflight failed (${error.code ?? error.status ?? error.name}). GitHub/fetch state is not verified. Inspect git/gh access before publishing; do not assume the local base is current.`)
  process.exitCode = 1
}

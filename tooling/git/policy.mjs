export function repositoryFromRemote(remote) {
  const match = remote.trim().match(/^(?:https:\/\/github\.com\/|git@github\.com:)([\w.-]+\/[\w.-]+?)(?:\.git)?$/)
  if (!match) throw new Error('origin must be an explicit GitHub HTTPS or SSH repository; inspect it before continuing.')
  return match[1]
}

export function parseWorktrees(output) {
  return output.split('\0\0').filter(Boolean).map((entry) => {
    const fields = Object.fromEntries(entry.split('\0').filter(Boolean).map((line) => {
      const separator = line.indexOf(' ')
      return separator < 0 ? [line, true] : [line.slice(0, separator), line.slice(separator + 1)]
    }))
    return { path: fields.worktree, head: fields.HEAD, branch: fields.branch?.replace(/^refs\/heads\//, '') ?? null, locked: fields.locked ?? false, prunable: fields.prunable ?? false }
  })
}

export function stackKey(branch) {
  return branch?.match(/^codex\/([^/]+)\/.+/)?.[1] ?? null
}

export function checkPullRequestPolicy(prs, currentNumber) {
  const open = prs.filter(pr => pr.state === 'open')
  const staging = open.filter(pr => pr.base.ref === 'stg')
  const errors = []
  const rootsByStack = new Map()
  for (const root of staging) {
    const key = stackKey(root.head.ref)
    if (!key) {
      errors.push(`PR #${root.number} targets stg but its head branch must match codex/<stack>/<feature>.`)
      continue
    }
    const repository = root.base.repo?.full_name
    if (root.head.repo?.full_name !== repository) {
      errors.push(`PR #${root.number} must use a branch in ${repository}; fork-based feature stacks are not supported.`)
      continue
    }
    const identity = `${repository}:${key}`
    const roots = rootsByStack.get(identity) ?? []
    roots.push(root)
    rootsByStack.set(identity, roots)
  }
  for (const roots of rootsByStack.values()) {
    if (roots.length > 1) {
      errors.push(`Only one active stg root is allowed for stack "${stackKey(roots[0].head.ref)}"; found ${roots.map(pr => `#${pr.number}`).join(', ')}. Retarget the newer PR to the open same-stack leaf.`)
    }
  }
  if (currentNumber === undefined) return errors
  const current = open.find(pr => pr.number === currentNumber)
  if (!current) return [...errors, `PR #${currentNumber} is no longer open. Fetch GitHub state before continuing.`]
  // Production promotion has a distinct lifetime from app/shared feature stacks.
  if (current.base.ref === 'main') {
    if (current.head.ref !== 'stg' || current.head.repo?.full_name !== current.base.repo?.full_name) errors.push('Only the repository stg branch may open a promotion PR into main.')
    return errors
  }
  const currentStack = stackKey(current.head.ref)
  if (!currentStack) return [...errors, `PR #${current.number} head branch must match codex/<stack>/<feature>.`]
  if (current.head.repo?.full_name !== current.base.repo?.full_name) return [...errors, `PR #${current.number} must use a branch in ${current.base.repo?.full_name}; fork-based feature stacks are not supported.`]
  const seen = new Set()
  let node = current
  while (node.base.ref !== 'stg') {
    if (seen.has(node.number)) return [...errors, 'The PR stack contains a cycle. Repair its bases before publishing.']
    seen.add(node.number)
    const parents = open.filter(pr => pr.head.ref === node.base.ref && pr.head.repo?.full_name === node.base.repo?.full_name)
    if (parents.length !== 1) return [...errors, `PR #${node.number} must target an open parent PR branch in stack "${currentStack}" or stg. Its parent may have merged/closed; refresh and retarget without replaying merged commits.`]
    const parent = parents[0]
    const parentStack = stackKey(parent.head.ref)
    if (parentStack !== currentStack) return [...errors, `Cross-stack parent is not allowed: PR #${node.number} belongs to stack "${currentStack}" but targets PR #${parent.number} in stack "${parentStack ?? 'invalid'}".`]
    node = parent
  }
  return errors
}

export function branchWarnings({ branch, latestPr, behind = 0, remoteMissing = false }) {
  const warnings = []
  if (!branch) warnings.push('Detached HEAD: choose a named feature worktree before editing.')
  if (branch === 'main' || branch === 'stg') warnings.push('Protected development base: create/reuse a feature worktree before editing; do not commit directly here.')
  if (!['main', 'stg'].includes(branch) && latestPr?.state === 'closed') warnings.push(`PR #${latestPr.number} was ${latestPr.merged_at ? 'merged' : 'closed'}. Retire this branch; preserve and move any genuinely unmerged work to a fresh branch.`)
  if (behind > 0) warnings.push(`Local branch is behind its upstream by ${behind} commit(s). Review and fast-forward a clean worktree, or merge safely if it diverged.`)
  if (remoteMissing) warnings.push('The tracked remote branch is gone. Check GitHub merge/closure state; never recreate it by pushing blindly.')
  return warnings
}

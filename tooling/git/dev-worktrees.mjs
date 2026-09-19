import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { stat } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { parseWorktrees, repositoryFromRemote } from './policy.mjs'

const exec = promisify(execFile)
export async function command(program, args, cwd) {
  const { stdout } = await exec(program, args, { cwd, encoding: 'utf8', timeout: 30000, maxBuffer: 8 * 1024 * 1024 })
  return stdout.trimEnd()
}
const git = (args, cwd) => command('git', args, cwd)
const paths = value => value.split('\0').filter(Boolean)
export const applications = {
  ledger: { directory: 'ledger-suit', package: '@building-suit/ledger-suit', port: 3000 },
  shop: { directory: 'shop-suit', package: '@building-suit/shop-suit', port: 3001 },
  docs: { directory: 'building-suit-docs', package: '@building-suit/docs', port: 3002 },
}
export function relevantPath(file, app) {
  return file.startsWith(`apps/${app.directory}/`) || file.startsWith('packages/') ||
    (app.directory === 'building-suit-docs' && (file.startsWith('docs/') || ['README.md', 'AGENTS.md'].includes(file)))
}
export function selectWorktree(trees, current, { currentOnly = false, worktree } = {}) {
  if (currentOnly && worktree) throw new Error('Choose either --current or --worktree.')
  if (currentOnly) return trees.find(t => resolve(t.path) === resolve(current))
  if (worktree) {
    const selected = trees.find(t => t.branch === worktree || resolve(t.path) === resolve(current, worktree))
    if (!selected || selected.prunable) throw new Error('--worktree must name an existing registered branch or worktree path.')
    return selected
  }
  return trees.filter(t => t.active && t.relevant).sort((a, b) =>
    b.activity - a.activity || b.depth - a.depth || b.branchTime - a.branchTime || a.path.localeCompare(b.path),
  )[0] ?? trees[0]
}

// The injectable lookup is only for isolated Git tests. Normal auto mode always refreshes GitHub.
export async function inspectWorktrees(cwd, app, { refresh = true, lookupPr } = {}) {
  const current = await git(['rev-parse', '--show-toplevel'], cwd)
  const trees = parseWorktrees(await git(['worktree', 'list', '--porcelain', '-z'], current))
  // With no other possible feature worktree, there is no selection to verify online.
  if (!trees.some(tree => tree.path !== trees[0].path && tree.branch && !tree.prunable && !['main', 'stg'].includes(tree.branch))) {
    return { current, trees }
  }
  if (refresh) {
    try {
      await git(['fetch', 'origin', '--prune'], current)
      const repo = repositoryFromRemote(await git(['remote', 'get-url', 'origin'], current))
      lookupPr = async branch => {
        const head = encodeURIComponent(`${repo.split('/')[0]}:${branch}`)
        const results = JSON.parse(await command('gh', ['api', `repos/${repo}/pulls?state=all&head=${head}&sort=created&direction=desc&per_page=100`], current))
        return results.find(pr => pr.head.repo?.full_name === repo) ?? null
      }
    }
    catch { throw new Error('Could not refresh origin/GitHub. Use --current or --worktree <branch/path> for an explicit offline checkout; auto selection needs verified state.') }
  }
  const scopes = [`apps/${app.directory}`, 'packages', ...(app.directory === 'building-suit-docs' ? ['docs', 'README.md', 'AGENTS.md'] : [])]
  await Promise.all(trees.map(async tree => {
    tree.active = false
    if (tree.prunable) { tree.reason = 'prunable'; return }
    if (!tree.branch) { tree.reason = 'detached'; return }
    if (['main', 'stg'].includes(tree.branch)) { tree.reason = 'base checkout'; return }
    let pr
    try { pr = await lookupPr?.(tree.branch) }
    catch { throw new Error('Could not verify worktree PR state. Use --current or --worktree <branch/path> for an explicit offline checkout.') }
    if (pr?.state === 'closed' || pr?.merged_at) { tree.reason = pr.merged_at ? 'merged PR' : 'closed PR'; return }
    tree.active = true
    const changed = paths(await git(['diff', '--name-only', '-z', 'origin/stg...HEAD', '--', ...scopes], tree.path))
    const dirty = [...new Set([
      ...paths(await git(['diff', '--name-only', '-z', 'HEAD'], tree.path)),
      ...paths(await git(['ls-files', '--others', '--exclude-standard', '-z'], tree.path)),
    ])].filter(file => relevantPath(file, app))
    tree.relevant = changed.length > 0 || dirty.length > 0
    tree.dirty = dirty.length
    tree.activity = Number(await git(['log', '-1', '--format=%ct', '--', ...scopes], tree.path) || 0) * 1000
    const index = await git(['rev-parse', '--path-format=absolute', '--git-path', 'index'], tree.path)
    for (const file of dirty) {
      const info = await stat(join(tree.path, file)).catch(() => stat(index))
      tree.activity = Math.max(tree.activity, info.mtimeMs)
    }
    tree.branchTime = Number((await git(['reflog', 'show', '-1', '--format=%ct', tree.branch], tree.path)) || 0)
    tree.reason = tree.relevant ? (dirty.length ? 'includes local edits' : 'committed app/shared changes') : 'no changes for this app'
    tree.depth = 0
  }))
  for (const child of trees.filter(t => t.active && t.relevant)) {
    for (const parent of trees.filter(t => t.active && t.relevant && t.head !== child.head)) {
      try { await git(['merge-base', '--is-ancestor', parent.head, child.head], current); child.depth++ }
      catch (error) { if (error.code !== 1) throw error }
    }
  }
  return { current, trees }
}

export async function explicitWorktrees(cwd) {
  const current = await git(['rev-parse', '--show-toplevel'], cwd)
  return { current, trees: parseWorktrees(await git(['worktree', 'list', '--porcelain', '-z'], current)) }
}

import { execFileSync } from 'node:child_process'
import { repositoryFromRemote } from './policy.mjs'

export function run(command, args, cwd = process.cwd()) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}
export function git(args, cwd) { return run('git', args, cwd) }
export function repository() { return repositoryFromRemote(git(['remote', 'get-url', 'origin'])) }
export function api(path) { return JSON.parse(run('gh', ['api', path])) }
export function openPullRequests(repo) {
  // Emit one JSON object per line across pages; works with older gh versions
  // that support pagination but not --slurp. Never truncate to the first page.
  return parsePullRequestLines(run('gh', ['api', '--paginate', `repos/${repo}/pulls?state=open&per_page=100`, '--jq', '.[] | @json']))
}
export function parsePullRequestLines(output) {
  return output.split(/\r?\n/).filter(line => line.trim()).map(line => {
    const pr = JSON.parse(line)
    if (!Number.isInteger(pr?.number) || !pr.head?.ref || !pr.base?.ref) throw new Error('invalid_paginated_pull_request')
    return pr
  })
}
export function latestBranchPr(repo, branch) {
  const owner = repo.split('/')[0]
  const prs = api(`repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&sort=created&direction=desc&per_page=100`)
  return prs.find(pr => pr.head.repo?.full_name === repo) ?? null
}
export function briefPr(pr) {
  return { number: pr.number, title: pr.title, state: pr.merged_at ? 'merged' : pr.state, head: pr.head.ref, base: pr.base.ref, sha: pr.head.sha, url: pr.html_url }
}

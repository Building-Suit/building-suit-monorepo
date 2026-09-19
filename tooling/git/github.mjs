import { execFileSync } from 'node:child_process'
import { repositoryFromRemote } from './policy.mjs'

export function run(command, args, cwd = process.cwd()) {
  return execFileSync(command, args, { cwd, encoding: 'utf8', timeout: 45000, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
}
export function git(args, cwd) { return run('git', args, cwd) }
export function repository() { return repositoryFromRemote(git(['remote', 'get-url', 'origin'])) }
export function api(path) { return JSON.parse(run('gh', ['api', path])) }
export function openPullRequests(repo) {
  return JSON.parse(run('gh', ['api', '--paginate', '--slurp', `repos/${repo}/pulls?state=open&per_page=100`])).flat()
}
export function latestBranchPr(repo, branch) {
  const owner = repo.split('/')[0]
  const prs = api(`repos/${repo}/pulls?state=all&head=${encodeURIComponent(`${owner}:${branch}`)}&sort=created&direction=desc&per_page=100`)
  return prs.find(pr => pr.head.repo?.full_name === repo) ?? null
}
export function briefPr(pr) {
  return { number: pr.number, title: pr.title, state: pr.merged_at ? 'merged' : pr.state, head: pr.head.ref, base: pr.base.ref, sha: pr.head.sha, url: pr.html_url }
}

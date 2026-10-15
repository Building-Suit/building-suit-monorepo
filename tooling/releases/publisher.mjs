import { execFileSync } from 'node:child_process'
import { canonical, collectBatch, fragmentTree, git, workspaceGraph } from './fragments.mjs'

export function assertReady({ contexts, required, checks }) {
  if (!Array.isArray(required) || !required.length || required.some(name => typeof name !== 'string' || !name.trim())) throw new Error('Deployment readiness configuration required')
  for (const name of required) {
    const status = contexts.find(row => row.context === name)
    const check = checks.find(row => row.name === name)
    if (!(status?.state === 'success' || (!status && check?.conclusion === 'success' && check?.status === 'completed'))) throw new Error(`Deployment not ready: ${name}`)
  }
}
export function requiredContexts(config, releases) {
  if (!config || !Array.isArray(config.common) || !config.common.includes('verify')) throw new Error('Full verify must be a release gate')
  const contexts = new Set(config.common)
  for (const suit of new Set(releases.flatMap(row => Object.keys(row.manifest.versions)))) {
    const gates = config.suits?.[suit]
    if (!Array.isArray(gates) || !gates.length || gates.some(gate => typeof gate !== 'string' || !gate.trim() || gate === 'verify')) throw new Error(`Product deployment gates required: ${suit}`)
    gates.forEach(gate => contexts.add(gate))
  }
  return [...contexts]
}
export function selectPromotion(releases, mainFragments, ancestor) {
  const eligible = releases.filter(row => ancestor(row.manifest.sourceSha))
  const consumed = new Map()
  for (const row of eligible) {
    if (!row.publishedAt) throw new Error('Staging release is not published')
    for (const fragment of row.manifest.fragments) consumed.set(fragment.id, fragment)
  }
  for (const fragment of mainFragments) {
    if (!consumed.has(fragment.id) || canonical(consumed.get(fragment.id)) !== canonical(fragment)) throw new Error('Missing exact staging provenance; hotfixes must pass stg first')
  }
  return eligible
}
export function assertBinding(url, projectRef) {
  if (!projectRef || !/^[a-z]{20}$/.test(projectRef) || url !== `https://${projectRef}.supabase.co`) throw new Error('Verified catalog environment binding required')
}
function ancestor(sha, tip) {
  try { execFileSync('git', ['merge-base', '--is-ancestor', sha, tip], { stdio: 'ignore' }); return true } catch { return false }
}
export function createCatalog(url, token, projectRef) {
  assertBinding(url, projectRef)
  if (!token) throw new Error('Server publishing credential required')
  return async (name, args = {}) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { apikey: token, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) })
    if (!response.ok) throw new Error(`Catalog operation ${name} rejected (HTTP ${response.status}); payload and credentials omitted`)
    return response.json()
  }
}
async function github(path) {
  const response = await fetch(`https://api.github.com/repos/Building-Suit/building-suit-monorepo/${path}`, { redirect: 'error',
    headers: { authorization: `Bearer ${process.env.GH_TOKEN}`, accept: 'application/vnd.github+json' } })
  if (!response.ok) throw new Error(`GitHub readiness query rejected: ${response.status}`)
  return response.json()
}
export async function runPublisher() {
  const environment = process.env.RELEASE_ENVIRONMENT
  const branch = environment === 'staging' ? 'stg' : environment === 'production' ? 'main' : null
  if (!branch || process.env.GITHUB_REPOSITORY !== 'Building-Suit/building-suit-monorepo') throw new Error('Wrong environment/repository')
  git('fetch', 'origin', 'stg', 'main')
  const tip = git('rev-parse', `origin/${branch}`)
  if (git('rev-parse', 'HEAD') !== tip) throw new Error('Stale run; later run reconciles pending history')
  const map = JSON.parse(await (await import('node:fs/promises')).readFile('docs/architecture/environments.json','utf8'))
  const refs = map.products['super-admin-suit']
  const catalog = createCatalog(process.env.RELEASE_CATALOG_URL, process.env.RELEASE_CATALOG_TOKEN, refs[environment].projectRef)
  let state = await catalog('release_catalog_state')
  if (state.environment !== environment || !ancestor(state.anchorSha, tip)) throw new Error('Wrong catalog environment/anchor')
  const policy = JSON.parse(await (await import('node:fs/promises')).readFile('tooling/releases/policy.json','utf8'))
  if (state.anchorSha !== policy.activationAnchor) throw new Error('Catalog anchor differs from reviewed activation boundary')
  const graph = workspaceGraph(process.cwd())
  let releases
  if (environment === 'staging') {
    if (!ancestor(state.cursorSha, tip)) throw new Error('Out-of-order ref or rollback: cursor is not an ancestor; no versions recycled')
    const commits = git('rev-list', '--first-parent', '--reverse', `${state.cursorSha}..${tip}`).split('\n').filter(Boolean)
    let parent = state.cursorSha
    for (const sha of commits) {
      if (git('rev-parse', `${sha}^1`) !== parent) throw new Error('Nonlinear staging provenance')
      const fragments = collectBatch(sha, parent, graph)
      await catalog('release_stage_accept', { p_request: { repository: process.env.GITHUB_REPOSITORY, ref: 'refs/heads/stg', sourceSha: sha, parentSha: parent, fragments } })
      parent = sha
    }
    state = await catalog('release_catalog_state')
    releases = state.manifests.filter(row => !row.publishedAt && ancestor(row.manifest.sourceSha, tip))
  } else {
    const staging = createCatalog(process.env.RELEASE_STAGING_URL, process.env.RELEASE_STAGING_TOKEN, refs.staging.projectRef)
    const accepted = await staging('release_catalog_state')
    if (accepted.environment !== 'staging') throw new Error('Missing staging catalog')
    // Include all post-anchor fragments, not only HEAD's delta: multiple staging releases may ship together.
    const baseline = new Set(fragmentTree(accepted.anchorSha).map(({row}) => row.id))
    const fragments = fragmentTree(tip).map(({row})=>row).filter(row => !baseline.has(row.id))
    releases = selectPromotion(accepted.manifests, fragments, sha => ancestor(sha, tip))
  }
  // Reservation may succeed while deployments fail. A later trusted event resumes publication.
  const [statuses, checkRuns] = await Promise.all([github(`commits/${tip}/status?per_page=100`), github(`commits/${tip}/check-runs?per_page=100`)] )
  if (checkRuns.total_count > 100 || statuses.total_count > 100) throw new Error('Readiness pagination requires explicit review')
  const required = requiredContexts(JSON.parse(process.env.RELEASE_REQUIRED_CONTEXTS || 'null'), releases)
  assertReady({ contexts: statuses.statuses, checks: checkRuns.check_runs, required })
  // Observe the live branch immediately before writing. Publishing advertises a deployed ancestor only.
  if ((await github(`git/ref/heads/${branch}`)).object.sha !== tip) throw new Error('Branch advanced; resume on later reconciliation')
  if (releases.length) await catalog('release_publish', { p_environment: environment, p_ref: `refs/heads/${branch}`, p_deployment_sha: tip, p_releases: releases })
  console.log(`Release reconciliation completed: ${releases.length} immutable manifests; ${environment}`)
}
if (process.argv[1] && import.meta.url === (await import('node:url')).pathToFileURL(process.argv[1]).href) {
  for (let attempt = 0; ; attempt++) {
    try { await runPublisher(); break }
    catch (error) {
      if (process.env.RELEASE_WAIT_FOR_DEPLOYMENT !== '1' || !error.message.startsWith('Deployment not ready:') || attempt >= 15) throw error
      console.log('Deployment remains unready; reservation is durable, retrying readiness in 30 seconds')
      await new Promise(resolve => setTimeout(resolve, 30000))
    }
  }
}

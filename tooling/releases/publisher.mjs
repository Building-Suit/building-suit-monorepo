import { execFileSync } from 'node:child_process'
import { canonical, git } from './fragments.mjs'
import { buildCandidate, promotionCandidate } from './candidate.mjs'
import { catalogRejectionReason } from './catalog-diagnostics.mjs'

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
/** Legacy v1 retained-history compatibility only; the live publisher uses promotionCandidate. */
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
export function createCatalog(url, token, projectRef, request = fetch) {
  assertBinding(url, projectRef)
  if (!token) throw new Error('Server publishing credential required')
  return async (name, args = {}) => {
    const response = await request(`${url}/rest/v1/rpc/${name}`, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000),
      headers: { apikey: token, authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(args) })
    if (!response.ok) {
      const reason = await catalogRejectionReason(response)
      throw new Error(`Catalog operation ${name} rejected (HTTP ${response.status}; reason ${reason}); payload and credentials omitted`)
    }
    if (response.status === 204) {
      if (['release_candidate_ready', 'release_candidate_acknowledge'].includes(name)) return null
      throw new Error(`Catalog operation ${name} returned an unexpected empty response; payload and credentials omitted`)
    }
    try { return await response.json() }
    catch { throw new Error(`Catalog operation ${name} returned invalid JSON; payload and credentials omitted`) }
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
  const policy = JSON.parse(await (await import('node:fs/promises')).readFile('tooling/releases/policy.json','utf8'))
  if (policy.releaseModel !== 2) throw new Error('Upcoming release model is not adopted on this branch')
  const refs = map.products['super-admin-suit']
  const catalog = createCatalog(process.env.RELEASE_CATALOG_URL, process.env.RELEASE_CATALOG_TOKEN, refs[environment].projectRef)
  const state = await catalog('release_candidate_state')
  if (state.model !== 2 || state.environment !== environment) throw new Error('Wrong catalog model/environment')
  const main = git('rev-parse','origin/main')
  let upcoming, staging
  if (environment === 'staging') {
    if (state.productionSha && git('rev-parse',`${state.productionSha}^{tree}`) !== git('rev-parse',`${main}^{tree}`)) throw new Error('Production baseline acknowledgment required before refreshing upcoming release')
    const snapshot = { ...buildCandidate(main, tip), baseVersions: state.baseVersions }
    upcoming = await catalog('release_candidate_refresh', { p_snapshot: snapshot })
  } else {
    staging = createCatalog(process.env.RELEASE_STAGING_URL, process.env.RELEASE_STAGING_TOKEN, refs.staging.projectRef)
    // Recover a committed production write whose staging acknowledgment failed, before considering new work.
    for (const receipt of state.promotions) await staging('release_candidate_acknowledge', { p_receipt: receipt })
    const accepted = await staging('release_candidate_state')
    if (accepted.model !== 2 || accepted.environment !== 'staging') throw new Error('Missing staging candidate authority')
    upcoming = promotionCandidate(accepted.revisions, { mainParent: git('rev-parse',`${tip}^1`), tree: git('rev-parse',`${tip}^{tree}`), ancestor: sha => ancestor(sha,tip) })
  }
  const [statuses, checkRuns] = await Promise.all([github(`commits/${tip}/status?per_page=100`), github(`commits/${tip}/check-runs?per_page=100`)] )
  if (checkRuns.total_count > 100 || statuses.total_count > 100) throw new Error('Readiness pagination requires explicit review')
  const required = requiredContexts(JSON.parse(process.env.RELEASE_REQUIRED_CONTEXTS || 'null'), [upcoming])
  assertReady({ contexts: statuses.statuses, checks: checkRuns.check_runs, required })
  if ((await github(`git/ref/heads/${branch}`)).object.sha !== tip || (await github('git/ref/heads/main')).object.sha !== main) throw new Error('Branch advanced; reconcile the actual new branch diff')
  if (environment === 'staging') {
    await catalog('release_candidate_ready', { p_key: upcoming.key, p_digest: upcoming.digest })
  } else {
    const receipt = await catalog('release_candidate_promote', { p_release: upcoming, p_deployment_sha: tip,
      p_main_parent: git('rev-parse',`${tip}^1`), p_main_tree: git('rev-parse',`${tip}^{tree}`) })
    await staging('release_candidate_acknowledge', { p_receipt: receipt })
    // Start the next private candidate immediately; only the staging runner may mark its preview ready.
    git('fetch','origin','stg','main')
    if (git('rev-parse','origin/main') === tip) {
      const nextState = await staging('release_candidate_state')
      const nextTip = git('rev-parse','origin/stg')
      const nextSnapshot = { ...buildCandidate(tip,nextTip), baseVersions: nextState.baseVersions }
      if ((await github('git/ref/heads/stg')).object.sha === nextTip && (await github('git/ref/heads/main')).object.sha === tip) {
        await staging('release_candidate_refresh',{p_snapshot:nextSnapshot})
      }
    }
  }
  console.log(`Upcoming release reconciliation completed: ${environment}`)
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

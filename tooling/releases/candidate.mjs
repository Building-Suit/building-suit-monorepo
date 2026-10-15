import { readFileSync } from 'node:fs'
import { git, validateFragment, affectedSuits, fragmentTree, digest } from './fragments.mjs'

/** Evidence is reviewed semantic text, compared directly between the two branch trees.
 * Commit lists, merge-base-only diffs and fragment accumulation are never release authority. */
export function readTree(ref, file) {
  const names = git('ls-tree', '-r', '--name-only', ref, '--', file).split('\n')
  return names.includes(file) ? git('show', `${ref}:${file}`) : ''
}
export function netCandidate({ main, staging, items, graph, read = readTree, diff = (a,b) => git('diff','--no-renames','--name-only',a,b).split('\n').filter(Boolean) }) {
  const files = diff(main, staging).filter(file => !file.startsWith('release-fragments/') && !file.startsWith('release-changes/'))
  const registry = graph.filter(row => row.suit).map(row => row.suit)
  const ids = new Set(), active = [], covered = new Map()
  for (const item of items) {
    const { evidence, sources, ...fragment } = item
    validateFragment(fragment, registry)
    if (sources !== undefined && (!Array.isArray(sources) || new Set(sources).size !== sources.length || sources.some(id => typeof id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,100}$/.test(id)))) throw new Error('Invalid inventory provenance sources')
    if (ids.has(item.id)) throw new Error('Duplicate candidate change item')
    ids.add(item.id)
    const changed = files.filter(file => item.paths.some(path => file === path || file.startsWith(`${path}/`)))
    if (item.disposition === 'public') {
      if (!Array.isArray(evidence) || !evidence.length) throw new Error('Public net-change evidence required')
      for (const probe of evidence) {
        if (Object.keys(probe).some(key => !['path','contains','absent'].includes(key)) || typeof probe.path !== 'string'
          || !item.paths.some(path => probe.path === path || probe.path.startsWith(`${path}/`))
          || typeof probe.contains !== 'string' || !probe.contains.trim() || (probe.absent !== undefined && typeof probe.absent !== 'boolean')) throw new Error('Invalid net-change probe')
      }
      const contributing = evidence.some(probe => {
        if (!changed.includes(probe.path)) return false
        const before = read(main, probe.path).includes(probe.contains), after = read(staging, probe.path).includes(probe.contains)
        return probe.absent ? before && !after : !before && after
      })
      if (!contributing) continue // Reverted, cherry-picked, already on main, or overlapping work without net contribution.
    } else if (evidence !== undefined) throw new Error('Internal inventory uses path coverage only')
    if (!changed.length) continue
    const affected = affectedSuits(changed, graph)
    if (item.disposition === 'public' && affected.length && item.suits.some(suit => !affected.includes(suit))) throw new Error('Unrelated candidate consumer')
    const selected = item.disposition === 'internal' && affected.length ? { ...fragment, suits: fragment.suits.filter(suit => affected.includes(suit)) } : fragment
    active.push(selected)
    for (const file of changed) {
      if (!covered.has(file)) covered.set(file,new Set())
      selected.suits.forEach(suit=>covered.get(file).add(suit))
    }
  }
  for (const file of files) {
    if (!covered.has(file)) throw new Error(`Unreviewed main-to-stg net path: ${file}`)
    for (const suit of affectedSuits([file],graph)) if (!covered.get(file).has(suit)) throw new Error(`Unclassified net consumer: ${suit} for ${file}`)
  }
  return active.sort((a,b) => a.id.localeCompare(b.id))
}
export function workspaceGraphAt(ref, run = git) {
  return run('ls-tree','-r','--name-only',ref,'--','apps','packages').split('\n').filter(file=>/^(apps|packages)\/[^/]+\/package.json$/.test(file)).map(file=>{
    const manifest=JSON.parse(run('show',`${ref}:${file}`)), dir=file.slice(0,-'/package.json'.length)
    return {dir,name:manifest.name,suit:dir.startsWith('apps/')&&dir.endsWith('-suit')?dir.slice(5):null,dependencies:Object.keys({...manifest.dependencies,...manifest.devDependencies})}
  })
}
export function buildCandidate(main, staging) {
  const items = JSON.parse(readTree(staging, 'release-changes/items.json'))
  return { schemaVersion: 2, repository: 'Building-Suit/building-suit-monorepo', stagingRef: 'refs/heads/stg', productionRef: 'refs/heads/main', mainSha: git('rev-parse',main), mainTree: git('rev-parse',`${main}^{tree}`),
    stagingSha: git('rev-parse',staging), stagingTree: git('rev-parse',`${staging}^{tree}`),
    // Durable audit only. Neither commits nor fragments select public items or allocate versions.
    provenance: {
      branchCommits: git('rev-list','--first-parent','--reverse',`${main}..${staging}`).split('\n').filter(Boolean).map(sha=>({sha,parentSha:git('rev-parse',`${sha}^1`)})),
      fragmentDigests: fragmentTree(staging).map(({row})=>({id:row.id,task:row.task,digest:digest(row)})),
    }, changes: netCandidate({main,staging,items,graph:workspaceGraphAt(staging)}) }
}
export function promotionCandidate(revisions, { mainParent, tree, ancestor }) {
  const match = revisions.filter(row => row.readyAt && row.manifest.mainSha === mainParent && row.manifest.stagingTree === tree && ancestor(row.manifest.stagingSha)).at(-1)
  if (!match) throw new Error('No exact ready upcoming candidate for this production baseline/tree; reconcile stg first')
  return match
}
export function loadInventory() { return JSON.parse(readFileSync('release-changes/items.json','utf8')) }

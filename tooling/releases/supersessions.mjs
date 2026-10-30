import { affectedSuits, canonical, fragmentTree, git, validateFragment, workspaceGraphAt } from './fragments.mjs'

// Rationale may be completed separately; identity, public copy, scope, probes and
// source links must still match the exact corrective snapshot.
const semanticItem = item => { const copy = {...item}; delete copy.reason; return copy }
const covers = (paths, file) => paths.some(path => file === path || file.startsWith(`${path}/`))
/** Explicit replacement receipts, never a waiver based on overlapping file names. */
export function validateSupersessions({ records, inventory, candidate, head, run = git, acceptedStaging = 'origin/stg' }) {
  if (!Array.isArray(records)) throw new Error('Invalid corrective supersession inventory')
  if (!records.length) return new Map()
  const current = fragmentTree(head, run), graph = workspaceGraphAt(head, run)
  const registry = graph.filter(node => node.suit).map(node => node.suit)
  const verified = new Map()
  const snapshots = new Map()
  const fragmentAt = (ref, id) => {
    const matches = current.filter(entry => entry.row.id === id)
    if (matches.length !== 1) throw new Error('Missing exact corrective fragment')
    const file = matches[0].file, key = `${ref}:${file}`
    if (!snapshots.has(key)) snapshots.set(key,JSON.parse(run('show',key)))
    const row = snapshots.get(key)
    if (row.id !== id) throw new Error('Missing exact corrective fragment')
    return {file,row}
  }
  const origin = (id, task, source, taskOrigin = source) => {
    const { file, row } = fragmentAt(head, id)
    if (row.task !== task || canonical(fragmentAt(source, id).row) !== canonical(row)) throw new Error('Corrective task/fragment identity mismatch')
    const additions = run('log','--diff-filter=A','--format=%H',head,'--',file).split('\n').filter(Boolean)
    if (additions.length !== 1 || additions[0] !== taskOrigin) throw new Error('Incorrect corrective source origin')
    if (run('log','--format=%H',head,'--',file).split('\n')[0] !== source) throw new Error('Incorrect retained fragment revision')
    const first = fragmentAt(taskOrigin,id).row
    if (row.suits.some(suit=>!first.suits.includes(suit)) || canonical({...first,suits:row.suits}) !== canonical(row)) throw new Error('Unproven fragment revision')
    run('merge-base','--is-ancestor',taskOrigin,source)
    const parent = run('show','-s','--format=%P',taskOrigin).split(' ')
    if (parent.length !== 1) throw new Error('Ambiguous original task parent')
    const originalGraph = workspaceGraphAt(taskOrigin,run)
    validateFragment(row,originalGraph.filter(node=>node.suit).map(node=>node.suit))
    const scope=run('diff','--name-only',parent[0],taskOrigin).split('\n').filter(path=>covers(row.paths,path))
    const consumers=affectedSuits(scope,originalGraph)
    if (!consumers.length || row.suits.some(suit=>!consumers.includes(suit))) throw new Error('Unrelated original task consumer')
    run('merge-base','--is-ancestor',source,head)
    return row
  }
  const itemAt = (ref, id) => {
    const rows = JSON.parse(run('show',`${ref}:release-changes/items.json`)).filter(item => item.id === id)
    if (rows.length !== 1) throw new Error('Missing exact corrective item')
    return rows[0]
  }
  for (const record of records) {
    const keys = ['originalFragment','originalTask','originalSource','originalTaskOrigin','integrationSource','originalItem','correctiveFragment','correctiveTask','correctiveSource','correctiveItem','internalFragment','proof']
    if (!record || Object.keys(record).some(key => !keys.includes(key))
      || keys.filter(key => !['internalFragment','proof'].includes(key)).some(key => typeof record[key] !== 'string' || !record[key])
      || !['originalSource','originalTaskOrigin','correctiveSource','integrationSource'].every(key => /^[a-f0-9]{40}$/.test(record[key]))
      || !Array.isArray(record.proof) || !record.proof.length || verified.has(record.originalFragment)) throw new Error('Invalid corrective supersession receipt')
    const old = origin(record.originalFragment, record.originalTask, record.originalSource, record.originalTaskOrigin)
    const correction = origin(record.correctiveFragment, record.correctiveTask, record.correctiveSource)
    if (old.disposition !== 'public' || correction.disposition !== 'public' || record.originalSource === record.correctiveSource
      || correction.suits.some(suit => !old.suits.includes(suit))) throw new Error('Invalid corrective public scope')
    const integrationParents=run('show','-s','--format=%P',record.integrationSource).split(' ')
    if(integrationParents.length!==2) throw new Error('Missing exact corrective integration merge')
    run('merge-base','--is-ancestor',record.originalSource,integrationParents[0])
    run('merge-base','--is-ancestor',record.correctiveSource,integrationParents[1])
    run('merge-base','--is-ancestor',record.integrationSource,head)
    run('merge-base','--is-ancestor',record.integrationSource,acceptedStaging)
    const oldItem = inventory.find(item => item.id === record.originalItem)
    const replacement = inventory.find(item => item.id === record.correctiveItem)
    for (const item of [oldItem, replacement]) {
      if (!item) throw new Error('Missing corrective inventory link')
      const row = {...item}; delete row.evidence; delete row.sources
      validateFragment(row, registry)
    }
    if (oldItem.task !== old.task || !oldItem.sources?.includes(old.id)
      || canonical(semanticItem(oldItem)) !== canonical(semanticItem(itemAt(record.originalSource, record.originalItem)))
      || replacement.task !== correction.task || !replacement.sources?.includes(correction.id)
      || canonical(replacement.suits) !== canonical(correction.suits)
      || canonical(semanticItem(replacement)) !== canonical(semanticItem(itemAt(record.correctiveSource, record.correctiveItem)))) throw new Error('Altered or unlinked corrective inventory')
    if (candidate.changes.some(item => item.id === oldItem.id)
      || !candidate.changes.some(item => item.id === replacement.id && item.disposition === 'public')) throw new Error('Correction has no exclusive current semantic contribution')
    if (!oldItem.evidence?.length || oldItem.evidence.some(probe => probe.absent || run('show',`${head}:${probe.path}`).includes(probe.contains)
      || !run('show',`${record.originalSource}:${probe.path}`).includes(probe.contains)
      || !run('show',`${integrationParents[0]}:${probe.path}`).includes(probe.contains)
      || run('show',`${integrationParents[1]}:${probe.path}`).includes(probe.contains)
      || run('show',`${record.integrationSource}:${probe.path}`).includes(probe.contains))) throw new Error('Original behavior is not demonstrably retired')
    const parent = run('show','-s','--format=%P',record.correctiveSource).split(' ')
    if (parent.length !== 1) throw new Error('Ambiguous corrective task parent')
    const changed = run('diff','--name-only',parent[0],record.correctiveSource).split('\n')
    let introduced = false
    for (const proof of record.proof) {
      if (!proof || Object.keys(proof).some(key => !['path','contains'].includes(key)) || typeof proof.path !== 'string'
        || !/^(apps|packages)\//.test(proof.path) || /\/(tests?|docs|scripts)\//.test(proof.path)
        || !/\.(vue|[cm]?js|[jt]sx?)$/.test(proof.path) || !covers(correction.paths,proof.path)
        || typeof proof.contains !== 'string' || !proof.contains.trim() || proof.contains.length > 8000) throw new Error('Invalid corrective runtime proof')
      if (!run('show',`${head}:${proof.path}`).includes(proof.contains)
        || !run('show',`${record.correctiveSource}:${proof.path}`).includes(proof.contains)
        || !run('show',`${integrationParents[1]}:${proof.path}`).includes(proof.contains)
        || !run('show',`${record.integrationSource}:${proof.path}`).includes(proof.contains)) throw new Error('Missing current corrective behavior')
      if (changed.includes(proof.path)) {
        const existed = run('ls-tree','-r','--name-only',parent[0],'--',proof.path)
        if (!existed || !run('show',`${parent[0]}:${proof.path}`).includes(proof.contains)) introduced = true
      }
    }
    if (!introduced || record.proof.every(proof => { const exists=run('ls-tree','-r','--name-only',integrationParents[0],'--',proof.path); return exists && run('show',`${integrationParents[0]}:${proof.path}`).includes(proof.contains) })) throw new Error('Corrective proof predates the correction')
    const privateConsumers = old.suits.filter(suit => !correction.suits.includes(suit))
    if (privateConsumers.length) {
      const support = current.find(entry => entry.row.id === record.internalFragment)?.row
      if (!support || support.disposition !== 'internal' || support.task !== correction.task
        || canonical(fragmentAt(record.correctiveSource,support.id).row) !== canonical(support)
        || privateConsumers.some(suit => !support.suits.includes(suit))
        || record.proof.some(proof => !covers(support.paths,proof.path))
        || !candidate.changes.some(item => item.disposition === 'internal' && item.sources === undefined && item.id === support.id && privateConsumers.every(suit => item.suits.includes(suit)))) throw new Error('Missing private consumer correction qualification')
      origin(support.id, correction.task, record.correctiveSource)
      const supportItem = inventory.find(item => item.id === support.id)
      if (!supportItem?.sources?.includes(support.id) || supportItem.task !== support.task
        || canonical(semanticItem(supportItem)) !== canonical(semanticItem(itemAt(record.correctiveSource,support.id)))) throw new Error('Unlinked private correction qualification')
    } else if (record.internalFragment !== undefined) throw new Error('Unnecessary private corrective scope')
    verified.set(old.id, record)
  }
  return verified
}

import { readFileSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { createHash } from 'node:crypto'

export const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()
export const canonical = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item)
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex')
const impacts = ['internal', 'patch', 'minor', 'major']
const allowed = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(key => keys.includes(key))
export function plainText(value) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= 8000 && !/[<>]/.test(value) && !Array.from(value).some(char => char.charCodeAt(0) < 9)
    && !/(?:\b(?:BS|SS|SAS|LS|IS|AS)-[A-Z0-9-]+\b|service_role|secret[_ -]?key|-----BEGIN|github_pat_|ghp_)/i.test(value)
}
export function validateFragment(row, registry) {
  if (!allowed(row, ['id', 'task', 'suits', 'classification', 'disposition', 'paths', 'reason', 'notes'])
    || !/^[a-z0-9][a-z0-9-]{2,100}$/.test(row.id) || typeof row.task !== 'string' || !/^[A-Z][A-Z0-9-]{2,100}$/.test(row.task)
    || !impacts.includes(row.classification) || !['public', 'internal'].includes(row.disposition)
    || !Array.isArray(row.suits) || !row.suits.length || new Set(row.suits).size !== row.suits.length || row.suits.some(suit => !registry.includes(suit))
    || !Array.isArray(row.paths) || !row.paths.length || new Set(row.paths).size !== row.paths.length
    || row.paths.some(file => typeof file !== 'string' || file.startsWith('/') || file.includes('..') || /[*?]/.test(file))
    || !plainText(row.reason)) throw new Error('Invalid release fragment')
  if ((row.classification === 'internal') !== (row.disposition === 'internal')) throw new Error('Internal classification/disposition mismatch')
  if (row.disposition === 'public') {
    if (!allowed(row.notes, ['title', 'summary', 'details']) || Object.keys(row.notes).length !== 3) throw new Error('Missing curated notes')
    for (const field of ['title', 'summary', 'details']) {
      const copy = row.notes[field]
      if (!allowed(copy, ['en', 'ar']) || !plainText(copy.en) || !plainText(copy.ar) || !/[\u0600-\u06ff]/.test(copy.ar)
        || !/[a-z]/i.test(copy.en) || copy.en === copy.ar || Object.values(copy).some(text => text.includes(row.task))) throw new Error('Invalid EN/AR plain-text notes')
    }
  } else if (row.notes !== undefined) throw new Error('Internal fragments cannot carry public copy')
  return row
}
export function workspaceGraph(root) {
  const nodes = []
  for (const group of ['apps', 'packages']) for (const name of readdirSync(path.join(root, group))) {
    try { const manifest = JSON.parse(readFileSync(path.join(root, group, name, 'package.json')))
      nodes.push({ dir: `${group}/${name}`, name: manifest.name, suit: group === 'apps' && name.endsWith('-suit') ? name : null,
        dependencies: Object.keys({ ...manifest.dependencies, ...manifest.devDependencies }) })
    } catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  return nodes
}
export function affectedSuits(files, graph) {
  const affected = new Set()
  for (const file of files) {
    const owner = graph.find(node => file.startsWith(`${node.dir}/`))
    if (owner) affected.add(owner.name)
    // Root/shared policy and tooling changes must be explicitly classified for every consumer.
    else if (!file.startsWith('release-fragments/') && !file.startsWith('docs/')) graph.filter(node => node.suit).forEach(node => affected.add(node.name))
  }
  let changed = true
  while (changed) { changed = false; for (const node of graph) if (!affected.has(node.name) && node.dependencies.some(dep => affected.has(dep))) { affected.add(node.name); changed = true } }
  return graph.filter(node => node.suit && affected.has(node.name)).map(node => node.suit).sort()
}
export function workspaceGraphAt(ref, run = git) {
  return run('ls-tree','-r','--name-only',ref,'--','apps','packages').split('\n').filter(file=>/^(apps|packages)\/[^/]+\/package.json$/.test(file)).map(file=>{
    const manifest=JSON.parse(run('show',`${ref}:${file}`)), dir=file.slice(0,-'/package.json'.length)
    return {dir,name:manifest.name,suit:dir.startsWith('apps/')&&dir.endsWith('-suit')?dir.slice(5):null,dependencies:Object.keys({...manifest.dependencies,...manifest.devDependencies})}
  })
}
// A net revert can remove a former shared path without invalidating its immutable
// task receipt. Trust only the exact original row and actual original task edits.
export function historicalFragmentScope(ref, file, row, run = git) {
  const additions = run('log','--diff-filter=A','--format=%H',ref,'--',file).split('\n').filter(Boolean)
  if (additions.length !== 1) throw new Error('Ambiguous historical fragment origin')
  const source = additions[0]
  if (canonical(JSON.parse(run('show',`${source}:${file}`))) !== canonical(row)) throw new Error('Historical fragment differs from its origin')
  const parents = run('show','-s','--format=%P',source).split(' ').filter(Boolean)
  if (parents.length !== 1) throw new Error('Historical fragment requires an unambiguous task parent')
  const graph = workspaceGraphAt(source, run)
  validateFragment(row, graph.filter(node=>node.suit).map(node=>node.suit))
  const files = run('diff','--name-only',parents[0],source).split('\n').filter(Boolean)
    .filter(path=>row.paths.some(prefix=>path===prefix || path.startsWith(`${prefix}/`)))
  const affected = affectedSuits(files, graph)
  if (!affected.length || row.suits.some(suit=>!affected.includes(suit))) throw new Error('Unrelated Suit in historical fragment origin')
  return affected
}
export function validateCoverage(fragments, files, graph, historicalScope) {
  const registry = graph.filter(node => node.suit).map(node => node.suit)
  const ids = new Set()
  for (const row of fragments) { validateFragment(row, registry); if (ids.has(row.id)) throw new Error('Duplicate fragment'); ids.add(row.id) }
  for (const file of files.filter(file => !file.startsWith('release-fragments/'))) {
    const covering = fragments.filter(row => row.paths.some(prefix => file === prefix || file.startsWith(`${prefix}/`)))
    if (!covering.length) throw new Error(`Unclassified changed path: ${file}`)
    const suits = new Set(covering.flatMap(row => row.suits))
    for (const suit of affectedSuits([file], graph)) if (!suits.has(suit)) throw new Error(`Missing affected consumer: ${suit} for ${file}`)
  }
  // Reject declaring consumers without a path/dependency basis, rather than indiscriminate shared fanout.
  for (const row of fragments) {
    const scope = files.filter(file => row.paths.some(prefix => file === prefix || file.startsWith(`${prefix}/`)))
    const affected = affectedSuits(scope, graph)
    if (affected.length && row.suits.some(suit => !affected.includes(suit))) {
      const original = historicalScope?.(row)
      if (!original || row.suits.some(suit=>!original.includes(suit))) throw new Error('Unrelated Suit in fragment')
    }
  }
}
export function fragmentTree(ref, run = git) {
  return run('ls-tree', '-r', '--name-only', ref, '--', 'release-fragments').split('\n').filter(file => file.endsWith('.json')).map(file => ({ file, row: JSON.parse(run('show', `${ref}:${file}`)) }))
}
export function collectBatch(ref, parent, graph, run = git) {
  const prior = new Map(fragmentTree(parent, run).map(({ file, row }) => [file, row]))
  const current = fragmentTree(ref, run)
  for (const [file, row] of prior) {
    const next = current.find(item => item.file === file)
    if (!next || JSON.stringify(next.row) !== JSON.stringify(row)) throw new Error(`Accepted fragments are append-only: ${file}`)
  }
  const added = current.filter(({ file }) => !prior.has(file))
  const fragments = added.map(({ row }) => row)
  const files = run('diff', '--name-only', parent, ref).split('\n').filter(Boolean)
  validateCoverage(fragments, files, graph, row=>historicalFragmentScope(ref, added.find(item=>item.row===row).file, row, run))
  const allIds = current.map(({ row }) => row.id)
  if (new Set(allIds).size !== allIds.length) throw new Error('Duplicate fragment ID in history')
  return fragments.sort((a, b) => a.id.localeCompare(b.id))
}

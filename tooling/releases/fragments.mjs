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
    && !/(?:BS-[A-Z]+-\d|SS-[A-Z]+-\d|service_role|secret[_ -]?key|-----BEGIN|github_pat_|ghp_)/i.test(value)
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
export function validateCoverage(fragments, files, graph) {
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
    if (affected.length && row.suits.some(suit => !affected.includes(suit))) throw new Error('Unrelated Suit in fragment')
  }
}
export function fragmentTree(ref) {
  return git('ls-tree', '-r', '--name-only', ref, '--', 'release-fragments').split('\n').filter(file => file.endsWith('.json')).map(file => ({ file, row: JSON.parse(git('show', `${ref}:${file}`)) }))
}
export function collectBatch(ref, parent, graph) {
  const prior = new Map(fragmentTree(parent).map(({ file, row }) => [file, row]))
  const current = fragmentTree(ref)
  for (const [file, row] of prior) {
    const next = current.find(item => item.file === file)
    if (!next || JSON.stringify(next.row) !== JSON.stringify(row)) throw new Error(`Accepted fragments are append-only: ${file}`)
  }
  const fragments = current.filter(({ file }) => !prior.has(file)).map(({ row }) => row)
  const files = git('diff', '--name-only', parent, ref).split('\n').filter(Boolean)
  validateCoverage(fragments, files, graph)
  const allIds = current.map(({ row }) => row.id)
  if (new Set(allIds).size !== allIds.length) throw new Error('Duplicate fragment ID in history')
  return fragments.sort((a, b) => a.id.localeCompare(b.id))
}

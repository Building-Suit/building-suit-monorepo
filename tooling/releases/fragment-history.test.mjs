import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fragmentSourceScope, validateCoverage } from './fragments.mjs'

test('consolidated workflow retains immutable historical consumer evidence without excusing unsupported claims', () => {
  const root = mkdtempSync(join(tmpdir(), 'bs-fragment-history-'))
  const run = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  const write = (file, value) => { mkdirSync(dirname(join(root, file)), { recursive: true }); writeFileSync(join(root, file), value) }
  const commit = message => { run('add', '.'); run('commit', '-m', message); return run('rev-parse', 'HEAD') }
  const app = 'apps/shop-suit/runtime.mjs', workflow = '.github/workflows/qualification.yml'
  const file = 'release-fragments/workflow-scope.json'
  const row = { id: 'workflow-scope', task: 'BS-HISTORY-001', suits: ['shop-suit', 'ledger-suit'], classification: 'internal', disposition: 'internal', paths: [app, workflow], reason: 'Qualify shared workflow and product behavior' }
  const graph = ['shop-suit', 'ledger-suit'].map(suit => ({ dir: `apps/${suit}`, name: suit, suit, dependencies: [] }))
  try {
    run('init', '-b', 'main'); run('config', 'user.name', 'Disposable history test'); run('config', 'user.email', 'history@invalid.example')
    for (const node of graph) write(`${node.dir}/package.json`, JSON.stringify({ name: node.name }))
    write(app, 'export const enabled = false\n')
    const base = commit('Initial source')
    write(app, 'export const enabled = true\n'); write(workflow, 'name: Qualification\n'); write(file, JSON.stringify(row))
    commit('Task with shared qualification')
    rmSync(join(root, workflow)); commit('Consolidate duplicated qualification workflow')
    const files = run('diff', '--name-only', base, 'HEAD').split('\n')
    assert.ok(!files.includes(workflow), 'The workflow is genuinely net-zero')
    assert.throws(() => validateCoverage([row], files, graph), /Unrelated Suit/)
    const source = fragmentSourceScope('HEAD', file, row, run)
    assert.deepEqual(source.files.sort(), [app, workflow].sort())
    validateCoverage([row], files, graph, () => source)
    assert.throws(() => validateCoverage([row], [...files, 'apps/ledger-suit/unclassified.mjs'], graph, () => source), /Unclassified changed path/)

    // New claims cannot borrow the old workflow's ancestry or another receipt.
    const unsupportedFile = 'release-fragments/unsupported-scope.json'
    const unsupported = { ...row, id: 'unsupported-scope' }
    write(app, 'export const enabled = "revised"\n'); write(unsupportedFile, JSON.stringify(unsupported)); commit('Claim consumers without shared changes')
    const unsupportedSource = fragmentSourceScope('HEAD', unsupportedFile, unsupported, run)
    assert.deepEqual(unsupportedSource.files, [app])
    assert.throws(() => validateCoverage([unsupported], [app, unsupportedFile], graph, () => unsupportedSource), /Unrelated Suit/)

    // A changed receipt cannot reuse introduction-time evidence.
    const altered = { ...row, reason: 'A replacement claim' }
    write(file, JSON.stringify(altered)); commit('Alter historical receipt')
    assert.equal(fragmentSourceScope('HEAD', file, altered, run), null)
    assert.throws(() => validateCoverage([altered], files, graph, () => null), /Unrelated Suit/)

    // Delete/recreate is ambiguous provenance, even if bytes later match.
    rmSync(join(root, file)); commit('Remove receipt')
    write(file, JSON.stringify(row)); commit('Recreate receipt')
    assert.equal(fragmentSourceScope('HEAD', file, row, run), null)
  } finally { rmSync(root, { recursive: true, force: true }) }
})

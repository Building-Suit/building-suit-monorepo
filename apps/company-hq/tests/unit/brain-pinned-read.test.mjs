/** Synthetic Drive tree; compare actual reader work, without credentials/HTTP. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'

registerHooks({ resolve(specifier, context, nextResolve) {
  if (specifier === 'h3') return { url: 'data:text/javascript,' + encodeURIComponent(`
    export const createError = value => Object.assign(new Error(value.statusMessage), value);
    export const getHeader = () => undefined; export const setResponseHeaders = () => {};
  `), shortCircuit: true }
  if (context.parentURL?.endsWith('/server/utils/brain.ts') && specifier === './googleDriveAuth') return {
    url: 'data:text/javascript,' + encodeURIComponent(`
      export class BrainCloudError extends Error { constructor(reason='cloud-unavailable') { super(reason); this.reason=reason } }
      export class BrainCloudLimit extends Error {};
      export const MAX_NOTE_BYTES=512*1024;
      export const createDriveReader=async()=>globalThis.__brainPinnedFixture.reader;
    `), shortCircuit: true,
  }
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) && context.parentURL?.includes('/apps/company-hq/')) return nextResolve(`${specifier}.ts`, context)
  return nextResolve(specifier, context)
} })
const { readBrainIndex, readBrainNote } = await import('../../server/utils/brain.ts')
const { withOfficeRoster } = await import('../../server/utils/officeRoster.ts')
// Existing public source pins; all metadata, bodies and other IDs are generated.
const rootId = /const ROOT_FOLDER_ID = '([^']+)'/.exec(readFileSync(new URL('../../server/utils/brain.ts', import.meta.url), 'utf8'))[1]
const registryId = /\.update\('([^']+)'\)/.exec(readFileSync(new URL('../../server/utils/officeRoster.ts', import.meta.url), 'utf8'))[1]
const id = value => createHash('sha256').update(value).digest('base64url')
const folderMime = 'application/vnd.google-apps.folder'
const path = 'Company/Agent Registry.md'
const registry = '| AG-CEO-001 | Executive | [[CEO/Steve]] | Active | policy | model |\n| AG-RES-002 | Analyst — Research | [[Departments/Research/Analyst]] | Active | policy | model |'

function fixture(t, options = {}) {
  const rows = new Map(), children = new Map(), calls = []
  const counts = { requests: 0, metadataBytes: 0, listedEntries: 0, mediaReads: 0, mediaBytes: 0 }
  function add(file) {
    rows.set(file.id, file)
    for (const parent of file.parents ?? []) children.set(parent, [...(children.get(parent) ?? []), file])
  }
  const folder = (id, name, parents) => ({ id, name, parents, mimeType: folderMime, trashed: false })
  const note = (id, name, parent) => ({ id, name, parents: [parent], mimeType: 'text/markdown', trashed: false,
    modifiedTime: '2026-11-08T12:00:00.000Z', version: '1', size: '200', capabilities: { canDownload: true } })
  add(folder(rootId, 'building-suit-brain', []))
  for (let n = 0; n < 48; n++) {
    const parent = `synthetic_folder_${n}`
    add(folder(parent, `A${String(n).padStart(2, '0')}`, [rootId]))
    for (let m = 0; m < 20; m++) add(note(`synthetic_note_${n}_${m}`, `Document ${m}.md`, parent))
  }
  add(folder('synthetic_company', 'Company', [rootId]))
  add(note(registryId, 'Agent Registry.md', 'synthetic_company'))
  let mediaRead = false
  const reader = {
    async json(fileId, parameters) {
      calls.push({ fileId, parameters })
      let value
      if (fileId === null) {
        const parent = /^'([^']+)' in parents/.exec(parameters.q)[1]
        value = { files: structuredClone(children.get(parent) ?? []) }
        counts.listedEntries += value.files.length
      }
      else {
        value = structuredClone(rows.get(fileId))
        options.metadata?.(value, { mediaRead, calls })
      }
      counts.requests++; counts.metadataBytes += Buffer.byteLength(JSON.stringify(value))
      return value
    },
    async markdown(fileId) {
      assert.equal(fileId, registryId)
      mediaRead = true; counts.mediaReads++; counts.mediaBytes += Buffer.byteLength(registry)
      return registry
    },
  }
  const f = { reader, rows, counts, calls }
  globalThis.__brainPinnedFixture = f
  t.after(() => { delete globalThis.__brainPinnedFixture })
  return f
}

test('pinned Registry path avoids unrelated enumeration while returning the identical fresh note', async t => {
  const broad = fixture(t)
  const expected = await readBrainNote({}, id(registryId))
  const narrow = fixture(t)
  assert.deepEqual(await readBrainNote({}, id(registryId), path), expected)
  assert.deepEqual(narrow.calls.filter(call => call.fileId === null).map(call => call.parameters.q), [
    `'${rootId}' in parents and trashed = false`, "'synthetic_company' in parents and trashed = false",
  ])
  assert.equal(narrow.counts.mediaReads, 1)
  assert.equal(narrow.counts.mediaBytes, broad.counts.mediaBytes)
  assert.ok(narrow.counts.requests < broad.counts.requests / 5)
  assert.ok(narrow.counts.metadataBytes < broad.counts.metadataBytes / 5)
  assert.ok(narrow.counts.listedEntries < broad.counts.listedEntries / 5)
  t.diagnostic(JSON.stringify({ broad: broad.counts, pinned: narrow.counts }))
})

test('full Brain index retains every unrelated subtree and fresh note versions', async t => {
  const f = fixture(t)
  const index = await readBrainIndex({})
  assert.equal(index.status, 'connected'); assert.equal(index.partial, false)
  assert.equal(index.count, 961)
  assert.ok(index.notes.some(note => note.path === 'A00/Document 0.md'))
  assert.ok(index.notes.some(note => note.path === path))
  assert.equal(f.counts.mediaReads, 0)
})

test('the actual Office roster caller uses the pinned path and keeps its display projection', async t => {
  const f = fixture(t)
  const snapshot = { departments: [{ id: 'synthetic-department', name: 'Research', approvedAt: '2026-11-08T12:00:00Z' }],
    plans: [{ status: 'approved', departments: [{ id: 'synthetic-department', key: 'research-market-intelligence' }] }] }
  const result = await withOfficeRoster(snapshot, {})
  assert.deepEqual(result.departments[0].agents, [{ id: 'AG-RES-002', name: 'Analyst' }])
  assert.equal(f.calls.filter(call => call.fileId === null).length, 2)
})

test('each pinned read observes a fresh revision rather than reusing the prior read', async t => {
  const f = fixture(t)
  assert.equal((await readBrainNote({}, id(registryId), path)).version, '1')
  f.rows.get(registryId).version = '2'
  assert.equal((await readBrainNote({}, id(registryId), path)).version, '2')
  assert.equal(f.counts.mediaReads, 2)
  assert.equal(f.counts.requests, 20)
})

for (const [name, change] of [
  ['wrong root name', file => { if (file.id === rootId) file.name = 'Unrelated' }],
  ['wrong root identity', file => { if (file.id === rootId) file.id = 'unrelated_root' }],
  ['root trashed', file => { if (file.id === rootId) file.trashed = true }],
  ['non-folder parent', file => { if (file.id === 'synthetic_company') file.mimeType = 'text/plain' }],
  ['moved parent', file => { if (file.id === 'synthetic_company') file.parents = ['unrelated_parent'] }],
  ['moved file', file => { if (file.id === registryId) file.parents = ['unrelated_parent'] }],
  ['renamed file', file => { if (file.id === registryId) file.name = 'Other.md' }],
  ['download permission lost', file => { if (file.id === registryId) file.capabilities.canDownload = false }],
  ['binary file', file => { if (file.id === registryId) file.mimeType = 'application/octet-stream' }],
  ['oversized file', file => { if (file.id === registryId) file.size = String(512 * 1024 + 1) }],
]) test(`pinned read fails closed before media for ${name}`, async t => {
  const f = fixture(t, { metadata: change })
  await assert.rejects(readBrainNote({}, id(registryId), path), error => error.statusCode === 404)
  assert.equal(f.counts.mediaReads, 0)
  assert.ok(f.calls.every(call => call.fileId !== 'unrelated_parent'))
})

for (const kind of ['version', 'ancestry']) test(`${kind} change after media is rejected`, async t => {
  fixture(t, { metadata(file, { mediaRead }) {
    if (mediaRead && kind === 'version' && file.id === registryId) file.version = '2'
    if (mediaRead && kind === 'ancestry' && file.id === 'synthetic_company') file.parents = ['unrelated_parent']
  } })
  await assert.rejects(readBrainNote({}, id(registryId), path), error => error.statusCode === 404)
})

test('failed fresh roster read clears prior display assignments rather than serving a cache', async t => {
  const f = fixture(t, { metadata(file) { if (file.id === rootId) file.trashed = true } })
  const snapshot = { departments: [{ id: 'synthetic-department', name: 'Research', approvedAt: '2026-11-08T12:00:00Z', agents: [{ id: 'AG-RES-002', name: 'Old display' }] }], plans: [] }
  const result = await withOfficeRoster(snapshot, {})
  assert.equal(result.departments[0].agents, undefined)
  assert.equal(f.counts.mediaReads, 0)
})

test('path match cannot substitute a different file identity or an arbitrary requested path', async t => {
  const f = fixture(t)
  for (const [requestedId, requestedPath] of [[id('different_file'), path], [id(registryId), 'Other/Agent Registry.md'], [id(registryId), '../Company/Agent Registry.md']]) {
    await assert.rejects(readBrainNote({}, requestedId, requestedPath), error => error.statusCode === 404)
  }
  assert.equal(f.counts.mediaReads, 0)
})

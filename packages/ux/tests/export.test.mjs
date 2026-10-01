import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import * as vue from 'vue'
import ts from 'typescript'
import { csvCell, recordSnapshot } from '../src/index.ts'

test('CSV export neutralizes formula text and retains numeric values', () => {
  for (const value of ['=SUM(A1)', '+cmd', '-cmd', '@formula', '  =SUM(A1)']) assert.equal(csvCell(value), `'${value}`)
  assert.equal(csvCell(-25), '-25')
  assert.equal(csvCell('Product 1'), 'Product 1')
  assert.equal(csvCell(null), '')
})

test('record snapshots are deterministic for objects, sets, and maps', () => {
  const first = { z: new Set(['write', 'read']), a: new Map([['second', 2], ['first', 1]]) }
  const second = { a: new Map([['first', 1], ['second', 2]]), z: new Set(['read', 'write']) }
  assert.equal(recordSnapshot(first), recordSnapshot(second))
  const shared = { id: 'same-value' }
  assert.doesNotThrow(() => recordSnapshot({ first: shared, second: shared }))
  assert.throws(() => {
    const circular = {}
    circular.self = circular
    recordSnapshot(circular)
  }, /circular references/)
})

function recordAction(getValue) {
  const source = readFileSync(new URL('../src/composables/useRecordAction.ts', import.meta.url), 'utf8')
    .replace("import { recordSnapshot } from '../index'", '')
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const module = { exports: {} }
  const globals = {
    ref: vue.ref,
    computed: vue.computed,
    watch: vue.watch,
    recordSnapshot,
  }
  new Function('module', 'exports', ...Object.keys(globals), code)(module, module.exports, ...Object.values(globals))
  return module.exports.useRecordAction(getValue)
}

test('record actions standardize create/edit, dirty, pending, failure, and completion state', async () => {
  const form = vue.reactive({ name: '', permissions: new Set(['read']) })
  const action = recordAction(() => form)

  action.create()
  assert.equal(action.visible.value, true)
  assert.equal(action.mode.value, 'create')
  assert.equal(action.dirty.value, false)
  form.permissions.add('write')
  assert.equal(action.dirty.value, true)
  action.markSaved()
  assert.equal(action.dirty.value, false)

  action.complete()
  form.name = 'Existing'
  action.edit()
  assert.equal(action.mode.value, 'edit')

  let release
  const successful = action.run(() => new Promise(resolve => { release = resolve }), () => 'Safe error')
  assert.equal(action.pending.value, true)
  assert.equal(await action.run(async () => {}, () => 'Duplicate'), false)
  release()
  assert.equal(await successful, true)
  assert.equal(action.pending.value, false)
  assert.equal(action.visible.value, false)
  assert.equal(action.error.value, null)

  action.edit()
  const failed = await action.run(async () => { throw new Error('private infrastructure detail') }, () => 'Could not save this record.')
  assert.equal(failed, false)
  assert.equal(action.visible.value, true)
  assert.equal(action.pending.value, false)
  assert.equal(action.error.value, 'Could not save this record.')
  assert.doesNotMatch(action.error.value, /infrastructure/)
})

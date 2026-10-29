import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { captureBarcodeKey, emptyScanState } from '../src/utils/barcode.js'

function controller(file, require, globals = {}) {
  const exports = {}
  const code = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  new Function('exports', 'require', ...Object.keys(globals), code)(exports, require, ...Object.values(globals))
  return exports
}
test('POS shortcuts respect modal/picker ownership, scanner timing, editable targets and listener disposal', async () => {
  let mount, dispose, listener, removed, blocked = false, expanded = false, now = 0
  const actions = []
  class Element { constructor(id = '', editable = false) { this.id = id; this.editable = editable } closest() { return this.editable ? this : null } }
  const window = { addEventListener: (name, callback) => { assert.equal(name, 'keydown'); listener = callback }, removeEventListener: (name, callback) => { assert.equal(name, 'keydown'); removed = callback } }
  const vue = { nextTick: callback => Promise.resolve().then(callback), onMounted: callback => { mount = callback }, onBeforeUnmount: callback => { dispose = callback } }
  const { usePointOfSaleKeyboard } = controller('../src/composables/usePointOfSaleKeyboard.ts', name => name === 'vue' ? vue : { captureBarcodeKey, emptyScanState }, { window, document: { querySelector: () => expanded ? {} : null }, HTMLElement: Element, performance: { now: () => now } })
  usePointOfSaleKeyboard({ blocked: () => blocked, focusCatalog: () => actions.push('catalog'), focusCustomer: () => actions.push('customer'), checkout: () => actions.push('checkout'), dismissFeedback: () => actions.push('dismiss'), barcode: value => actions.push(value) })
  assert.equal(listener, undefined)
  mount(); await Promise.resolve()
  assert.deepEqual(actions, ['catalog'])
  function press(key, target = new Element(), extra = {}) { now += 10; let prevented = false; listener({ key, target, preventDefault: () => { prevented = true }, ...extra }); return prevented }
  assert.equal(press('F4'), true)
  assert.equal(press('F8'), true)
  blocked = true; press('F8'); blocked = false
  expanded = true; press('F8'); expanded = false
  press('F8', new Element(), { ctrlKey: true })
  assert.deepEqual(actions, ['catalog', 'customer', 'checkout'])
  press('Escape'); assert.equal(actions.at(-1), 'dismiss')
  for (const key of '123') press(key, new Element('pos-catalog-search', true))
  assert.equal(press('Enter', new Element('pos-catalog-search', true)), true)
  assert.equal(actions.at(-1), '123')
  for (const key of '456') press(key, new Element('payment-reference', true))
  press('Enter', new Element('payment-reference', true))
  assert.equal(actions.at(-1), '123')
  press('7'); now += 100; press('8'); press('Enter')
  assert.equal(actions.at(-1), '123')
  dispose(); assert.equal(removed, listener)
})
test('control focus prefers a native element and falls back to the widget accessible control', () => {
  const actions = []
  const native = { value: { focus: () => actions.push('native') } }
  const component = { value: { $el: { querySelector: selector => { assert.equal(selector, '[role="combobox"]'); return { focus: () => actions.push('combobox') } } } } }
  const { useControlFocus } = controller('../src/composables/useControlFocus.ts', name => { assert.equal(name, 'vue'); return { nextTick: () => Promise.resolve() } })
  const focus = useControlFocus(native, component).focus
  focus(); native.value = null; focus()
  assert.deepEqual(actions, ['native', 'combobox'])
  component.value = null; focus()
})

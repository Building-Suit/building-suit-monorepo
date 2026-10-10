import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const helpers = { exports: {} }
new Function('exports', ts.transpileModule(readFileSync(new URL('../../ux/src/presentation.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(helpers.exports)
function component(file) {
  const { descriptor } = parse(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
  const code = ts.transpileModule(compileScript(descriptor, { id: file, inlineTemplate: true }).content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const globals = { ref: vue.ref, computed: vue.computed, watch: vue.watch, useId: vue.useId }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(name => name === '@building-suit/ux' ? helpers.exports : require(name), module, module.exports, ...Object.values(globals))
  return module.exports.default
}
const stub = tag => ({ inheritAttrs: false, setup: (_, { attrs, slots }) => () => vue.h(tag, attrs, slots.default?.()) })
async function render(file, props, slot) {
  const app = vue.createSSRApp({ render: () => vue.h(component(file), props, slot ? { default: () => slot } : undefined) })
  for (const [name, tag] of Object.entries({ BsButton: 'button', BsLink: 'a', BsInput: 'input', BsGrid: 'div', BsStack: 'div', BsInline: 'div', BsText: 'p', BsStatusBadge: 'span', BsAlert: 'aside', BsStateSurface: 'aside', BsIcon: 'svg', BsFormActions: 'footer', BsSectionHeader: 'header' })) app.component(name, stub(tag))
  app.component('BsLineItemRow', component('molecules/BsLineItemRow.vue'))
  return renderToString(app)
}

const money = (amount, options = {}) => helpers.exports.formatPresentationMoney(amount, { currency: 'USD', ...options })
test('exact money display preserves bigint range, sub-unit signs and currency precision', () => {
  assert.equal(money('9223372036854775807'), '$92,233,720,368,547,758.07')
  assert.equal(money(-1), '-$0.01')
  assert.equal(money(-1, { currencySign: 'accounting' }), '($0.01)')
  assert.equal(money(1, { signDisplay: 'exceptZero' }), '+$0.01')
  assert.equal(money(0, { signDisplay: 'exceptZero' }), '$0.00')
  assert.equal(money('123', { currency: 'JPY' }), '¥123')
  assert.match(money('1234', { currency: 'KWD' }), /1\.234/)
  assert.equal(money('123456789012345678.90', { unit: 'major' }), '$123,456,789,012,345,678.90')
  assert.match(money('1234', { locale: 'ar-EG' }), /12\.34/)
  assert.match(money('1234', { locale: 'ar-EG', numberingSystem: 'arab' }), /١٢٫٣٤/)
  assert.throws(() => money(Number.MAX_SAFE_INTEGER + 1), RangeError)
  assert.throws(() => money('1.234', { unit: 'major' }), RangeError)
})
test('usage display clamps ratios without imposing subscription thresholds', () => {
  assert.equal(helpers.exports.usagePercentage(1, 0), 100)
  assert.equal(helpers.exports.usagePercentage(0, 0), 0)
  assert.equal(helpers.exports.usagePercentage(150, 100), 100)
  assert.equal(helpers.exports.usagePercentage(-5, 100), 0)
  assert.equal(helpers.exports.usagePercentage(4, null), null)
  assert.equal(helpers.exports.usagePercentage(NaN, 100), 0)
})
test('money text owns bidi isolation and opt-in sign tone', async () => {
  const html = await render('atoms/BsMoneyText.vue', { amount: -1, currency: 'USD', signed: true })
  assert.match(html, /dir="ltr"/)
  assert.match(html, /data-tone="danger"/)
  assert.match(html, /-\$0\.01/)
  assert.match(await render('atoms/BsMoneyText.vue', { amount: -1, currency: 'USD' }), /data-tone="neutral"/)
})
test('usage meter announces actual usage and omits progress for unlimited resources', async () => {
  const html = await render('molecules/BsUsageMeter.vue', { item: { id: 'one', label: 'Members', used: 15, limit: 10, valueLabel: '15 / 10', status: 'Exceeded', tone: 'danger' } })
  assert.match(html, /role="progressbar"/)
  assert.match(html, /aria-valuenow="100"/)
  assert.match(html, /aria-valuetext="15 \/ 10"/)
  assert.match(html, /width:100%/)
  assert.doesNotMatch(await render('molecules/BsUsageMeter.vue', { item: { id: 'one', label: 'Members', used: 5, limit: null, valueLabel: 'Unlimited' } }), /progressbar/)
})
test('controlled hierarchy only renders expanded descendants and handles cyclic input', async () => {
  const root = { id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] }
  const props = { nodes: [root], expanded: [], label: 'Hierarchy', expandLabel: 'Expand', collapseLabel: 'Collapse', emptyLabel: 'Empty' }
  assert.doesNotMatch(await render('organisms/BsHierarchyTree.vue', props), />Child</)
  const expanded = await render('organisms/BsHierarchyTree.vue', { ...props, expanded: ['root'] })
  assert.match(expanded, />Child</)
  assert.match(expanded, /aria-expanded="true"/)
  assert.doesNotMatch(expanded, /role="tree"/)
  root.children.push(root)
  assert.equal((await render('organisms/BsHierarchyTree.vue', { ...props, expanded: ['root'] })).match(/>Root</g)?.length, 1)
})
test('import navigation is bounded and pending locks fields and actions', async () => {
  const props = { title: 'Import', steps: [{ id: 'file', label: 'File' }, { id: 'review', label: 'Review' }], step: 'file', nextLabel: 'Next', backLabel: 'Back', canAdvance: true }
  const first = await render('organisms/BsImportWizard.vue', props)
  assert.match(first, /aria-current="step"/)
  assert.doesNotMatch(first, />Back</)
  assert.match(await render('organisms/BsImportWizard.vue', { ...props, pending: true }), /<fieldset disabled/)
  const last = await render('organisms/BsImportWizard.vue', { ...props, step: 'review' })
  assert.doesNotMatch(last, />Next</)
  assert.match(last, />Back</)
})
test('review hides unauthorized actions and pending disables rejection', async () => {
  const props = { title: 'Review', approveLabel: 'Approve', rejectLabel: 'Reject' }
  assert.doesNotMatch(await render('organisms/BsReviewPanel.vue', props), />Approve<|>Reject</)
  const html = await render('organisms/BsReviewPanel.vue', { ...props, canApprove: true, canReject: true, pending: true })
  assert.match(html, /<fieldset[^>]*disabled/)
  assert.match(html, /<button[^>]*disabled[^>]*>Reject</)
})
test('static document table preserves accessible headers and preformatted values', async () => {
  const html = await render('molecules/BsDocumentLines.vue', { label: 'Items', itemLabel: 'Item', quantityLabel: 'Quantity', priceLabel: 'Unit price', totalLabel: 'Total', lines: [{ id: 'one', label: '<unsafe>', quantity: '2', unitPrice: '10.00', total: '20.00' }] })
  assert.match(html, /<caption>Items<\/caption>/)
  assert.match(html, /scope="col"/)
  assert.match(html, /scope="row"/)
  assert.match(html, /&lt;unsafe&gt;/)
  assert.match(html, />20.00</)
})

function mount(file, props) {
  const node = (type, text = '') => ({ type, text, props: {}, children: [], parent: null })
  const renderer = vue.createRenderer({
    createElement: type => node(type), createText: text => node('#text', text), createComment: text => node('#comment', text),
    setText: (target, text) => { target.text = text }, setElementText: (target, text) => { target.text = text; target.children = [] },
    parentNode: target => target.parent, nextSibling: target => target.parent?.children[target.parent.children.indexOf(target) + 1] || null,
    patchProp: (target, key, _previous, value) => { target.props[key] = value },
    insert(target, parent, anchor = null) {
      if (target.parent) target.parent.children.splice(target.parent.children.indexOf(target), 1)
      target.parent = parent
      const index = anchor ? parent.children.indexOf(anchor) : -1
      if (index < 0) parent.children.push(target)
      else parent.children.splice(index, 0, target)
    },
    remove(target) { target.parent?.children.splice(target.parent.children.indexOf(target), 1) },
  })
  const root = node('root')
  const app = renderer.createApp(component(file), props)
  for (const [name, tag] of Object.entries({ BsButton: 'button', BsLink: 'a', BsInput: 'input', BsText: 'p', BsStatusBadge: 'span', BsAlert: 'aside', BsStateSurface: 'aside', BsIcon: 'svg', BsFileInput: 'input', BsStack: 'div', BsSelect: 'select' })) app.component(name, stub(tag))
  app.component('BsField', { setup: (_, { slots }) => () => vue.h('label', {}, slots.default?.({ describedby: 'field-help' })) })
  app.mount(root)
  function find(predicate) {
    const values = []
    function visit(target) { if (predicate(target)) values.push(target); target.children.forEach(visit) }
    visit(root)
    return values
  }
  return { app, find }
}

test('file drop preserves existing selection on non-file drops and refuses disabled selection', () => {
  const updates = []
  const current = { name: 'current.csv' }
  const next = { name: 'next.csv' }
  const enabled = mount('molecules/BsFileDrop.vue', { label: 'File', modelValue: current, 'onUpdate:modelValue': value => updates.push(value) })
  const drop = enabled.find(target => target.props.onDrop)[0].props.onDrop
  drop({ preventDefault() {}, dataTransfer: { files: [] } })
  assert.equal(updates.length, 0)
  drop({ preventDefault() {}, dataTransfer: { files: [next] } })
  assert.equal(updates[0], next)
  enabled.app.unmount()
  const locked = mount('molecules/BsFileDrop.vue', { label: 'File', disabled: true, 'onUpdate:modelValue': value => updates.push(value) })
  locked.find(target => target.props.onDrop)[0].props.onDrop({ preventDefault() {}, dataTransfer: { files: [current] } })
  assert.equal(updates.length, 1)
  locked.app.unmount()
})

test('hierarchy expansion emits intent without mutating controlled product input', () => {
  const expanded = []
  const changes = []
  const tree = mount('organisms/BsHierarchyTree.vue', { nodes: [{ id: 'root', label: 'Root', children: [{ id: 'child', label: 'Child' }] }], expanded, label: 'Tree', expandLabel: 'Expand', collapseLabel: 'Collapse', emptyLabel: 'Empty', 'onUpdate:expanded': value => changes.push(value) })
  tree.find(target => target.props['aria-label'] === 'Expand: Root')[0].props.onClick()
  assert.deepEqual(changes, [['root']])
  assert.deepEqual(expanded, [])
  tree.app.unmount()
})

test('column mapping prevents duplicate source selection when requested and emits immutable updates', () => {
  const initial = { first: 'name', second: null }
  const updates = []
  const mapping = mount('molecules/BsColumnMapping.vue', { modelValue: initial, fields: [{ key: 'first', label: 'First', required: true }, { key: 'second', label: 'Second' }], columns: [{ label: 'Name', value: 'name' }], exclusiveColumns: true, 'onUpdate:modelValue': value => updates.push(value) })
  const selects = mapping.find(target => target.type === 'select')
  assert.equal(selects[0].props.options[0].disabled, false)
  assert.equal(selects[1].props.options[0].disabled, true)
  assert.equal(selects[0].props['aria-required'], true)
  assert.equal(selects[1].props['show-clear'], true)
  selects[1].props['onUpdate:modelValue']('reference')
  assert.deepEqual(updates, [{ first: 'name', second: 'reference' }])
  assert.deepEqual(initial, { first: 'name', second: null })
  mapping.app.unmount()
})

test('catalogue-driven line editing can suppress addition while retaining the existing rows', async () => {
  const props = { items: [{ id: 'one' }], label: 'Cart', addLabel: 'Add line', removeLabel: 'Remove', rowLabel: () => 'Existing item' }
  const hidden = await render('organisms/BsLineItemsEditor.vue', { ...props, showAdd: false })
  assert.doesNotMatch(hidden, />Add line</)
  assert.match(hidden, /Existing item/)
  assert.match(await render('organisms/BsLineItemsEditor.vue', props), />Add line</)
})

test('print documents retain paper choice and language direction in shared presentation', async () => {
  const html = await render('templates/BsPrintableDocument.vue', { label: 'Receipt', format: 'a4', dir: 'rtl', lang: 'ar' }, 'Issued snapshot')
  assert.match(html, /data-format="a4"/)
  assert.match(html, /dir="rtl"/)
  assert.match(html, /lang="ar"/)
  assert.match(html, /Issued snapshot/)
  const css = readFileSync(new URL('../src/styles/base.css', import.meta.url), 'utf8')
  assert.match(css, /@page bs-receipt \{ size: 80mm auto/)
  assert.match(css, /@page bs-a4 \{ size: A4/)
})

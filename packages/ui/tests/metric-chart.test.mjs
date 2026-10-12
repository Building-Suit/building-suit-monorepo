import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { createSSRApp, h, computed } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ts from 'typescript'
const require = createRequire(import.meta.url)
const { descriptor } = parse(readFileSync(new URL('../src/organisms/BsMetricChart.vue', import.meta.url), 'utf8'))
const script = compileScript(descriptor, { id: 'metric-chart', inlineTemplate: true })
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', 'computed', compiled)(require, module, module.exports, computed)
async function render(items, kind = 'bars') {
  const app = createSSRApp({ render: () => h(module.exports.default, { title: 'Actual collections', emptyLabel: 'No records', items, kind }) })
  for (const name of ['BsCard', 'BsInline', 'BsHeading', 'BsLink']) app.component(name, { setup: (_, { slots }) => () => h('div', slots.default?.()) })
  return renderToString(app)
}
test('chart preserves signed money and refund hints, with finite negative-bar geometry', async () => {
  const html = await render([{ id: 'cash', label: 'Cash', hint: 'Collected 10 · refunded 15', value: -5, formatted: '-EGP 5' }, { id: 'card', label: 'Card', hint: '', value: 0, formatted: 'EGP 0' }])
  assert.match(html, /-EGP 5/); assert.match(html, /refunded 15/); assert.match(html, /data-negative="true"/)
  assert.doesNotMatch(html, /NaN|Infinity/)
})
test('donut uses actual positive values, while zero or negative totals keep textual values and bars', async () => {
  const positive = await render([{ id: 'p', label: 'Products', hint: '', value: 30, formatted: 'EGP 30' }, { id: 's', label: 'Services', hint: '', value: 10, formatted: 'EGP 10' }], 'donut')
  assert.match(positive, /conic-gradient/); assert.match(positive, /75%/); assert.match(positive, /EGP 10/)
  for (const value of [0, -10]) { const html = await render([{ id: 'p', label: 'Products', hint: '', value, formatted: `EGP ${value}` }], 'donut'); assert.doesNotMatch(html, /conic-gradient|NaN|Infinity/); assert.match(html, new RegExp(`EGP ${value}`)) }
})
test('empty records show an empty state rather than a synthetic chart', async () => {
  const html = await render([], 'donut'); assert.match(html, /No records/); assert.doesNotMatch(html, /conic-gradient/)
})

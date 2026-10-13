import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { computed, createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function component(file) {
  const { descriptor } = parse(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: file, inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }; new Function('require', 'module', 'exports', 'computed', code)(require, module, module.exports, computed)
  return module.exports.default
}
async function grid(plans, variant = 'shop') {
  const app = createSSRApp({ render: () => h(component('organisms/BsPlanGrid.vue'), { plans, variant, copy: { included: 'Included', notIncluded: 'Not included' } }) })
  app.component('BsPlanCard', { props: ['plan', 'featured'], setup: props => () => h('article', { 'data-featured': String(props.featured) }, props.plan.name) })
  return renderToString(app)
}
test('Shop marketing emphasis stays on the promoted plan independently of current or chosen state', async () => {
  const html = await grid([{ id: 'solo', name: 'Solo', selected: true }, { id: 'team', name: 'Team', promoted: true }, { id: 'multi', name: 'Multi', badgeTone: 'current' }])
  assert.match(html, /data-featured="false"[^>]*>Solo/)
  assert.match(html, /data-featured="true"[^>]*>Team/)
  assert.match(html, /data-featured="false"[^>]*>Multi/)
  const unpromoted = await grid([{ id: 'solo', name: 'Solo', selected: true }, { id: 'team', name: 'Team', badgeTone: 'current' }])
  assert.doesNotMatch(unpromoted, /data-featured="true"/)
  const plain = await grid([{ id: 'solo', name: 'Solo', promoted: true }, { id: 'team', name: 'Team' }], 'default')
  assert.doesNotMatch(plain, /data-featured="true"/)
})
test('shared card keeps exact supplied price, entitlements, Solo options and action state', async () => {
  const plan = { id: 'solo', name: 'Solo', price: 'EGP 123', priceNote: 'Annual term', variant: { value: 'solo_2', legend: 'Members', options: [{ value: 'solo_1', label: '1 member' }, { value: 'solo_2', label: '2 members' }] }, features: [{ key: 'members', text: '2 members', included: true }], action: { label: 'Selected', pressed: true, disabled: true } }
  const app = createSSRApp({ render: () => h(component('organisms/BsPlanCard.vue'), { plan, variant: 'shop', featured: true, copy: { included: 'Included', notIncluded: 'Not included' } }) })
  app.component('NuxtLink', { setup: (_, { slots }) => () => h('a', slots.default?.()) })
  app.component('BsPlanStatus', { render: () => null })
  app.component('BsCard', { setup: (_, { slots }) => () => h('article', slots.default?.()) })
  app.component('BsBillingCycleToggle', { props: ['options'], setup: props => () => h('fieldset', props.options.map(option => h('span', option.label))) })
  app.component('BsPlanFeatureList', { props: ['features'], setup: props => () => h('ul', props.features.map(feature => h('li', feature.text))) })
  app.component('BsButton', { props: ['disabled', 'ariaPressed'], setup: (props, { slots }) => () => h('button', { disabled: props.disabled, 'aria-pressed': props.ariaPressed }, slots.default?.()) })
  const html = await renderToString(app); assert.match(html, /EGP 123/); assert.match(html, /Annual term/); assert.match(html, /1 member/); assert.match(html, /2 members/); assert.match(html, /disabled aria-pressed="true"[^>]*>Selected/)
})

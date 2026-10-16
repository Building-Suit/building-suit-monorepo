import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import * as vue from 'vue'
import { renderToString } from 'vue/server-renderer'
import ts from 'typescript'
import * as contracts from '../../contracts/src/changelog.ts'
const require = createRequire(import.meta.url)
function load(file) {
  const { descriptor } = parse(readFileSync(new URL(`../src/${file}.vue`, import.meta.url), 'utf8'))
  const source = compileScript(descriptor, { id: file, inlineTemplate: true }).content
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  new Function('require', 'module', 'exports', code)(name => name === '@building-suit/contracts' ? contracts : require(name), module, module.exports)
  return module.exports.default
}
const Timeline = load('organisms/BsChangelogTimeline'), Card = load('molecules/BsChangelogCard')
const text = { en: 'Same sentence', ar: 'الجملة نفسها' }
const base = { suit: 'shop-suit', visibility: 'public', publishedAt: '2026-10-10T00:00:00Z', title: text, summary: text, details: text, links: [] }
const released = { ...base, id: 'released', status: 'released', version: '1.2.3', releasedAt: '2026-10-09T00:00:00Z' }
const upcoming = { ...base, id: 'upcoming', status: 'coming-soon', targetVersion: '9.9.9' }
const feed = { serverNow: '2026-10-11T00:00:00Z', suits: [{ id: 'shop-suit', name: text }], entries: [upcoming, ...Array.from({ length: 5 }, (_, i) => ({ ...released, id: `released-${i}` }))] }
const copy = { timeline: 'Changelog', status: 'Release status', released: 'Released', comingSoon: 'Coming Soon', releasedAt: 'Released' }
async function render(component, props) {
  const app = vue.createSSRApp({ render: () => vue.h(component, props) })
  for (const name of ['BsText', 'BsHeading', 'BsStack', 'BsSelect', 'BsSelectOption', 'BsStateSurface', 'BsLink']) app.component(name, { setup: (_, { slots }) => () => vue.h('div', slots.default?.()) })
  app.component('BsStatusBadge', { props: ['label'], setup: props => () => vue.h('span', props.label) })
  app.component('BsTabs', { props: ['modelValue', 'tabs'], setup: props => () => vue.h('nav', { 'data-selected': props.modelValue }, props.tabs.map(t => vue.h('button', t.label))) })
  app.component('BsTimeline', { props: ['entries'], setup: (props, { slots }) => () => vue.h('div', props.entries.map(entry => slots.default({ entry }))) })
  app.component('BsChangelogCard', Card)
  return renderToString(app)
}
for (const locale of ['en', 'ar']) {
  test(`${locale}: released default, entry limit, direction and linked panel`, async () => {
    const html = await render(Timeline, { feed, copy, locale, suit: 'shop-suit', releaseLimit: 3 })
    assert.equal((html.match(/<article/g) ?? []).length, 3)
    assert.match(html, /data-selected="released"/)
    assert.match(html, /role="tabpanel"/)
    assert.match(html, new RegExp(`dir="${locale === 'ar' ? 'rtl' : 'ltr'}"`))
    assert.doesNotMatch(html, /data-entry="upcoming"|9\.9\.9/)
  })
  test(`${locale}: actual release date/version and duplicate suppression`, async () => {
    const html = await render(Card, { entry: released, locale, copy, suitName: 'Shop', isNew: false })
    assert.match(html, /1\.2\.3/)
    assert.match(html, /2026-10-09T00:00:00Z/)
    assert.doesNotMatch(html, /2026-10-10T00:00:00Z/)
    assert.equal(html.split(text[locale]).length - 1, 1)
    const soon = await render(Card, { entry: upcoming, locale, copy, suitName: 'Shop', isNew: false })
    assert.match(soon, /Coming Soon/)
    assert.doesNotMatch(soon, /9\.9\.9|<time|2026-10/)
  })
}
test('curated public EN/AR fields have distinct copy', () => {
  const items = JSON.parse(readFileSync(new URL('../../../release-changes/items.json', import.meta.url)))
  for (const item of items.filter(item => item.disposition === 'public')) for (const locale of ['en', 'ar']) {
    assert.equal(new Set(['title', 'summary', 'details'].map(key => item.notes[key][locale])).size, 3, `${item.id}/${locale}`)
  }
})

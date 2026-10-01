import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function component(file, language = 'en') {
  const { descriptor } = parse(readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8'))
  const script = compileScript(descriptor, { id: file, inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const copy = language === 'ar' ? { close: 'إغلاق', saving: 'جارٍ الحفظ…', search: 'بحث', empty: 'لا توجد سجلات' } : { close: 'Close', saving: 'Saving…', search: 'Search', empty: 'No records found' }
  const globals = { ref: vue.ref, watch: vue.watch, nextTick: vue.nextTick, useId: vue.useId, useAttrs: vue.useAttrs, useToasts: () => ({ toasts: vue.ref([{ id: 1, title: 'Saved', tone: 'success' }]), dismiss: () => {} }), useUiCopy: () => key => copy[key] }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(require, module, module.exports, ...Object.values(globals))
  return module.exports.default
}
async function render(file, props, slot, language) {
  const app = vue.createSSRApp({ render: () => vue.h(component(file, language), props, slot ? () => slot : undefined) })
  app.component('AppIcon', { render: () => vue.h('svg', { 'aria-hidden': 'true' }) })
  app.config.globalProperties.$primevue = { config: { unstyled: true, locale: { emptySelectionMessage: 'No selection', selectionMessage: '{0} selected' } } }
  return renderToString(app)
}

test('PrimeVue button defaults safely and preserves explicit submit/label/disabled semantics', async () => {
  const button = await render('atoms/BsButton.vue', { 'aria-label': 'Remove line', pending: true, disabled: false }, 'Remove')
  assert.match(button, /type="button"/)
  assert.match(button, /aria-label="Remove line"/)
  assert.match(button, /aria-busy="true"/)
  assert.match(button, / disabled/)
  assert.match(button, /ls-btn/)
  assert.match(await render('atoms/BsButton.vue', { type: 'submit' }, 'Save'), /type="submit"/)
})

for (const language of ['en', 'ar']) test(`form and select provide localized accessible markup (${language})`, async () => {
  const html = await render('organisms/BsForm.vue', { pending: true, error: 'Check value', class: 'grid gap-4' }, vue.h('input', { required: true, 'aria-label': 'Value' }), language)
  assert.match(html, /aria-busy="true"/)
  assert.match(html, /role="alert" tabindex="-1"/)
  const summaryId = html.match(/<p id="([^"]+)"/)?.[1]
  assert.ok(summaryId)
  assert.ok(html.includes(`aria-describedby="${summaryId}"`))
  assert.match(html, /<fieldset[^>]* disabled[^>]* inert/)
  assert.match(html, /grid gap-4/)
  assert.doesNotMatch(html, /<form[^>]*class="[^"]*grid/)
  assert.ok(html.includes(language === 'ar' ? 'جارٍ الحفظ…' : 'Saving…'))
  const picker = await render('molecules/BsSelect.vue', { modelValue: 'x', label: language === 'ar' ? 'الصنف' : 'Item', options: [{ id: 'x', name: 'Chosen' }], optionLabel: 'name', optionValue: 'id', virtual: true }, null, language)
  assert.match(picker, /role="combobox"/)
  assert.match(picker, /aria-label="(?:الصنف|Item)"/)
  assert.match(picker, /Chosen/)
  const toast = await render('organisms/ToastHost.vue', {}, null, language)
  assert.match(toast, /role="status"/); assert.match(toast, /Saved/)
  assert.match(toast, /aria-label="(?:إغلاق|Close)"/)
})

test('critical pattern text and focus colors meet contrast targets in both themes', () => {
  const tokens = JSON.parse(readFileSync(new URL('../../design-tokens/tokens.json', import.meta.url), 'utf8'))
  function color(path) {
    const value = path.split('.').reduce((node, key) => node[key], tokens).value
    return value.startsWith('{') ? color(value.slice(1, -1)) : value
  }
  function luminance(hex) {
    return hex.slice(1).match(/../g).map(value => Number.parseInt(value, 16) / 255)
      .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
      .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
  }
  function contrast(first, second) {
    const a = luminance(color(first)); const b = luminance(color(second))
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  }
  for (const mode of ['light', 'dark']) {
    const role = `color.role.${mode}`
    assert.ok(contrast(`${role}.text`, `${role}.surface`) >= 4.5)
    assert.ok(contrast(`${role}.textOnPrimary`, `${role}.primary`) >= 4.5)
    assert.ok(contrast(`${role}.focusRing`, `${role}.surface`) >= 3)
    assert.ok(contrast(`${role}.focusRing`, `${role}.surfaceMuted`) >= 3)
    for (const status of ['error', 'success', 'warning']) {
      assert.ok(contrast(`${role}.text`, `color.semantic.${status}Bg${mode === 'dark' ? 'Dark' : ''}`) >= 4.5)
    }
  }
  assert.ok(contrast('color.role.dark.focusRing', 'color.brand.buildingNavy') >= 3)
  assert.ok(contrast('color.role.dark.focusRing', 'color.brand.deepStructureNavy') >= 3)
})

const workspaceRoot = new URL('../../../', import.meta.url).pathname

function vueFiles(directory) {
  if (!existsSync(directory)) return []
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? vueFiles(target) : entry.name.endsWith('.vue') ? [target] : []
  })
}

test('every dynamically discovered Suit local component has one approved ownership classification', () => {
  const appsDirectory = path.join(workspaceRoot, 'apps')
  const suits = readdirSync(appsDirectory, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && entry.name.endsWith('-suit'))
    .map(entry => entry.name)
    .sort()
  assert.ok(suits.includes('automation-suit'))
  const actual = suits.flatMap(suit => vueFiles(path.join(appsDirectory, suit, 'app/components')))
    .map(file => path.relative(workspaceRoot, file).replaceAll(path.sep, '/')).sort()
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'docs/shared/ui-ownership-manifest.json'), 'utf8'))
  const classified = manifest.components.map(component => component.path).sort()
  assert.deepEqual(classified, actual)
  assert.ok(manifest.components.every(component => component.approval && component.rationale))
})

test('shared UI exports are explicit and cover every governed source', () => {
  const manifest = JSON.parse(readFileSync(path.join(workspaceRoot, 'packages/ui/package.json'), 'utf8'))
  assert.ok(Object.keys(manifest.exports).every(key => !key.includes('*')))
  assert.ok(Object.values(manifest.exports).every(target => typeof target === 'string' && !target.includes('*')))
  const components = vueFiles(path.join(workspaceRoot, 'packages/ui/src'))
    .map(file => `./${path.relative(path.join(workspaceRoot, 'packages/ui'), file).replaceAll(path.sep, '/')}`)
  assert.deepEqual(Object.values(manifest.exports).sort(), [...components, './src/styles/base.css'].sort())
})

import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'
import * as vue from 'vue'

async function pageScript(file, exports, rpc) {
  const source = (await readFile(new URL(`../../app/pages/${file}`, import.meta.url), 'utf8')).match(/<script setup lang="ts">([\s\S]*?)<\/script>/)[1]
  const code = ts.transpileModule(`${source}\nreturn { ${exports.join(', ')} }`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const downloads = []
  const toasts = []
  const context = { active: true }
  const currentId = vue.ref('shop-a')
  const globals = {
    ref: vue.ref, computed: vue.computed, watch: vue.watch, definePageMeta: () => {}, useRoute: () => ({ query: {} }),
    useSupabaseClient: () => ({ schema: () => ({ rpc }) }),
    useShop: () => ({ current: vue.ref({ id: 'shop-a' }), currentId, activeLocations: vue.ref([]), loading: vue.ref(false) }),
    useI18n: () => ({ locale: vue.ref('en') }),
    useShopTaskScope: () => () => () => context.active,
    useRecordAction: () => ({
      visible: vue.ref(false), pending: vue.ref(false), dirty: vue.ref(false), complete: () => {},
    }),
    useConfirmation: () => ({ ask: async () => false }),
    useToasts: () => ({ push: toast => toasts.push(toast) }), refreshNuxtData: async () => {},
    useAsyncData: (key, handler, options) => ({
      data: vue.ref(typeof key === 'function' && key().includes('report-access') ? { 'reports.view': true, 'reports.cost_profit.view': true } : options.default()),
      pending: vue.ref(false), error: vue.ref(null), refresh: async () => {},
    }),
  }
  const scope = vue.effectScope()
  const imported = { downloadCsv: (...args) => downloads.push(args), encodeCsv: (headers, rows) => ({ headers, rows }), importTemplates: { products: [] } }
  const result = scope.run(() => new Function('require', 'exports', ...Object.keys(globals), code)(() => imported, {}, ...Object.values(globals)))
  return { ...result, scope, downloads, context, currentId, toasts }
}
const deferred = () => {
  let resolve
  const promise = new Promise(done => { resolve = done })
  return { promise, resolve }
}

test('report export freezes its query, pages all rows and uses the original columns', async () => {
  const calls = []
  const f = await pageScript('reports/index.vue', ['exportReport', 'report', 'locationId'], async (_, args) => {
    calls.push(args)
    return { data: { total: 501, items: Array.from({ length: args.p_page === 1 ? 500 : 1 }, () => ({ amount: 10 })) } }
  })
  try {
    await f.exportReport()
    assert.deepEqual(calls.map(call => call.p_page), [1, 2])
    assert.ok(calls.every(call => call.p_shop_id === 'shop-a' && call.p_report === 'sales' && call.p_page_size === 500))
    assert.equal(f.downloads[0][1].rows.length, 501)
  } finally { f.scope.stop() }
})

test('changing report filters and returning to the original filter still cancels the old export', async () => {
  const gate = deferred()
  const f = await pageScript('reports/index.vue', ['exportReport', 'report', 'exporting'], () => gate.promise)
  try {
    const pending = f.exportReport()
    assert.equal(f.exporting.value, true)
    f.report.value = 'expenses'; f.report.value = 'sales'
    gate.resolve({ data: { items: [{ amount: 10 }], total: 1 } })
    await pending
    assert.deepEqual(f.downloads, [])
    assert.equal(f.exporting.value, false)
  } finally { f.scope.stop() }
})

test('context disposal suppresses a delayed report download and stale error feedback', async () => {
  const gate = deferred()
  const f = await pageScript('reports/index.vue', ['exportReport', 'exportError'], () => gate.promise)
  try {
    const pending = f.exportReport()
    f.context.active = false
    gate.resolve({ error: new Error('private backend detail') })
    await pending
    assert.deepEqual(f.downloads, [])
    assert.equal(f.exportError.value, '')
  } finally { f.scope.stop() }
})

test('barcode export goes past twenty pages using the catalog RPC maximum and does not stop on sparse label pages', async () => {
  const calls = []
  const f = await pageScript('catalog-import.vue', ['exportLabels'], async (_, args) => {
    calls.push(args)
    return { data: { items: args.p_page % 2 ? [{ name: 'Label', salePrice: 10 }] : [], total: 2101 } }
  })
  try {
    await f.exportLabels()
    assert.equal(calls.length, 22)
    assert.ok(calls.every(call => call.p_page_size === 100 && call.p_shop_id === 'shop-a'))
    assert.equal(f.downloads[0][1].rows.length, 11)
  } finally { f.scope.stop() }
})

test('import cancellation performs no write and releases the pending lock', async () => {
  let calls = 0
  const f = await pageScript('catalog-import.vue', ['runImport', 'rows', 'pending'], async () => { calls++; return {} })
  try {
    f.rows.value = [{ name: 'Product', sale_price: 100 }]
    await f.runImport(false)
    assert.equal(calls, 0)
    assert.equal(f.pending.value, false)
  } finally { f.scope.stop() }
})

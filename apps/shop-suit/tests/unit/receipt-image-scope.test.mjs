import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'
import { effectScope, ref, reactive, watch, nextTick, onScopeDispose } from 'vue'

const source = (await readFile(new URL('../../app/composables/useSaleReceiptShare.ts', import.meta.url), 'utf8')).replaceAll('import.meta.client', 'true')
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText

function fixture(render) {
  const merchant = ref('shop-1'), location = ref('branch-1'), params = reactive({ id: 'sale-1' })
  const writes = [], downloads = [], toasts = []
  const modules = {
    '@building-suit/ui/utils/receiptDocument': { renderReceiptDocument: () => '<article>Receipt</article>' },
    '~/utils/receiptPresentation': { projectReceipt: () => ({ view: {}, copy: {} }) },
    '@building-suit/ux': {
      renderDocumentImage: render,
      copyDocumentImage: async render => { writes.push(await render()) },
      downloadDocumentImage: async (render, filename) => { downloads.push({ blob: await render(), filename }) },
    },
  }
  const exports = {}
  new Function('exports', 'require', 'ref', 'watch', 'onScopeDispose', 'useI18n', 'useToasts', 'useShop', 'useRoute', 'useReceiptTranslation', compiled)(
    exports, name => { assert.ok(modules[name], name); return modules[name] }, ref, watch, onScopeDispose,
    () => ({ t: key => key, locale: ref('en') }), () => ({ push: value => toasts.push(value) }),
    () => ({ currentId: merchant, currentLocationId: location }), () => ({ params }), () => key => key,
  )
  const scope = effectScope()
  const controller = scope.run(() => exports.useSaleReceiptShare())
  return { controller, scope, merchant, location, params, writes, downloads, toasts }
}

for (const change of ['merchant', 'location', 'receipt', 'unmount']) test(`pending receipt image and fallback do not survive ${change} changes`, async () => {
  let complete
  const f = fixture(() => new Promise(resolve => { complete = resolve }))
  const pending = f.controller.shareReceipt({ invoiceNumber: 'SALE-1' })
  assert.equal(f.controller.sharing.value, true)
  if (change === 'merchant') f.merchant.value = 'shop-2'
  if (change === 'location') f.location.value = 'branch-2'
  if (change === 'receipt') f.params.id = 'sale-2'
  if (change === 'unmount') f.scope.stop()
  await nextTick()
  complete(new Blob(['png'], { type: 'image/png' }))
  await pending
  await f.controller.downloadReceiptImage()
  assert.deepEqual(f.writes, [])
  assert.deepEqual(f.downloads, [])
  assert.deepEqual(f.toasts, [])
  assert.equal(f.controller.sharing.value, false)
  assert.equal(f.controller.shareError.value, '')
  f.scope.stop()
})

test('current receipt completes normally and context changes clear its download fallback', async () => {
  const f = fixture(async () => new Blob(['png'], { type: 'image/png' }))
  await f.controller.shareReceipt({ invoiceNumber: 'SALE-1' })
  assert.equal(f.writes.length, 1)
  assert.equal(f.toasts.length, 1)
  await f.controller.downloadReceiptImage()
  assert.equal(f.downloads[0].filename, 'SALE-1')
  f.params.id = 'sale-2'
  await nextTick()
  await f.controller.downloadReceiptImage()
  assert.equal(f.downloads.length, 1)
  f.scope.stop()
})

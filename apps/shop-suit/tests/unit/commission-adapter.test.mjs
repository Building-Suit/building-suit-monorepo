import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { parse } from '@vue/compiler-sfc'
import ts from 'typescript'

test('commission draft loader uses the two-argument RPC and retains attribution rows across tenant changes', async () => {
  const source = await readFile(new URL('../../app/pages/commissions.vue', import.meta.url), 'utf8')
  const { descriptor } = parse(source)
  const compiled = ts.transpileModule(descriptor.scriptSetup.content, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText.replace(/^export \{\};?$/gm, '')
  const shop = { value: 'shop-A' }
  const route = { query: { sale: 'draft-A' } }
  let loader
  const calls = []
  const rpc = {
    async rpc(name, args) {
      calls.push({ name, args: { ...args } })
      if (name === 'commission_history') return { data: { policy: { policy: { enabled: false, employees: [] } }, members: [], lines: [], totalCount: 0 }, error: null }
      assert.equal(name, 'commission_assignment_context')
      // PostgREST selects a function by its named arguments, not just its name.
      // An extra pagination key cannot resolve the deployed two-argument RPC.
      if (Object.keys(args).sort().join(',') !== 'p_invoice_id,p_shop_id') {
        return { data: null, error: { code: 'PGRST202' } }
      }
      return { data: { lines: [{ id: args.p_invoice_id, name: 'Draft line', itemType: 'product', membershipId: null, appointmentId: null, appointments: [] }] }, error: null }
    },
  }
  vm.runInNewContext(compiled, {
    definePageMeta() {},
    useShop: () => ({ currentId: shop, businessCurrency: { value: 'EGP' } }),
    useI18n: () => ({ locale: { value: 'en' } }),
    useRoute: () => route,
    useSupabaseClient: () => ({ schema: () => rpc }),
    ref: value => ({ value }),
    computed: get => ({ get value() { return get() } }),
    watch() {},
    useRecordAction: () => ({ visible: { value: false }, dirty: { value: false }, complete() {} }),
    useAsyncData(key, load) {
      loader = load
      return { data: { value: null }, pending: { value: false }, error: { value: null }, refresh() {} }
    },
  }, { filename: 'commissions-page-loader.js' })
  const first = await loader()
  assert.equal(first.assignments.length, 1)
  assert.equal(first.assignments[0].id, 'draft-A')
  shop.value = 'shop-B'
  route.query.sale = 'draft-B'
  const second = await loader()
  assert.equal(second.assignments[0].id, 'draft-B')
  const contexts = calls.filter(call => call.name === 'commission_assignment_context')
  assert.deepEqual(contexts.map(call => call.args), [
    { p_shop_id: 'shop-A', p_invoice_id: 'draft-A' },
    { p_shop_id: 'shop-B', p_invoice_id: 'draft-B' },
  ])
})

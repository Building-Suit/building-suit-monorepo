import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'
import ts from 'typescript'
import { useDebouncedChange } from '../../../../packages/ux/src/composables/useDebouncedChange.ts'
import { usePointOfSaleKeyboard } from '../../../../packages/ux/src/composables/usePointOfSaleKeyboard.ts'

const require = createRequire(import.meta.url)
const service = { id: 'service-1', name: 'Haircut', itemType: 'service', unitPrice: 100, discount: 0, stock: null, sku: null, barcode: null }

function component(file, globals) {
  const { descriptor } = parse(readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: file.pathname, inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText.replaceAll('import.meta.client', 'false').replaceAll('import.meta.server', 'true')
  const module = { exports: {} }
  const localRequire = name => {
    if (name.startsWith('#shared/')) return require(new URL(`../../shared/${name.slice(8)}.ts`, import.meta.url).pathname)
    if (!name.startsWith('~/')) return require(name)
    const extension = /\/(businessMode|shopCommandErrorMessage|tradePricing|scaleCaptureCopy|commodityPricingCopy)$/.test(name) ? '.ts' : /\/(pos|posCustomer|saleCopy)$/.test(name) ? '.js' : ''
    return require(new URL(`../../app/${name.slice(2)}${extension}`, import.meta.url).pathname)
  }
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(localRequire, module, module.exports, ...Object.values(globals))
  return module.exports.default
}

for (const customerId of ['customer-1', null]) test(`SSR locks appointment customer context before hydration (${customerId ?? 'walk-in'})`, async () => {
  const context = {
    staff: [{ id: 'membership-1', name: 'Barber' }], customers: [],
    appointments: [{ id: 'appointment-1', staffId: 'membership-1', customerId, customerName: 'Booked customer', startsAt: '2026-10-09T10:00:00Z', status: 'arrived', service }],
  }
  const globals = {
    useId: vue.useId, useDebouncedChange, usePointOfSaleKeyboard, ref: vue.ref, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick,
    onMounted: vue.onMounted, onBeforeUnmount: vue.onBeforeUnmount,
    definePageMeta: () => {}, useRoute: () => ({ query: { appointment: 'appointment-1' } }),
    // Realtime registers only on the client; this fixture exercises initial SSR.
    useShopRealtime: () => {},
    useShopTaskScope: () => () => () => true,
    preloadRouteComponents: async () => {},
    useOfflineCounter: () => ({ online: vue.ref(true), ready: vue.ref(false), scope: vue.ref(''), busy: vue.ref(false), records: vue.ref([]), shiftClosing: vue.ref(false), cached: async () => null, cache: async () => {}, retry: async () => {} }),
    useOfflineCounterView: () => vue.ref(undefined),
    // This appointment fixture isolates the service-only POS projection. The
    // optional hardware adapter remains closed and unavailable in that mode.
    useScaleCounter: () => ({ open:vue.ref(false),form:vue.ref({profileId:'',productId:''}),view:vue.ref({available:false}),copy:vue.ref({}),...Object.fromEntries(['show','profile','product','query','more','retry','connect','disconnect','read','tare','submit'].map(name=>[name,()=>{}])) }),
    useSaleTaxQuote: () => ({ data: vue.ref({ total: 100, tax: 0, net: 100, calculationEnabled: false, lines: [] }), pending: vue.ref(false), error: vue.ref(null) }),
    useCatalogMedia: () => ({ request: (_action, _args, fallback) => fallback() }),
    useI18n: () => ({ locale: vue.ref('en'), t: key => key }),
    useConfirmation: () => ({ current: vue.ref(null), ask: async () => false }), useToasts: () => ({ push: () => {} }),
    useShop: () => ({ businessCurrency: vue.ref('EGP'), current: vue.ref({ business_mode: 'service' }), currentId: vue.ref('shop-1'), currentLocationId: vue.ref('location-1'), currentLocation: vue.ref({ name: 'Main' }), currentMembership: vue.ref({ id: 'membership-1' }), loading: vue.ref(false) }),
    reactive: vue.reactive,
    useSupabaseUser: () => vue.ref({ id: 'owner-1' }),
    useShopInvalidation: () => ({ refreshShopQueries: async () => {}, clearShopQueries: () => {} }),
    usePosReceipt: () => ({ visible: vue.ref(false), recentOpen: vue.ref(false), open: () => {}, completed: async () => {}, overlay: { open: vue.ref(false) }, view: vue.ref({}) }),
    useShopClient: () => ({ schema: () => ({ rpc: async name => ({ data: name === 'pos_checkout_context' ? context : name === 'list_catalog_categories' ? [] : { items: [service], total: 1, pageSize: 30 }, error: null }) }) }),
    // Match Nuxt's SSR contract: data starts at its default, is populated during
    // server prefetch, and the returned promise can be awaited by page setup.
    useShopQuery: (key, handler, options) => {
      const data = vue.shallowRef(options.default()), pending = vue.ref(options.server !== false), error = vue.ref(null)
      const promise = options.server === false ? Promise.resolve() : Promise.resolve().then(handler).then(value => { data.value = value; pending.value = false })
      vue.onServerPrefetch(() => promise)
      const result = { data, pending, isLoading: pending, error, refresh: () => promise, ensure: () => promise }
      return Object.assign(promise.then(() => result), result)
    },
  }
  const app = vue.createSSRApp(component(new URL('../../app/pages/pos.vue', import.meta.url), globals))
  let projection
  const sharedPage = component(new URL('../../../../packages/ui/src/templates/BsPointOfSalePage.vue', import.meta.url), globals)
  app.component('BsPointOfSalePage', { ...sharedPage, setup(props, context) { projection = props; return sharedPage.setup(props,context) } })
  app.component('BsButton', component(new URL('../../../../packages/ui/src/atoms/BsButton.vue', import.meta.url), globals))
  // Render the shared field and repeating-row owners so scoped slots receive
  // their real contract; unresolved custom elements cannot emulate that API.
  for (const path of ['organisms/BsPointOfSaleCart', 'molecules/BsQuantityStepper', 'organisms/BsLineItemsEditor', 'molecules/BsLineItemRow', 'molecules/BsField', 'atoms/BsText']) {
    app.component(path.split('/')[1], component(new URL(`../../../../packages/ui/src/${path}.vue`, import.meta.url), globals))
  }
  app.component('BsSelect', { props: ['disabled'], setup: (props, { slots }) => () => vue.h('div', { role: 'combobox', 'aria-disabled': props.disabled }, slots.value?.()) })
  app.component('NuxtLink', { setup: (_, { slots }) => () => vue.h('a', {}, slots.default?.()) })
  app.config.globalProperties.$primevue = { config: { unstyled: true } }
  const html = await renderToString(app)
  assert.equal(projection.scale.available, false)
  assert.equal(projection.view.appointmentLocked, true)
  assert.equal(projection.view.customerDisabled, true)
  assert.equal(projection.view.customerDisplay, 'Booked customer')
  assert.equal(projection.customerId, customerId ?? '')
  assert.equal(projection.appointmentId, 'appointment-1')
  assert.match(html, /EGP.*100\.00/, 'Appointment service must already be in the SSR cart')
})

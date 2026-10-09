import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse, compileScript } from 'vue/compiler-sfc'
import { renderToString } from 'vue/server-renderer'
import * as vue from 'vue'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const service = { id: 'service-1', name: 'Haircut', itemType: 'service', unitPrice: 100, discount: 0, stock: null, sku: null, barcode: null }

function component(file, globals) {
  const { descriptor } = parse(readFileSync(file, 'utf8'))
  const script = compileScript(descriptor, { id: file.pathname, inlineTemplate: true })
  const code = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const module = { exports: {} }
  const localRequire = name => {
    if (!name.startsWith('~/')) return require(name)
    const extension = name.endsWith('/businessMode') ? '.ts' : name.endsWith('/pos') ? '.js' : ''
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
    ref: vue.ref, computed: vue.computed, watch: vue.watch, nextTick: vue.nextTick,
    onMounted: vue.onMounted, onBeforeUnmount: vue.onBeforeUnmount,
    definePageMeta: () => {}, useRoute: () => ({ query: { appointment: 'appointment-1' } }),
    useI18n: () => ({ locale: vue.ref('en'), t: key => key }),
    useConfirmation: () => ({ current: vue.ref(null), ask: async () => false }), useToasts: () => ({ push: () => {} }),
    useShop: () => ({ current: vue.ref({ business_mode: 'service' }), currentId: vue.ref('shop-1'), currentLocationId: vue.ref('location-1'), currentLocation: vue.ref({ name: 'Main' }), currentMembership: vue.ref({ id: 'membership-1' }), loading: vue.ref(false) }),
    useSupabaseClient: () => ({ schema: () => ({ rpc: async name => ({ data: name === 'pos_checkout_context' ? context : name === 'list_catalog_categories' ? [] : { items: [service], total: 1, pageSize: 30 }, error: null }) }) }),
    // Match Nuxt's SSR contract: data starts at its default, is populated during
    // server prefetch, and the returned promise can be awaited by page setup.
    useAsyncData: (key, handler, options) => {
      const data = vue.shallowRef(options.default()), pending = vue.ref(true), error = vue.ref(null)
      const promise = Promise.resolve().then(handler).then(value => { data.value = value; pending.value = false })
      vue.onServerPrefetch(() => promise)
      const result = { data, pending, error, refresh: () => promise }
      return Object.assign(promise.then(() => result), result)
    },
  }
  const app = vue.createSSRApp(component(new URL('../../app/pages/pos.vue', import.meta.url), globals))
  app.component('BsButton', component(new URL('../../../../packages/ui/src/atoms/BsButton.vue', import.meta.url), globals))
  app.component('BsSelect', { props: ['disabled'], setup: (props, { slots }) => () => vue.h('div', { role: 'combobox', 'aria-disabled': props.disabled }, slots.value?.()) })
  app.component('NuxtLink', { setup: (_, { slots }) => () => vue.h('a', {}, slots.default?.()) })
  app.config.globalProperties.$primevue = { config: { unstyled: true } }
  const html = await renderToString(app)
  assert.match(html, /aria-disabled="true"[^>]*>.*Booked customer/)
  const action = html.match(/<button\b[^>]*>[\s\S]*?<\/button>/gi)?.find(button => button.includes(customerId ? 'pos.clearCustomer' : 'pos.noCustomer'))
  assert.ok(action, 'Appointment customer action must be rendered')
  assert.match(action, /\sdisabled(?:\s|>)/)
  assert.match(html, /EGP.*100\.00/, 'Appointment service must already be in the SSR cart')
})

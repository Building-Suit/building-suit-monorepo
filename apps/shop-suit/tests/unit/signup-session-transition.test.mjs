import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createRenderer, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

test('signup survives session establishment and provisioning while operational context changes still remount', async () => {
  const user = ref(null)
  const route = reactive({ path: '/auth/signup', meta: { layout: false } })
  const committedRoute = shallowRef(null)
  const currentId = ref(null)
  const currentLocationId = ref(null)
  const toasts = ref([{ title: 'Old context' }])
  const confirmation = { current: ref({}), answer() { this.current.value = null } }
  const cleared = []
  const loads = []
  const env = {
    useSupabaseUser: () => user,
    useRoute: () => route,
    useRouter: () => ({ currentRoute: { get value() { return committedRoute.value ?? route } } }),
    useShop: () => ({ currentId, currentLocationId, loadShops: async options => loads.push(options) }),
    useConfirmation: () => confirmation,
    useToasts: () => ({ toasts }),
    clearNuxtData: predicate => cleared.push(predicate),
    useLocaleHead: () => ref({ htmlAttrs: { lang: 'en', dir: 'ltr' }, link: [], meta: [] }),
    useHead: () => {},
    useLocaleDocument: () => {},
    useShopSeo: () => {},
    useShopPrivacy: () => undefined,
  }
  const { descriptor } = parse(await readFile(new URL('../../app/app.vue', import.meta.url), 'utf8'))
  const compiled = stripTypeScriptTypes(compileScript(descriptor, { id: 'signup-session', inlineTemplate: true }).content)
    .replace(/from (['"])vue\1/g, `from '${import.meta.resolve('vue')}'`)
  const code = `import { computed, watch } from '${import.meta.resolve('vue')}';
    const { ${Object.keys(env).join(', ')} } = globalThis.__signupSessionFixture;
    ${compiled}`
  globalThis.__signupSessionFixture = env
  const { default: Root } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
  delete globalThis.__signupSessionFixture

  let mounts = 0
  let unmounts = 0
  const Page = defineComponent({ setup() {
    onMounted(() => mounts++)
    onUnmounted(() => unmounts++)
    return () => h('main')
  } })
  const node = () => ({ children: [], parent: null })
  function remove(child) {
    if (child.parent) child.parent.children.splice(child.parent.children.indexOf(child), 1)
    child.parent = null
  }
  const renderer = createRenderer({
    createElement: node, createText: node, createComment: node,
    setText() {}, setElementText() {}, patchProp() {},
    insert(child, parent, anchor) {
      remove(child)
      const index = anchor ? parent.children.indexOf(anchor) : -1
      parent.children.splice(index < 0 ? parent.children.length : index, 0, child)
      child.parent = parent
    },
    remove, parentNode: child => child.parent,
    nextSibling: child => child.parent?.children[child.parent.children.indexOf(child) + 1] ?? null,
  })
  const app = renderer.createApp(Root)
  const { descriptor: appRootDescriptor } = parse(await readFile(new URL('../../../../packages/ui/src/templates/BsAppRoot.vue', import.meta.url), 'utf8'))
  const appRootCode = stripTypeScriptTypes(compileScript(appRootDescriptor, { id: 'shared-app-root', inlineTemplate: true }).content)
    .replace(/from (['"])vue\1/g, `from '${import.meta.resolve('vue')}'`)
  const { default: SharedAppRoot } = await import(`data:text/javascript;base64,${Buffer.from(appRootCode).toString('base64')}`)
  app.component('BsAppRoot', SharedAppRoot)
  const layoutNames = []
  app.component('NuxtLayout', defineComponent({ props: ['name'], setup: (props, { slots }) => () => {
    layoutNames.push(props.name ?? route.meta.layout)
    return slots.default?.()
  } }))
  app.component('NuxtPage', defineComponent({ props: ['pageKey'], setup: (props) => () => h(Page, { key: typeof props.pageKey === 'function' ? props.pageKey(committedRoute.value ?? route) : props.pageKey }) }))
  app.component('NuxtRouteAnnouncer', defineComponent({ setup: () => () => null }))
  app.component('BsToastHost', defineComponent({ setup: () => () => null }))
  app.component('BsPrivacyConsent', defineComponent({ setup: () => () => null }))
  app.component('BsConfirmHost', defineComponent({ setup: () => () => null }))
  let pendingVisible = 0
  app.component('BsSectionSkeleton', defineComponent({ setup() {
    onMounted(() => pendingVisible++)
    onUnmounted(() => pendingVisible--)
    return () => h('div', { role: 'status', 'aria-busy': true }, 'Loading')
  } }))
  app.mount(node())
  try {
    assert.equal(layoutNames.at(-1), 'auth', 'signup retains its registered authentication layout')
    user.value = { id: 'verified-owner' }
    await nextTick()
    currentId.value = 'owner-shop'
    await nextTick()
    currentLocationId.value = 'main-location'
    await nextTick()
    assert.equal(mounts, 1, 'verification and provisioning must retain the signup handler and retry feedback')
    assert.equal(unmounts, 0)
    assert.equal(loads.length, 1)
    assert.ok(cleared[0]('shop-data:old-account'))
    assert.ok(cleared[0]('platform-admin:old-account'))
    assert.equal(confirmation.current.value, null)
    assert.deepEqual(toasts.value, [])

    route.path = '/dashboard'
    await nextTick()
    assert.equal(unmounts, 1)
    currentId.value = 'another-shop'
    await nextTick()
    currentLocationId.value = 'another-location'
    await nextTick()
    user.value = { id: 'another-account' }
    await nextTick()
    assert.equal(unmounts, 4, 'operational shop, location and account switches must discard the old page')
    assert.equal(mounts, 5)
    user.value = null
    await nextTick()
    assert.equal(unmounts, 5, 'session loss must remove the protected page and its drafts')
    assert.equal(mounts, 5, 'anonymous users must not mount an operational page')
    assert.equal(pendingVisible, 1, 'blocked session transitions must provide pending feedback without protected content')

    for (const [index, path] of ['/about', '/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation'].entries()) {
      route.path = path
      await nextTick()
      assert.equal(mounts, 6 + index, `anonymous visitors must render a fresh page for ${path}`)
      assert.equal(layoutNames.at(-1), 'landing', 'public navigation must retain the public frame')
    }
    route.path = '/dashboard'
    await nextTick()
    assert.equal(unmounts, 11, 'returning to a protected route must remove the public page')
    assert.equal(mounts, 11, 'public access must not allow an anonymous operational page')

    // Nuxt defers useRoute until NuxtPage resolves. Logout must reopen the
    // host using the committed destination even while useRoute is dashboard.
    committedRoute.value = { path: '/auth/login' }
    await nextTick()
    assert.equal(route.path, '/dashboard')
    assert.equal(mounts, 12, 'login must render without waiting for the hidden NuxtPage to resolve')
    assert.equal(pendingVisible, 0, 'the committed public destination must replace the pending state')
    committedRoute.value = { path: '/dashboard' }
    await nextTick()
    assert.equal(unmounts, 12, 'an anonymous committed protected route must still hide its page')

    route.path = '/about'
    route.meta.layout = 'landing'
    committedRoute.value = { path: '/dashboard', meta: { layout: false } }
    user.value = { id: 'signed-in-owner' }
    await nextTick()
    assert.equal(layoutNames.at(-1), 'default', 'a committed operational page must not inherit deferred or transient public layout metadata')
    committedRoute.value.meta.layout = 'default'
    await nextTick()
    assert.equal(layoutNames.at(-1), 'default', 'lazy metadata mutation must not control the workspace layout')
    currentId.value = 'loaded-shop'
    currentLocationId.value = 'loaded-location'
    await nextTick()
    assert.equal(route.path, '/about', 'the regression deliberately retains stale Nuxt route metadata')
    assert.equal(layoutNames.at(-1), 'default', 'async tenant remounts must retain the operational shell')

    route.path = '/dashboard'
    route.meta.layout = 'default'
    user.value = null
    committedRoute.value = { path: '/auth/login', meta: { layout: false } }
    await nextTick()
    assert.equal(layoutNames.at(-1), false, 'logout must not wrap public authentication in the deferred private shell')
    for (const path of ['/auth/forgot-password', '/auth/reset-password', '/auth/signup']) {
      committedRoute.value = { path, meta: { layout: false } }
      await nextTick()
      assert.equal(layoutNames.at(-1), 'auth', `${path} must retain its registered frame despite stale metadata`)
    }
  } finally { app.unmount() }
})

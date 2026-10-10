import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import test from 'node:test'
import { createRenderer, defineComponent, h, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

test('signup survives session establishment and provisioning while operational context changes still remount', async () => {
  const user = ref(null)
  const route = reactive({ path: '/auth/signup' })
  const currentId = ref(null)
  const currentLocationId = ref(null)
  const toasts = ref([{ title: 'Old context' }])
  const confirmation = { current: ref({}), answer() { this.current.value = null } }
  const cleared = []
  const loads = []
  const env = {
    useSupabaseUser: () => user,
    useRoute: () => route,
    useShop: () => ({ currentId, currentLocationId, loadShops: async options => loads.push(options) }),
    useConfirmation: () => confirmation,
    useToasts: () => ({ toasts }),
    clearNuxtData: predicate => cleared.push(predicate),
    useLocaleHead: () => ref({ htmlAttrs: { lang: 'en', dir: 'ltr' }, link: [], meta: [] }),
    useHead: () => {},
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
    .replace(/from (['\"])vue\1/g, `from '${import.meta.resolve('vue')}'`)
  const { default: SharedAppRoot } = await import(`data:text/javascript;base64,${Buffer.from(appRootCode).toString('base64')}`)
  app.component('BsAppRoot', SharedAppRoot)
  app.component('NuxtLayout', defineComponent({ props: ['name'], setup: (_, { slots }) => () => slots.default?.() }))
  app.component('NuxtPage', Page)
  app.component('NuxtRouteAnnouncer', defineComponent({ setup: () => () => null }))
  app.component('BsToastHost', defineComponent({ setup: () => () => null }))
  app.component('BsConfirmHost', defineComponent({ setup: () => () => null }))
  app.mount(node())
  try {
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
  } finally { app.unmount() }
})

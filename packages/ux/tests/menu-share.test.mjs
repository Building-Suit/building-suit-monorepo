import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, ref } from 'vue'
import { useMenuNavigation } from '../src/composables/useMenuNavigation.ts'
import { useSideNavigation } from '../src/composables/useSideNavigation.ts'
import { useBrowserShare } from '../src/composables/useBrowserShare.ts'
import { useDocumentPrint } from '../src/composables/useDocumentPrint.ts'

test('menu arrows wrap, Home/End choose edges, Escape restores trigger and route changes close', async () => {
  const previous = globalThis.document
  const scope = effectScope(), route = ref('/one')
  let restored = 0, stopped = 0
  const items = [0, 1, 2].map(id => ({ id, hasAttribute: () => false, focus() { globalThis.document.activeElement = this } }))
  globalThis.document = { activeElement: items[0] }
  try {
    const menu = scope.run(() => useMenuNavigation(() => route.value, '[data-trigger]'))
    menu.root.value = { querySelector: () => ({ focus: () => { restored++ } }) }
    menu.panel.value = { querySelectorAll: () => items, querySelector: () => items[0] }
    await menu.toggle()
    const press = key => menu.onKeydown({ key, preventDefault() {}, stopPropagation() { stopped++ } })
    press('ArrowUp'); assert.equal(globalThis.document.activeElement.id, 2)
    press('ArrowDown'); assert.equal(globalThis.document.activeElement.id, 0)
    press('End'); assert.equal(globalThis.document.activeElement.id, 2)
    press('Home'); assert.equal(globalThis.document.activeElement.id, 0)
    press('Escape'); await nextTick()
    assert.equal(stopped, 1)
    assert.equal(menu.open.value, false)
    assert.equal(restored, 1)
    await menu.toggle()
    route.value = '/two'; await nextTick()
    assert.equal(menu.open.value, false)
    assert.equal(restored, 1)
  }
  finally { scope.stop(); globalThis.document = previous }
})

test('open side navigation traps Tab in both directions and ignores keys when closed', async () => {
  const previous = globalThis.document
  const scope = effectScope(), open = ref(false)
  let closed = 0, prevented = 0
  const first = { hasAttribute: () => false, getClientRects: () => [{}], focus() { globalThis.document.activeElement = this } }
  const last = { hasAttribute: () => false, getClientRects: () => [{}], focus() { globalThis.document.activeElement = this } }
  globalThis.document = { activeElement: first }
  try {
    const menu = scope.run(() => useSideNavigation(() => open.value, () => '/customers/1', () => { closed++ }))
    menu.panel.value = { querySelectorAll: () => [{ hasAttribute: () => false, getClientRects: () => [], focus() { throw new Error('hidden element received focus') } }, first, last], querySelector: () => first }
    assert.equal(menu.isActive('/customers'), true)
    menu.onKeydown({ key: 'Escape', preventDefault() { prevented++ } })
    assert.equal(closed, 0)
    open.value = true; await nextTick(); await nextTick()
    menu.onKeydown({ key: 'Tab', shiftKey: true, preventDefault() { prevented++ } })
    assert.equal(globalThis.document.activeElement, last)
    menu.onKeydown({ key: 'Tab', shiftKey: false, preventDefault() { prevented++ } })
    assert.equal(globalThis.document.activeElement, first)
    menu.onKeydown({ key: 'Escape', preventDefault() { prevented++ } })
    assert.equal(closed, 1); assert.equal(prevented, 3)
  }
  finally { scope.stop(); globalThis.document = previous }
})

test('side navigation focuses after browser paint and cancels focus when closed before paint', async () => {
  const previousFrame = globalThis.requestAnimationFrame
  const previousStyle = globalThis.getComputedStyle
  const scope = effectScope(), open = ref(false), frames = []
  let focused = 0
  let visibility = 'hidden'
  globalThis.requestAnimationFrame = callback => { frames.push(callback); return frames.length }
  globalThis.getComputedStyle = () => ({ visibility })
  try {
    const menu = scope.run(() => useSideNavigation(() => open.value, () => '/customers', () => {}))
    menu.panel.value = { querySelector: () => ({ getClientRects: () => [{}], focus() { focused++ } }) }
    open.value = true; await nextTick(); await nextTick()
    assert.equal(focused, 0, 'CSS visibility must reach a browser frame before focus')
    frames.shift()(); assert.equal(focused, 0)
    visibility = 'visible'
    frames.shift()(); assert.equal(focused, 1)
    open.value = false; await nextTick()
    open.value = true; await nextTick(); await nextTick()
    open.value = false; await nextTick()
    while (frames.length) frames.shift()()
    assert.equal(focused, 1, 'A closed drawer must not steal focus later')
    open.value = true; await nextTick(); await nextTick()
    scope.stop()
    while (frames.length) frames.shift()()
    assert.equal(focused, 1, 'A disposed drawer must not steal focus later')
  } finally {
    scope.stop()
    if (previousFrame === undefined) delete globalThis.requestAnimationFrame
    else globalThis.requestAnimationFrame = previousFrame
    if (previousStyle === undefined) delete globalThis.getComputedStyle
    else globalThis.getComputedStyle = previousStyle
  }
})

test('sharing excludes duplicate requests, treats native cancellation quietly and falls back to clipboard', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  const state = useBrowserShare()
  let release, copied = ''
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { share: () => new Promise(resolve => { release = resolve }) } })
  try {
    const running = state.share({ title: 'Receipt', text: 'body' })
    assert.equal(state.sharing.value, true)
    assert.equal(await state.share({ title: 'Receipt', text: 'body' }), 'pending')
    release(); assert.equal(await running, 'shared'); assert.equal(state.sharing.value, false)
    globalThis.navigator.share = () => Promise.reject(new DOMException('Cancelled', 'AbortError'))
    assert.equal(await state.share({ title: 'Receipt', text: 'body' }), 'aborted')
    delete globalThis.navigator.share
    globalThis.navigator.clipboard = { writeText: async value => { copied = value } }
    assert.equal(await state.share({ title: 'Receipt', text: 'body' }), 'copied'); assert.equal(copied, 'body')
    globalThis.navigator.clipboard.writeText = async () => { throw new Error('denied') }
    assert.equal(await state.share({ title: 'Receipt', text: 'body' }), 'error'); assert.equal(state.sharing.value, false)
  }
  finally { if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor); else delete globalThis.navigator }
})

test('printing awaits render and invokes only the local browser print interface', async () => {
  const previous = globalThis.window
  let printed = 0
  globalThis.window = { print: () => { printed++ } }
  try {
    const { print } = useDocumentPrint(), pending = print()
    assert.equal(printed, 0)
    assert.equal(await pending, true)
    assert.equal(printed, 1)
    delete globalThis.window
    assert.equal(await print(), false)
  }
  finally { globalThis.window = previous }
})

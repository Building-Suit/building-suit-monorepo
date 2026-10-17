import test from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer, nextTick } from 'vue'
import { usePageRevalidation } from '../src/composables/usePageRevalidation.ts'
const renderer = createRenderer({ createComment: () => ({}),insert() {},remove() {},parentNode: () => null,nextSibling: () => null,createElement: () => ({}),createText: () => ({}),setText() {},setElementText() {},patchProp() {} })
async function mount(work,enabled = () => true) {
  const previousWindow = globalThis.window; const previousDocument = globalThis.document
  const view = new EventTarget(); const document = Object.assign(new EventTarget(),{ visibilityState: 'visible' })
  globalThis.window = view; globalThis.document = document
  let action
  const app = renderer.createApp({ setup() { action = usePageRevalidation(work,enabled,30000); return () => null } })
  app.mount({}); await nextTick()
  return { action,view,document,dispose() { app.unmount(); globalThis.window = previousWindow; globalThis.document = previousDocument } }
}
test('visible owning views revalidate on foreground and interval; hidden or disabled views do not', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0; let enabled = true
  const fixture = await mount(() => { calls++ },() => enabled)
  try {
    fixture.view.dispatchEvent(new Event('focus')); await fixture.action.refresh(); assert.equal(calls,1)
    fixture.document.visibilityState = 'hidden'; context.mock.timers.tick(30000); await nextTick(); assert.equal(calls,1)
    fixture.document.visibilityState = 'visible'; fixture.document.dispatchEvent(new Event('visibilitychange')); await fixture.action.refresh(); assert.equal(calls,2)
    enabled = false; context.mock.timers.tick(30000); await nextTick(); assert.equal(calls,2)
    enabled = true; context.mock.timers.tick(30000); await fixture.action.refresh(); assert.equal(calls,3)
  } finally { fixture.dispose() }
  context.mock.timers.tick(30000); await nextTick(); assert.equal(calls,3)
})
test('foreground refreshes coalesce and an unmounted page cannot start another request', async () => {
  let release; let calls = 0
  const fixture = await mount(() => { calls++; return new Promise(resolve => { release = resolve }) })
  fixture.view.dispatchEvent(new Event('focus')); await nextTick()
  fixture.view.dispatchEvent(new Event('focus')); assert.equal(calls,1)
  fixture.dispose(); release(); await fixture.action.refresh()
  fixture.view.dispatchEvent(new Event('focus')); assert.equal(calls,1)
})
test('a failed refresh does not leave foreground revalidation permanently locked', async () => {
  let calls = 0
  const fixture = await mount(async () => { if (++calls===1) throw new Error('Synthetic failed refresh') })
  try { await fixture.action.refresh(); await fixture.action.refresh(); assert.equal(calls,2) } finally { fixture.dispose() }
})

test('page suspension stops foreground/interval work, including an event queued just before pagehide', async context => {
  context.mock.timers.enable({ apis: ['setInterval'] })
  let calls = 0
  const fixture = await mount(() => { calls++ })
  try {
    fixture.view.dispatchEvent(new Event('focus'))
    fixture.view.dispatchEvent(new Event('pagehide'))
    await nextTick(); await fixture.action.refresh()
    fixture.view.dispatchEvent(new Event('focus')); context.mock.timers.tick(30000)
    await nextTick(); assert.equal(calls,0)
  } finally { fixture.dispose() }
})

test('a newer authenticated revision requested during refresh runs after the stale flight settles', async () => {
  let release; let revision = 1; const seen = []
  const fixture = await mount(async () => {
    const captured = revision; seen.push(captured)
    if (captured===1) await new Promise(resolve => { release = resolve })
  })
  try {
    const first = fixture.action.refresh(); await nextTick()
    revision = 2
    const latest = fixture.action.refresh()
    fixture.view.dispatchEvent(new Event('focus'))
    release(); await Promise.all([first,latest])
    assert.deepEqual(seen,[1,2])
  } finally { fixture.dispose() }
})

test('a refresh queued as the previous work settles is drained before its callers complete', async () => {
  let action; let calls = 0
  const fixture = await mount(() => {
    if (++calls===1) queueMicrotask(() => queueMicrotask(() => { void action.refresh() }))
  })
  action = fixture.action
  try { await action.refresh(); assert.equal(calls,2) } finally { fixture.dispose() }
})

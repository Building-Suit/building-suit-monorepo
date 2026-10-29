import test from 'node:test'
import assert from 'node:assert/strict'
import { effectScope, nextTick, reactive, ref } from 'vue'
import { useFormInteraction } from '../src/composables/useFormInteraction.ts'
import { useDialogInteraction } from '../src/composables/useDialogInteraction.ts'

test('form pending excludes duplicate submits and errors receive focus', async () => {
  const scope = effectScope()
  const state = reactive({ pending: true, error: '' })
  let submitted = 0, focused = 0
  const form = scope.run(() => useFormInteraction(state, () => { submitted++ }))
  form.summary.value = { focus: () => { focused++ } }
  await form.submit({})
  assert.equal(submitted, 0)
  state.pending = false
  await form.submit({})
  assert.equal(submitted, 1)
  state.error = 'Invalid value'
  await nextTick()
  await nextTick()
  assert.equal(focused, 1)
  scope.stop()
})

test('dialog protects dirty values, excludes pending dismissals and restores the opening control', async () => {
  const previousDocument = globalThis.document
  const previousHTMLElement = globalThis.HTMLElement
  let focused = 0, promptFocused = 0
  class Element { isConnected = true; focus() { focused++ } }
  globalThis.HTMLElement = Element
  globalThis.document = { activeElement: new Element() }
  const scope = effectScope()
  const state = reactive({ pending: false, dirty: true })
  const visible = ref(false)
  try {
    const dialog = scope.run(() => useDialogInteraction(state, visible))
    dialog.discardPrompt.value = { querySelector: () => ({ focus: () => { promptFocused++ } }) }
    visible.value = true
    dialog.requestClose(false)
    await nextTick()
    assert.equal(visible.value, true)
    assert.equal(dialog.confirmDiscard.value, true)
    assert.equal(promptFocused, 1)
    let prevented = false, stopped = false
    dialog.handleKeydown({ key: 'Escape', preventDefault: () => { prevented = true }, stopImmediatePropagation: () => { stopped = true } })
    assert.equal(visible.value, true)
    assert.equal(dialog.confirmDiscard.value, false)
    assert.equal(prevented && stopped, true)
    state.pending = true
    dialog.requestClose(false)
    assert.equal(visible.value, true)
    assert.equal(dialog.confirmDiscard.value, false)
    state.pending = false
    dialog.requestClose(false)
    dialog.discard()
    await nextTick()
    assert.equal(visible.value, false)
    assert.equal(focused, 1)
    visible.value = true
    scope.stop()
    await nextTick()
    assert.equal(focused, 2)
  } finally {
    scope.stop()
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousHTMLElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = previousHTMLElement
  }
})

for (const connected of [true, false]) test(`dialog handoff restores a surviving explicit origin only: ${connected}`, async () => {
  const previousDocument = globalThis.document, previousHTMLElement = globalThis.HTMLElement
  let returned = 0, transient = 0
  class Element { isConnected = connected; focus() { returned++ } }
  const origin = new Element()
  globalThis.HTMLElement = Element
  globalThis.document = { activeElement: Object.assign(new Element(), { focus() { transient++ } }) }
  const scope = effectScope(), visible = ref(false)
  try {
    const dialog = scope.run(() => useDialogInteraction({ pending: false, dirty: false, returnFocus: () => origin }, visible))
    visible.value = true
    dialog.requestClose(false)
    await nextTick()
    assert.equal(returned, connected ? 1 : 0)
    assert.equal(transient, 0, 'The closing parent dialog is not the child editor return target')
  } finally {
    scope.stop()
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument
    if (previousHTMLElement === undefined) delete globalThis.HTMLElement; else globalThis.HTMLElement = previousHTMLElement
  }
})

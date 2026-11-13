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

for (const moveToAnotherDialog of [false,true]) test(`nested cancellation restores focus after parent entrance without stealing another dialog: ${moveToAnotherDialog}`,async()=>{
 const previousDocument=globalThis.document,previousHTMLElement=globalThis.HTMLElement,previousFrame=globalThis.requestAnimationFrame
 let finish,focused=0
 const finished=new Promise(resolve=>{finish=resolve})
 const parent={getAnimations:()=>[{playState:'running',effect:{getComputedTiming:()=>({endTime:600})},finished}]},other={}
 class Element { isConnected=true;constructor(dialog){this.dialog=dialog}closest(){return this.dialog}focus(){focused++;globalThis.document.activeElement=this} }
 globalThis.HTMLElement=Element;globalThis.requestAnimationFrame=callback=>{queueMicrotask(()=>callback(0));return 1}
 const opener=new Element(parent),cancel=new Element(other),scope=effectScope(),visible=ref(false)
 globalThis.document={activeElement:opener}
 try{
  scope.run(()=>useDialogInteraction(reactive({pending:false,dirty:false}),visible))
  visible.value=true;globalThis.document.activeElement=cancel;visible.value=false
  await nextTick();assert.equal(focused,0)
  // The parent finishes and performs its own initial autofocus. A genuinely
  // different foreground dialog must keep focus instead of being interrupted.
  globalThis.document.activeElement=new Element(moveToAnotherDialog?other:parent)
  finish();await new Promise(resolve=>setImmediate(resolve))
  assert.equal(focused,moveToAnotherDialog?0:1)
  if(!moveToAnotherDialog)assert.equal(globalThis.document.activeElement,opener)
 }finally{
  scope.stop()
  if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument
  if(previousHTMLElement===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=previousHTMLElement
  if(previousFrame===undefined)delete globalThis.requestAnimationFrame;else globalThis.requestAnimationFrame=previousFrame
 }
})

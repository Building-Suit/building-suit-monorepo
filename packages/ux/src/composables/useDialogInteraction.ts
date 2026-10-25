import { nextTick, ref, shallowRef, watch, onScopeDispose, type Ref } from 'vue'
import { interactionPolicy } from '../index.ts'

/** Shared dirty protection, pending exclusion, Escape and focus restoration. */
export function useDialogInteraction(props: { readonly pending: boolean; readonly dirty: boolean; readonly closeBlocked?: boolean }, visible: Ref<boolean>) {
  const confirmDiscard = ref(false)
  const discardPrompt = ref<HTMLElement | null>(null)
  const opener = shallowRef<HTMLElement | null>(null)
  let focusGeneration = 0
  function rememberOpener() {
    focusGeneration++
    const active = document.activeElement
    if (active instanceof HTMLElement) opener.value = active
}
async function restoreFocus() {
  const target = opener.value, generation = focusGeneration
  opener.value = null
  await nextTick()
  if (!target?.isConnected) return
  // A nested confirmation can close before its parent's entrance completes.
  // Wait for that finite motion and the vendor's final autofocus, then restore
  // the actual opening control. Do not wait for unrelated/infinite animations.
  const dialog = target.closest?.('[role="dialog"]')
  const animations = (dialog?.getAnimations?.() || []).filter(animation => {
    const end = animation.effect?.getComputedTiming().endTime
    return (animation.playState === 'running' || animation.playState === 'finished') && typeof end === 'number' && Number.isFinite(end)
  })
  if (animations.length) {
    await Promise.allSettled(animations.map(animation => animation.finished))
    await nextTick()
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
    const active = document.activeElement
    if (active instanceof HTMLElement && active.closest?.('[role="dialog"]') && active.closest('[role="dialog"]') !== dialog) return
  }
  if (generation === focusGeneration && target.isConnected) target.focus()
}
function requestClose(value: boolean) {
  if (value || props.pending || props.closeBlocked) return
  if (props.dirty && interactionPolicy.protectDirtyForms) {
    confirmDiscard.value = true
    nextTick(() => discardPrompt.value?.querySelector<HTMLButtonElement>('button')?.focus())
  }
  else visible.value = false
}
function discard() { if (props.pending || props.closeBlocked) return; confirmDiscard.value = false; visible.value = false }
function handleKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !confirmDiscard.value || props.pending || props.closeBlocked) return
  event.preventDefault()
  event.stopImmediatePropagation()
  confirmDiscard.value = false
}
watch(visible, (value, previous) => {
  if (value && !previous) rememberOpener()
  if (!value && previous) { confirmDiscard.value = false; restoreFocus() }
}, { flush: 'sync' })
if (typeof document !== 'undefined' && visible.value) rememberOpener()
onScopeDispose(() => { if (visible.value) restoreFocus() })
return { confirmDiscard, discardPrompt, requestClose, discard, handleKeydown }
}

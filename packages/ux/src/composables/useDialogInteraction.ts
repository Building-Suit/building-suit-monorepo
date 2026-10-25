import { nextTick, ref, shallowRef, watch, onScopeDispose, type Ref } from 'vue'
import { interactionPolicy } from '../index.ts'

/** Shared dirty protection, pending exclusion, Escape and focus restoration. */
export function useDialogInteraction(props: { readonly pending: boolean; readonly dirty: boolean; readonly closeBlocked?: boolean }, visible: Ref<boolean>) {
  const confirmDiscard = ref(false)
  const discardPrompt = ref<HTMLElement | null>(null)
  const opener = shallowRef<HTMLElement | null>(null)
  function rememberOpener() {
    const active = document.activeElement
    if (active instanceof HTMLElement) opener.value = active
}
function restoreFocus() {
  const target = opener.value
  opener.value = null
  nextTick(() => { if (target?.isConnected) target.focus() })
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

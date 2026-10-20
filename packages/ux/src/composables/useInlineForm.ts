import { computed, onMounted, onScopeDispose, ref, watch } from 'vue'
import { interactionPolicy, recordSnapshot } from '../index.ts'

/** Keep an on-page draft separate from refreshed server data and tenant changes. */
export function useInlineForm<T>(options: {
  read: () => T
  source: () => T
  write: (value: T) => void
  scope: () => string | null
}) {
  const baseline = ref(recordSnapshot(options.read()))
  const dirty = computed(() => recordSnapshot(options.read()) !== baseline.value)
  function reset() {
    options.write(options.source())
    baseline.value = recordSnapshot(options.read())
  }
  watch([options.scope, options.source] as const, ([scope], previous) => {
    if (!previous || scope !== previous[0] || !dirty.value) reset()
  }, { immediate: true, deep: true, flush: 'sync' })
  return { dirty, reset }
}

/** Router integration stays caller-owned; document unload uses the same dirty policy. */
export function useUnsavedFormGuard(options: {
  dirty: () => boolean
  pending: () => boolean
  confirmDiscard: () => Promise<boolean>
}) {
  async function requestLeave() {
    if (options.pending()) return false
    if (!interactionPolicy.protectDirtyForms || !options.dirty()) return true
    const accepted = await options.confirmDiscard()
    return accepted && !options.pending()
  }
  function beforeUnload(event: BeforeUnloadEvent) {
    if (!options.pending() && (!interactionPolicy.protectDirtyForms || !options.dirty())) return
    event.preventDefault()
    event.returnValue = ''
  }
  let stopWatching: (() => void) | undefined
  onMounted(() => {
    stopWatching = watch(() => options.pending() || (interactionPolicy.protectDirtyForms && options.dirty()), protect => {
      if (protect) window.addEventListener('beforeunload', beforeUnload)
      else window.removeEventListener('beforeunload', beforeUnload)
    }, { immediate: true, flush: 'sync' })
  })
  onScopeDispose(() => {
    stopWatching?.()
    if (typeof window !== 'undefined') window.removeEventListener('beforeunload', beforeUnload)
  })
  return { requestLeave }
}

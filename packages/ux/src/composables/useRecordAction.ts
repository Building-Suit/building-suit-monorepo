/** Product forms own their values/commands; this controller owns overlay state and dirty tracking. */
export function useRecordAction<T>(getValue: () => T, externalVisibility?: { readonly value: boolean }) {
  const visible = ref(false)
  const trackedVisibility = externalVisibility ?? visible
  const pending = ref(false)
  const baseline = ref('')
  const fingerprint = () => JSON.stringify(getValue(), (_key, value) => value instanceof Set ? [...value].sort() : value instanceof Map ? [...value.entries()] : value)
  const dirty = computed(() => trackedVisibility.value && fingerprint() !== baseline.value)
  watch(() => trackedVisibility.value, open => { if (open) baseline.value = fingerprint() }, { flush: 'post' })
  function markSaved() { baseline.value = fingerprint() }
  function open() { if (!pending.value) { baseline.value = fingerprint(); visible.value = true } }
  function complete() { markSaved(); visible.value = false }
  return { visible, pending, dirty, open, complete, markSaved }
}

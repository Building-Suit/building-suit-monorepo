import { recordSnapshot } from '../index'

export type RecordActionMode = 'create' | 'edit'

/** Product forms own their values/commands; this controller owns the shared modal lifecycle. */
export function useRecordAction<T>(getValue: () => T, externalVisibility?: { readonly value: boolean }) {
  const visible = ref(false)
  const trackedVisibility = externalVisibility ?? visible
  const pending = ref(false)
  const error = ref<string | null>(null)
  const mode = ref<RecordActionMode>('create')
  const baseline = ref('')
  const fingerprint = () => recordSnapshot(getValue())
  const dirty = computed(() => trackedVisibility.value && fingerprint() !== baseline.value)
  watch(() => trackedVisibility.value, open => {
    if (open) {
      baseline.value = fingerprint()
      error.value = null
    }
  }, { flush: 'post' })
  function markSaved() { baseline.value = fingerprint() }
  function open(nextMode: RecordActionMode = 'create') {
    if (pending.value) return
    mode.value = nextMode
    error.value = null
    baseline.value = fingerprint()
    visible.value = true
  }
  function create() { open('create') }
  function edit() { open('edit') }
  function fail(message: string) { error.value = message }
  function complete() {
    markSaved()
    error.value = null
    visible.value = false
  }
  async function run(command: () => void | Promise<void>, describeError: (cause: unknown) => string): Promise<boolean> {
    if (pending.value) return false
    pending.value = true
    error.value = null
    try {
      await command()
      complete()
      return true
    }
    catch (cause) {
      fail(describeError(cause))
      return false
    }
    finally {
      pending.value = false
    }
  }
  return { visible, pending, dirty, error, mode, open, create, edit, run, fail, complete, markSaved }
}

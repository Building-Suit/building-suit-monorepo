import { ref, onScopeDispose } from 'vue'
/** Transport-neutral upload lifecycle. A reset invalidates late validation/upload results. */
export function useFileUpload<Result>(options: {
  validate: (file: File) => Promise<void>
  upload: (file: File) => Promise<Result>
  complete: (result: Result) => void
}) {
  const status = ref<'idle' | 'uploading' | 'uploaded' | 'error' | 'invalid'>('idle')
  const preview = ref('')
  const selectedName = ref('')
  let selected: File | null = null
  let objectUrl = ''
  let generation = 0
  function release() { if (objectUrl) URL.revokeObjectURL(objectUrl); objectUrl = '' }
  function reset(url = '') { generation++; release(); selected = null; selectedName.value = ''; preview.value = url; status.value = 'idle' }
  async function select(file: File | null) {
    if (!file || status.value === 'uploading') return
    const request = ++generation
    selected = file; selectedName.value = file.name; status.value = 'uploading'
    try { await options.validate(file) } catch {
      if (request === generation) status.value = 'invalid'
      return
    }
    if (request !== generation) return
    release(); objectUrl = URL.createObjectURL(file); preview.value = objectUrl
    try {
      const result = await options.upload(file)
      if (request !== generation) return
      options.complete(result); status.value = 'uploaded'
    } catch { if (request === generation) status.value = 'error' }
  }
  function retry() { if (selected && status.value === 'error') return select(selected) }
  onScopeDispose(() => reset())
  return { status, preview, selectedName, select, retry, reset }
}

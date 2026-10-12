import { onScopeDispose } from 'vue'
export function useDebouncedTask<T>(commit: (value: T) => void, delay = 300) {
  let timer: ReturnType<typeof setTimeout> | undefined
  function cancel() { if (timer !== undefined) clearTimeout(timer); timer = undefined }
  function schedule(value: T) { cancel(); timer = setTimeout(() => { timer = undefined; commit(value) }, delay) }
  onScopeDispose(cancel)
  return { schedule, cancel }
}

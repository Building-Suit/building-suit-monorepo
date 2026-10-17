import { onScopeDispose,readonly,ref } from 'vue'
/** An in-memory preview URL owned by the current interaction scope. */
export function useBlobUrl() {
  const url = ref(''); let active = true
  function clear() { if (url.value) URL.revokeObjectURL(url.value); url.value = '' }
  function replace(blob: Blob) { clear(); if (!active) return false; url.value = URL.createObjectURL(blob); return true }
  onScopeDispose(() => { active = false; clear() })
  return { url: readonly(url),clear,replace }
}

import { ref } from 'vue'
/** Presentation epoch lets a file control clear selection without product-owned DOM refs. */
export function useFileInputReset() {
  const key = ref(0)
  function reset() { key.value++ }
  return { key, reset }
}

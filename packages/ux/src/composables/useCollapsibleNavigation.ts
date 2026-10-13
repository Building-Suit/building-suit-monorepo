import { ref } from 'vue'

/** Request-scoped desktop state; mobile drawer state remains separate. */
export function useCollapsibleNavigation() {
  const collapsed = ref(false)
  function toggle() { collapsed.value = !collapsed.value }
  return { collapsed, toggle }
}

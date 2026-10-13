/** Shared reveal state; passwords remain owned by the controlled product form. */
export function usePasswordVisibility() {
  const visible = ref(false)
  const inputType = computed(() => visible.value ? 'text' : 'password')
  function toggle() { visible.value = !visible.value }
  return { visible, inputType, toggle }
}

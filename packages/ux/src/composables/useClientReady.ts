/** Hydration readiness shared by forms that expose interactive controls. */
export function useClientReady() {
  const ready = ref(false)
  onMounted(() => { ready.value = true })
  return ready
}

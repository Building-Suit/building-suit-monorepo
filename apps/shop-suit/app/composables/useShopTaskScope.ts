/** Discard asynchronous UI work once its page or operational context has changed. */
export function useShopTaskScope() {
  const user = useSupabaseUser()
  const { currentId, currentLocationId } = useShop()
  let version = 0
  watch([() => user.value?.id, currentId, currentLocationId], () => { version++ }, { flush: 'sync' })
  onScopeDispose(() => { version++ })
  return () => {
    const started = version
    return () => started === version
  }
}

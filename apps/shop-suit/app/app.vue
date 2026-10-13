<script setup lang="ts">
const user = useSupabaseUser()
const route = useRoute()
const router = useRouter()
const { currentId, currentLocationId, loadShops } = useShop()
const confirmation = useConfirmation()
const { toasts } = useToasts()
const contextKey = computed(() => `${user.value?.id ?? 'anonymous'}:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}`)
// OTP verification establishes a session before provisioning finishes. Keep
// that signup instance alive so its retry/error and identity checks can finish.
// Operational pages still remount whenever their account or tenant changes.
const signupActive = computed(() => route.path === '/auth/signup')
const layoutKey = computed(() => signupActive.value ? 'signup' : user.value?.id ?? 'anonymous')
const pageKey = computed(() => signupActive.value ? 'signup' : contextKey.value)
// This gate can unmount NuxtPage on session loss. Nuxt's useRoute() only
// advances after the destination page resolves, so using it here would keep
// the host hidden forever after logout. The committed router route has already
// passed middleware and can reopen the host for an anonymous destination.
const canRenderPage = computed(() => {
  const path = router.currentRoute.value.path
  return !!user.value || path.startsWith('/auth/') || ['/', '/about', '/pricing', '/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation'].includes(path)
})

watch(() => user.value?.id, () => {
  clearNuxtData(key => key.startsWith('shop-data:') || key.startsWith('platform-admin:'))
  void loadShops({ force: true })
}, { flush: 'sync' })
watch(contextKey, () => {
  // A confirmation or draft must never survive a change of operational context.
  while (confirmation.current.value) confirmation.answer(false)
  toasts.value = []
}, { flush: 'sync' })

useLocaleDocument()
</script>

<template><BsAppRoot v-if="canRenderPage" :layout-key="layoutKey" :page-key="pageKey" /></template>

<script setup lang="ts">
const user = useSupabaseUser()
const router = useRouter()
const { currentId, currentLocationId, loadShops } = useShop()
const confirmation = useConfirmation()
const { toasts } = useToasts()
const contextKey = computed(() => `${user.value?.id ?? 'anonymous'}:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}`)
// OTP verification establishes a session before provisioning finishes. Keep
// that signup instance alive so its retry/error and identity checks can finish.
// Operational pages still remount whenever their account or tenant changes.
const signupActive = computed(() => router.currentRoute.value.path === '/auth/signup')
const layoutKey = computed(() => signupActive.value ? 'signup' : `${user.value?.id ?? 'anonymous'}:${pageLayout.value || 'none'}`)
const pageKey = computed(() => signupActive.value ? 'signup' : contextKey.value)
// This gate can unmount NuxtPage on session loss. Nuxt's useRoute() only
// advances after the destination page resolves, so using it here would keep
// the host hidden forever after logout. The committed router route has already
// passed middleware and can reopen the host for an anonymous destination.
const publicPaths = ['/', '/about', '/pricing', '/contact', '/terms', '/privacy', '/delivery-shipping', '/refund-cancellation']
const canRenderPage = computed(() => {
  const path = router.currentRoute.value.path
  return !!user.value || path.startsWith('/auth/') || publicPaths.includes(path)
})

// Layout metadata can be filled after the committed route's shallow ref is
// updated. Account/tenant remounts must use the app's committed route family,
// not cache either that transient metadata or Nuxt's previous deferred route.
// This selects presentation only; the visibility gate and middleware remain.
const pageLayout = computed(() => {
  const path = router.currentRoute.value.path
  if (['/auth/signup', '/auth/forgot-password', '/auth/reset-password'].includes(path)) return 'auth'
  if (path.startsWith('/auth/')) return false
  if (path === '/platform-admin') return 'platform-admin'
  return publicPaths.includes(path) ? 'landing' : 'default'
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

useLocaleDocument({ documentLinks: false })
useShopSeo()
const privacy = useShopPrivacy(true)
</script>

<template><BsAppRoot :privacy="privacy" :render-page="canRenderPage" :layout="pageLayout" :layout-key="layoutKey" :page-key="pageKey" /></template>

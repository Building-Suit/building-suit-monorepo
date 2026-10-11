<script setup lang="ts">
const user = useSupabaseUser()
const route = useRoute()
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
const canRenderPage = computed(() => !!user.value || route.path.startsWith('/auth/') || ['/', '/pricing', '/contact', '/terms', '/privacy', '/delivery-policy', '/refund-cancellation'].includes(route.path))

watch(() => user.value?.id, () => {
  clearNuxtData(key => key.startsWith('shop-data:') || key.startsWith('platform-admin:'))
  void loadShops({ force: true })
}, { flush: 'sync' })
watch(contextKey, () => {
  // A confirmation or draft must never survive a change of operational context.
  while (confirmation.current.value) confirmation.answer(false)
  toasts.value = []
}, { flush: 'sync' })

const i18nHead = useLocaleHead({
  // seo: {
  //   canonicalQueries: ['foo'],
  // },
});

useHead(() => ({
  htmlAttrs: {
    lang: i18nHead.value.htmlAttrs!.lang,
    dir: i18nHead.value.htmlAttrs!.dir as 'ltr' | 'rtl' | 'auto',
  },
  link: [...(i18nHead.value.link || [])],
  meta: [...(i18nHead.value.meta || [])],
}));
</script>

<template><BsAppRoot v-if="canRenderPage" :layout-key="layoutKey" :page-key="pageKey" /></template>

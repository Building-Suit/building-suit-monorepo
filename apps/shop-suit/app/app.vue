<script setup lang="ts">
const user = useSupabaseUser()
const { currentId, currentLocationId, loadShops } = useShop()
const confirmation = useConfirmation()
const { toasts } = useToasts()
const contextKey = computed(() => `${user.value?.id ?? 'anonymous'}:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}`)

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

<template><BsAppRoot :layout-key="user?.id ?? 'anonymous'" :page-key="contextKey" /></template>

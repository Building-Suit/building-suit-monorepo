<script setup lang="ts">
const localeHead = useLocaleHead()
useHead(() => ({
  htmlAttrs: {
    lang: localeHead.value.htmlAttrs?.lang,
    dir: localeHead.value.htmlAttrs?.dir,
  },
}))
</script>

<template>
  <NuxtLayout><NuxtPage /></NuxtLayout>
  <ToastHost />
  <BsConfirmHost />
</template>

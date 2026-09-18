<script setup lang="ts">
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

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

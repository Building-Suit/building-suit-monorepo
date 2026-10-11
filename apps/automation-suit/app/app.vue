<script setup lang="ts">
const localeHead = useLocaleHead()

useHead(() => ({
  title: 'Automation Suit',
  htmlAttrs: {
    lang: localeHead.value.htmlAttrs?.lang,
    dir: localeHead.value.htmlAttrs?.dir,
  },
}))
</script>

<template>
  <BsAppRoot toast-host />
</template>

<script setup lang="ts">
// Sets <html lang> and <html dir> from the active locale, which is what makes
// the whole layout mirror for Arabic. Everything else in the app uses logical
// CSS properties (start/end, ms/me, ps/pe) so it follows automatically.
const head = useLocaleHead()
const { locale } = useI18n()

useHead(() => ({
  htmlAttrs: {
    lang: head.value.htmlAttrs?.lang,
    dir: head.value.htmlAttrs?.dir,
  },
  // A single class on <html> lets the Arabic font stack apply through :lang(ar)
  // without every component having to know about it.
  bodyAttrs: {
    class: locale.value === 'ar' ? 'font-arabic' : '',
  },
}))
</script>

<template><BsAppRoot announcer :page-transition="{ name: 'ls-page', mode: 'out-in' }" /></template>

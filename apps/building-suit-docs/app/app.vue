<script setup lang="ts">
const { locale } = useI18n()
useHead(() => ({ htmlAttrs: { lang: locale.value, dir: locale.value === 'ar' ? 'rtl' : 'ltr' } }))
useTheme()
</script>
<template><NuxtRouteAnnouncer /><NuxtLayout><NuxtPage /></NuxtLayout>  <BsConfirmHost />
</template>

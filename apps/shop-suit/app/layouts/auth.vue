<script setup lang="ts">
const { t, locale } = useI18n()
const route = useRoute()
</script>
<template>
  <BsProductAuthFrame :wide="route.path === '/auth/signup'" :product="{ name: 'Shop Suit', assetPrefix: '/brand/shop-suit', homeLabel: locale === 'ar' ? 'الرئيسية' : 'Home', title: `${t('hero.title')} ${t('hero.subtitle')}`, description: t('hero.description') }"><slot /></BsProductAuthFrame>
</template>

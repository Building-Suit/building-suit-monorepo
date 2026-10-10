<script setup lang="ts">
const { t, locale } = useI18n()
const route = useRoute()
</script>
<template>
  <BsAuthLayout :wide="route.path === '/auth/signup'" product-name="Shop Suit" :home-label="locale === 'ar' ? 'الرئيسية' : 'Home'" :title="`${t('hero.title')} ${t('hero.subtitle')}`" :description="t('hero.description')">
    <template #logo="{ tone }"><BsProductLogo name="Shop Suit" asset-prefix="/brand/shop-suit" :tone="tone" size="auth" /></template>
    <BsStack gap="none"><BsSlot :render="$slots.default" /></BsStack>
  </BsAuthLayout>
</template>

<script setup lang="ts">
const { t, locale } = useI18n()
</script>
<template>
  <BsAuthLayout product-name="Shop Suit" :home-label="locale === 'ar' ? 'الرئيسية' : 'Home'" :title="`${t('hero.title')} ${t('hero.subtitle')}`" :description="t('hero.description')">
    <template #logo="{ tone }"><AppLogo :tone="tone" class="my-4" /></template>
    <div class="w-full"><slot /></div>
  </BsAuthLayout>
</template>

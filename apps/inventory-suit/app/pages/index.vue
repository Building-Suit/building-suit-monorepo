<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('product.name') })
</script>
<template>
  <BsCard as="section" padding="lg" class="mx-auto max-w-3xl">
    <h1 class="text-3xl font-bold">{{ t('welcome') }}</h1>
    <p class="mt-4 text-fg-muted">{{ t('description') }}</p>
  </BsCard>
</template>

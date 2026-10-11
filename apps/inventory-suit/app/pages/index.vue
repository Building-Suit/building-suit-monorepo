<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('product.name') })
</script>
<template>
  <BsWelcomePage :title="t('welcome')" :description="t('description')" />
</template>

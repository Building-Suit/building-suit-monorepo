<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('product.name') })
</script>
<template><BsContentSection :title="t('welcome')" :description="t('description')" padding="lg" /></template>

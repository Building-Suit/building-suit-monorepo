<script setup lang="ts">
const { t } = useI18n()
const ui = useUiCopy()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: t('welcome') }))
</script>
<template>
  <BsWorkspaceShell home-path="/" :product-name="t('product.name')" :groups="[]" :labels="labels" :logo="{ kind: 'text' }"><slot /></BsWorkspaceShell>
</template>

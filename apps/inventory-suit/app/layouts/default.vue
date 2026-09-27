<script setup lang="ts">
const { t } = useI18n()
const ui = useUiCopy()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: t('welcome') }))
</script>
<template><BsAppShell home-path="/" :product-name="t('product.name')" :groups="[]" :labels="labels"><template #logo><span class="text-xl font-black">{{ t('product.name') }}</span></template><template #header><SettingsMenu /></template><slot /></BsAppShell></template>

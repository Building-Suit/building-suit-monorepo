<script setup lang="ts">
const { locale } = useI18n()
const ui = useUiCopy()
const labels = computed(() => ({ open: ui('open'), close: ui('close'), navigation: ui('navigation'), dashboard: locale.value === 'ar' ? 'دليل المستندات' : 'Document catalogue' }))
</script>
<template><BsAppShell home-path="/" product-name="Building Suit" :groups="[{ key: 'library', label: locale === 'ar' ? 'المكتبة' : 'Library', links: [{ to: '/components', label: locale === 'ar' ? 'مكتبة المكونات' : 'Component catalogue' }] }]" :labels="labels"><template #logo><BsBuildingLogo /></template><template #header><SettingsMenu /></template><slot /></BsAppShell></template>

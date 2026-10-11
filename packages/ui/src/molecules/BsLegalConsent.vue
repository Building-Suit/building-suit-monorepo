<script setup lang="ts">
const model = defineModel<boolean>({ default: false })
defineProps<{ keypath: string; termsLabel: string; termsTo: string; refundLabel: string; refundTo: string; privacyLabel: string; privacyTo: string; required?: boolean }>()
</script>
<template><div class="bs-legal-consent"><BsCheckbox v-model="model" :label="''" :required="required" /><i18n-t :keypath="keypath" tag="span" scope="global"><template #terms><BsLink :to="termsTo" target="_blank" rel="noopener" variant="standalone">{{ termsLabel }}</BsLink></template><template #refund><BsLink :to="refundTo" target="_blank" rel="noopener" variant="standalone">{{ refundLabel }}</BsLink></template><template #privacy><BsLink :to="privacyTo" target="_blank" rel="noopener" variant="standalone">{{ privacyLabel }}</BsLink></template></i18n-t></div></template>
<style>.bs-legal-consent { display: flex; align-items: flex-start; gap: var(--bs-space-3); padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); background: var(--bs-surface-muted); font-size: var(--bs-type-body-m-size); line-height: 1.5rem; }.bs-legal-consent > .bs-check-control { flex: 0 0 auto; }</style>

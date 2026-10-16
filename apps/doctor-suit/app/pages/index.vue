<script setup lang="ts">
const { t } = useI18n()
useHead({ title: () => t('product.name') })
const started = ref(false)
const feature = computed(() => ({ title: t('feature'), description: t('featureBody'), actionLabel: t('workflow'), result: t('workflowBody') }))
function startWorkflow() {
  started.value = true
}
</script>
<template><BsStarterWorkflowPage :title="t('welcome')" :description="t('description')" :feature="feature" :started="started" @start="startWorkflow"/></template>

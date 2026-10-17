<script setup lang="ts">
const { t } = useI18n()
const started = ref(false)
const feature = computed(() => ({ title: t('feature'), description: t('featureBody'), actionLabel: t('workflow'), result: t('workflowBody') }))
</script>
<template><BsStarterWorkflowPage :title="t('welcome')" :description="t('description')" :feature="feature" :started="started" @start="started = true" /></template>

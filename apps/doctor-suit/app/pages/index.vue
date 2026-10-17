<script setup lang="ts">
import { doctorPublicPreview } from '../utils/publicPreview'
definePageMeta({ layout: false })
const { locale } = useI18n()
const content = computed(() => doctorPublicPreview(locale.value === 'ar'))
const scopeVisible = ref(false)
</script>
<template><BsProductPreviewPage v-bind="content" :scope-visible="scopeVisible" @inspect-scope="scopeVisible = true" /></template>

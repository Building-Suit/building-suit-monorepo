<script setup lang="ts">
import { doctorPublicPreview } from '../utils/publicPreview'
definePageMeta({ layout: false })
const { locale } = useI18n()
const content = computed(() => doctorPublicPreview(locale.value === 'ar'))
const scopeVisible = ref(false)
useHead({ title: () => `${content.value.productName} · ${content.value.eyebrow}` })
useSeoMeta({ description: () => content.value.description, robots: 'noindex, nofollow' })
</script>
<template><BsProductPreviewPage v-bind="content" :scope-visible="scopeVisible" @inspect-scope="scopeVisible = true" /></template>

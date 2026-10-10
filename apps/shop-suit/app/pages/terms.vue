<script setup lang="ts">
import { legalDocuments } from '~/utils/legal'
definePageMeta({ layout: 'landing' })
const { locale, t } = useI18n()
const document = computed(() => legalDocuments.terms[locale.value === 'ar' ? 'ar' : 'en'])
useHead(() => ({ title: `${document.value.title} · Shop Suit`, meta: [{ name: 'description', content: document.value.intro }] }))
</script>
<template><BsPublicLegalPage :document="document" eyebrow="Shop Suit by Building Suit" :last-updated-label="t('marketing.lastUpdated')" /></template>

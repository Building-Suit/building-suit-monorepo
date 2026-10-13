<script setup lang="ts">
import { legalDocuments } from '~/utils/legal'

definePageMeta({ layout: 'marketing' })

const { locale, t } = useI18n()
const document = computed(() => legalDocuments.privacy[locale.value === 'ar' ? 'ar' : 'en'])
useHead(() => ({ title: `${document.value.title} · Ledger Suit`, meta: [{ name: 'description', content: document.value.intro }] }))
</script>

<template>
  <BsPublicLegalPage :document="document" eyebrow="Ledger Suit by Building Suit" :last-updated-label="t('marketing.lastUpdated')" />
</template>

<script setup lang="ts">
import type { LegalDocument } from '~/utils/legal'

const props = defineProps<{ document: LegalDocument }>()
const { t } = useI18n()

useHead(() => ({
  title: `${props.document.title} · Shop Suit`,
  meta: [{ name: 'description', content: props.document.intro }],
}))
</script>

<template>
  <BsPublicLegalPage :document="document" eyebrow="Shop Suit by Building Suit" :last-updated-label="t('marketing.lastUpdated')" />
</template>

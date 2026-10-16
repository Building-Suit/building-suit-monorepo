<script setup lang="ts">
import type { BsLandingChangelog } from '../types/landingPresentation'
defineProps<{ content: BsLandingChangelog }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <BsLandingSection id="whats-new" :eyebrow="content.copy.timeline" :title="content.title">
    <BsStack gap="lg">
      <BsChangelogTimeline :feed="content.feed" :locale="content.locale" :copy="content.copy" :suit="content.suit" :state="content.state" hide-filters :release-limit="3" @retry="$emit('retry')" />
      <BsLink :to="content.to" class="bs-whats-new__link">{{ content.linkLabel }} <span aria-hidden="true">{{ content.locale === 'ar' ? '←' : '→' }}</span></BsLink>
    </BsStack>
  </BsLandingSection>
</template>

<style>
.bs-whats-new__link { color: var(--bs-color-brand-premium-gold); font-weight: var(--bs-font-weight-semibold); }
</style>

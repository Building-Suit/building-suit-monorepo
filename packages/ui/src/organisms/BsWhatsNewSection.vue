<script setup lang="ts">
import type { BsLandingChangelog } from '../types/landingPresentation'
defineProps<{ content: BsLandingChangelog }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <BsLandingSection id="whats-new" :eyebrow="content.copy.timeline" :title="content.title">
    <BsStack gap="lg">
      <BsChangelogTimeline :feed="content.feed" :locale="content.locale" :copy="content.copy" :suit="content.suit" :state="content.state" released-only hide-filters :limit="3" @retry="$emit('retry')" />
      <BsLink :to="content.to">{{ content.linkLabel }}</BsLink>
    </BsStack>
  </BsLandingSection>
</template>

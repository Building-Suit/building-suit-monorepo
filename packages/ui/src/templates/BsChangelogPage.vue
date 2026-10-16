<script setup lang="ts">
import type { ChangelogCopy, ChangelogFeed, ChangelogLocale } from '@building-suit/contracts'
defineProps<{ title: string; feed: ChangelogFeed; locale: ChangelogLocale; copy: ChangelogCopy; suit: string; state: 'ready' | 'loading' | 'error' | 'denied' }>()
defineEmits<{ retry: [] }>()
</script>
<template>
  <main class="bs-public-changelog" :dir="locale === 'ar' ? 'rtl' : 'ltr'" :lang="locale">
    <BsStack gap="lg">
      <BsHeading :level="1" size="h1">{{ title }}</BsHeading>
      <BsChangelogTimeline :feed="feed" :locale="locale" :copy="copy" :suit="suit" :state="state" @retry="$emit('retry')" />
    </BsStack>
  </main>
</template>
<style>
.bs-public-changelog { max-width: 65rem; margin-inline: auto; padding: var(--bs-space-8) var(--bs-space-5); }
</style>

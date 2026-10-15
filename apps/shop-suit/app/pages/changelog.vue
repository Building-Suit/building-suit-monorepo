<script setup lang="ts">
definePageMeta({ layout: 'landing' })
const { locale } = useI18n()
const { feed, state, copy, refresh } = usePublicChangelog()
useHead({ title: () => `${copy.value.timeline} · Shop Suit` })
</script>
<template>
  <BsChangelogPage :title="copy.timeline" :feed="feed" :state="state" :copy="copy" :locale="locale === 'ar' ? 'ar' : 'en'" suit="shop-suit" @retry="refresh()" />
</template>

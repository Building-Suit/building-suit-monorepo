<script setup lang="ts">
import type { ChangelogEntry, ChangelogLocale, ChangelogCopy } from '@building-suit/contracts'
defineProps<{ entry: ChangelogEntry; suitName: string; locale: ChangelogLocale; copy: ChangelogCopy; isNew: boolean }>()
function date(value: string, locale: string) { return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(value)) }
</script>
<template>
  <article class="bs-changelog-card" :data-entry="entry.id">
    <div class="bs-changelog-card__meta">
      <BsText as="span" size="sm" emphasis="semibold">{{ suitName }}</BsText>
      <BsText as="bdi" dir="ltr" size="sm">{{ entry.status === 'released' ? entry.version : `${copy.targetVersion} ${entry.targetVersion}` }}</BsText>
      <BsStatusBadge :status="entry.status" :label="entry.status === 'released' ? copy.released : copy.comingSoon" :tone="entry.status === 'released' ? 'success' : 'info'" :icon="false" />
      <BsStatusBadge v-if="isNew" status="new" :label="copy.new" tone="neutral" :icon="false" />
    </div>
    <BsHeading :level="3" size="h3">{{ entry.title[locale] }}</BsHeading>
    <BsText>{{ entry.summary[locale] }}</BsText>
    <BsText wrap="preserve" size="sm" tone="muted">{{ entry.details[locale] }}</BsText>
    <div class="bs-changelog-card__dates">
      <BsText as="span" size="xs" tone="muted">{{ copy.published }} <BsText as="time" :datetime="entry.publishedAt" size="xs">{{ date(entry.publishedAt, locale) }}</BsText></BsText>
      <BsText v-if="entry.status === 'released'" as="span" size="xs" tone="muted">{{ copy.releasedAt }} <BsText as="time" :datetime="entry.releasedAt" size="xs">{{ date(entry.releasedAt, locale) }}</BsText></BsText>
    </div>
    <BsLink v-for="link in entry.links" :key="link.href" :to="link.href" external>{{ link.label[locale] }}</BsLink>
  </article>
</template>
<style>
.bs-changelog-card { display: grid; gap: var(--bs-space-3); padding-block-end: var(--bs-space-4); overflow-wrap: anywhere; }
.bs-changelog-card__meta, .bs-changelog-card__dates { display: flex; flex-wrap: wrap; align-items: center; gap: var(--bs-space-3); }
</style>

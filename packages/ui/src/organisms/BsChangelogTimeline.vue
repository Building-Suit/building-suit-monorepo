<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { parseChangelogFeed, filterChangelog, selectChangelogReleases, selectChangelogOverview, isChangelogNew } from '@building-suit/contracts'
import type { ChangelogFeed, ChangelogLocale, ChangelogCopy, ChangelogEntry, ChangelogFilter } from '@building-suit/contracts'
const props = withDefaults(defineProps<{
  feed: ChangelogFeed; locale: ChangelogLocale; copy: ChangelogCopy
  releasedOnly?: boolean; hideFilters?: boolean; releaseLimit?: number
  suit?: string; state?: 'ready' | 'loading' | 'error' | 'denied'
}>(), { suit: undefined, state: 'ready', releasedOnly: false, hideFilters: false, releaseLimit: undefined })
defineEmits<{ retry: [] }>()
const selectedSuit = ref(''), status = ref('')
const validated = computed(() => parseChangelogFeed(props.feed))
const filter = computed<ChangelogFilter>(() => ({ suit: props.suit ?? selectedSuit.value, status: props.releasedOnly ? 'released' : (status.value || undefined) as ChangelogEntry['status'] | undefined }))
const entries = computed(() => props.releaseLimit === undefined
  ? filterChangelog(validated.value, filter.value)
  : props.releasedOnly ? selectChangelogReleases(validated.value, filter.value, props.releaseLimit) : selectChangelogOverview(validated.value, filter.value, props.releaseLimit))
const groups = computed(() => {
  const byRelease = new Map<string, { id: string; items: ChangelogEntry[] }>()
  for (const entry of entries.value) {
    const id = JSON.stringify([entry.suit, entry.status, entry.status === 'released' ? entry.version : entry.targetVersion])
    const group = byRelease.get(id)
    if (group) group.items.push(entry)
    else byRelease.set(id, { id, items: [entry] })
  }
  return [...byRelease.values()]
})
const elapsed = ref(0)
let baseline = 0, timer: ReturnType<typeof setInterval> | undefined
// Advance a server snapshot by monotonic elapsed time. Browser wall-clock changes have no effect.
watch(() => props.feed.serverNow, () => { elapsed.value = 0; baseline = typeof performance === 'undefined' ? 0 : performance.now() })
onMounted(() => { baseline = performance.now(); timer = setInterval(() => { elapsed.value = Math.max(0, performance.now() - baseline) }, 1000) })
onBeforeUnmount(() => clearInterval(timer))
const now = computed(() => new Date(Date.parse(validated.value.serverNow) + elapsed.value).toISOString())
const stateTitle = computed(() => props.copy[props.state === 'ready' ? 'empty' : props.state])
</script>
<template>
  <section class="bs-changelog" :dir="locale === 'ar' ? 'rtl' : 'ltr'" :lang="locale" :aria-label="copy.timeline">
    <div v-if="!hideFilters" class="bs-changelog__filters">
      <BsSelect v-if="!suit" v-model="selectedSuit" native :label="copy.suit">
        <BsSelectOption value="">{{ copy.allSuits }}</BsSelectOption>
        <BsSelectOption v-for="item in validated.suits" :key="item.id" :value="item.id">{{ item.name[locale] }}</BsSelectOption>
      </BsSelect>
      <BsSelect v-if="!releasedOnly" v-model="status" native :label="copy.status">
        <BsSelectOption value="">{{ copy.allStatuses }}</BsSelectOption>
        <BsSelectOption value="released">{{ copy.released }}</BsSelectOption>
        <BsSelectOption value="coming-soon">{{ copy.comingSoon }}</BsSelectOption>
      </BsSelect>
    </div>
    <BsStateSurface v-if="state !== 'ready' || !entries.length" :state="state === 'ready' ? 'empty' : state" :title="stateTitle" :action-label="state === 'error' ? copy.retry : undefined" @action="$emit('retry')" />
    <BsTimeline v-else :entries="groups" :label="copy.timeline" item-key="id">
      <template #default="{ entry: group }">
        <BsStack gap="lg" :data-release="group.id">
          <BsHeading :level="2" size="body">{{ group.items[0]!.status === 'released' ? copy.released : copy.comingSoon }} · <BsText as="bdi" dir="ltr">{{ group.items[0]!.status === 'released' ? group.items[0]!.version : group.items[0]!.targetVersion }}</BsText></BsHeading>
          <BsChangelogCard v-for="entry in group.items" :key="entry.id" :entry="entry" :suit-name="validated.suits.find(item => item.id === entry.suit)!.name[locale]" :locale="locale" :copy="copy" :is-new="isChangelogNew(entry, now)" />
        </BsStack>
      </template>
    </BsTimeline>
  </section>
</template>
<style>
.bs-changelog { display: grid; gap: var(--bs-space-5); min-width: 0; }
.bs-changelog__filters { display: flex; flex-wrap: wrap; gap: var(--bs-space-3); }
.bs-changelog__filters > * { flex: 1 1 12rem; min-width: 0; }
</style>

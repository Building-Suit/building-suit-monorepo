<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount, useId } from 'vue'
import { parseChangelogFeed, filterChangelog, isChangelogNew } from '@building-suit/contracts'
import type { ChangelogFeed, ChangelogLocale, ChangelogCopy, ChangelogEntry, ChangelogFilter } from '@building-suit/contracts'
const props = withDefaults(defineProps<{
  feed: ChangelogFeed; locale: ChangelogLocale; copy: ChangelogCopy
  releasedOnly?: boolean; hideFilters?: boolean; releaseLimit?: number
  suit?: string; state?: 'ready' | 'loading' | 'error' | 'denied'
}>(), { suit: undefined, state: 'ready', releasedOnly: false, hideFilters: false, releaseLimit: undefined })
defineEmits<{ retry: [] }>()
const tabsId = useId()
const selectedSuit = ref(''), status = ref('released')
const validated = computed(() => parseChangelogFeed(props.feed))
const filter = computed<ChangelogFilter>(() => ({ suit: props.suit ?? selectedSuit.value, status: props.releasedOnly ? 'released' : status.value as ChangelogEntry['status'] }))
// Limit entries after status filtering, rather than limiting version groups.
const entries = computed(() => filterChangelog(validated.value, filter.value).slice(0, props.releaseLimit))
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
    <div v-if="!hideFilters && !suit" class="bs-changelog__filters">
      <BsSelect v-if="!suit" v-model="selectedSuit" native :label="copy.suit">
        <BsSelectOption value="">{{ copy.allSuits }}</BsSelectOption>
        <BsSelectOption v-for="item in validated.suits" :key="item.id" :value="item.id">{{ item.name[locale] }}</BsSelectOption>
      </BsSelect>
    </div>
    <BsTabs v-if="!releasedOnly" v-model="status" :id-prefix="tabsId" :label="copy.status" :tabs="[{ value: 'released', label: copy.released }, { value: 'coming-soon', label: copy.comingSoon }]" />
    <div :id="`${tabsId}-panel`" :role="releasedOnly ? undefined : 'tabpanel'" :aria-labelledby="releasedOnly ? undefined : `${tabsId}-${status}`" tabindex="0">
      <BsStateSurface v-if="state !== 'ready' || !entries.length" :state="state === 'ready' ? 'empty' : state" :title="stateTitle" :action-label="state === 'error' ? copy.retry : undefined" @action="$emit('retry')" />
      <BsTimeline v-else :entries="groups" :label="copy.timeline" item-key="id">
        <template #default="{ entry: group }">
          <BsStack gap="lg" :data-release="group.id">
            <BsChangelogCard v-for="entry in group.items" :key="entry.id" :entry="entry" :suit-name="validated.suits.find(item => item.id === entry.suit)!.name[locale]" :locale="locale" :copy="copy" :is-new="isChangelogNew(entry, now)" />
          </BsStack>
        </template>
      </BsTimeline>
    </div>
  </section>
</template>
<style>
.bs-changelog { display: grid; gap: var(--bs-space-5); min-width: 0; }
.bs-changelog__filters { display: flex; flex-wrap: wrap; gap: var(--bs-space-3); }
.bs-changelog__filters > * { flex: 1 1 12rem; min-width: 0; }
</style>

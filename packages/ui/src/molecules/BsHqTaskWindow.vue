<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWindowedList } from '@building-suit/ux'
import BsButton from '../atoms/BsButton.vue'
import type { HqAgentPresentation, HqTaskBrowserAdapter, HqTaskBrowserCopy, HqTaskGroup, HqTaskPresentation } from '../types/hqAgentsPresentation'

const props = defineProps<{ adapter: HqTaskBrowserAdapter; group: HqTaskGroup; officeId: string | null; compact: boolean; copy: HqTaskBrowserCopy; agents: readonly HqAgentPresentation[]; showOwner?: boolean; locale?: string }>()
const emit = defineEmits<{ select: [task: HqTaskPresentation]; counts: [counts: Record<HqTaskGroup, number> | null] }>()
const region = ref<HTMLElement | null>(null)
const partial = ref(false)
const key = computed(() => JSON.stringify([props.officeId, props.group, props.adapter.revision]))
const { items, offset, total, pending, failed, before, after, scroll, reload } = useWindowedList<HqTaskPresentation>({
  key: () => key.value, enabled: () => true, size: () => props.compact ? 3 : 12, rowHeight: 160,
  load: async (start, limit, signal) => {
    const page = await props.adapter.load({ group: props.group, officeId: props.officeId, offset: start, limit }, signal)
    if (signal.aborted) throw new Error('Task window superseded')
    partial.value = Boolean(page.partial)
    emit('counts', page.partial ? null : page.counts)
    return { items: page.items, total: page.counts[props.group] }
  },
})
watch(key, () => { if (region.value) region.value.scrollTop = 0 })
watch([offset, total], () => {
  if (region.value && region.value.scrollTop >= total.value * 160) region.value.scrollTop = offset.value * 160
})
function owner(task: HqTaskPresentation) {
  const agent = props.agents.find(item => item.id === task.assigneeId)
  return [task.assigneeName, agent?.roleLabel, agent?.departmentName].filter(Boolean).join(' · ')
}
function date(value: string) {
  const parsed = new Date(value)
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat(props.locale, { dateStyle: 'medium' }).format(parsed) : value
}
</script>

<template>
  <section class="bs-hq-task-window">
    <p v-if="partial && (!compact || group === 'running')" role="status">{{ copy.partial }}</p>
    <div ref="region" class="bs-hq-task-window__scroll" :class="{ 'bs-hq-task-window__scroll--compact': compact }" role="region" :aria-label="copy[group]" :aria-busy="pending" :tabindex="compact ? undefined : 0" @scroll.passive="!compact && scroll(($event.target as HTMLElement).scrollTop)">
      <div v-if="!compact" :style="{ height: `${before}px` }" aria-hidden="true" />
      <ul class="bs-hq-task-window__list" :aria-label="copy[group]">
        <li v-for="(task, index) in items" :key="task.id" :aria-posinset="offset + index + 1" :aria-setsize="partial ? -1 : total">
          <BsButton variant="tile" align="start" class="bs-hq-task-window__card" @click="emit('select', task)">
            <strong dir="auto">{{ task.title }}</strong>
            <span>{{ task.statusLabel }}</span>
            <span v-if="showOwner" class="bs-hq-task-window__owner" dir="auto">{{ copy.owner }}: {{ owner(task) }}</span>
            <time :datetime="task.completedAt ?? task.createdAt">{{ date(task.completedAt ?? task.createdAt) }}</time>
          </BsButton>
        </li>
      </ul>
      <p v-if="pending" class="bs-hq-task-window__state" role="status">{{ copy.loading }}</p>
      <p v-else-if="failed" class="bs-hq-task-window__state" role="alert">{{ copy.unavailable }} <BsButton @click="reload" variant="icon" :aria-label="copy.retry" :title="copy.retry"><BsIcon name="refresh" :size="18" /></BsButton></p>
      <p v-else-if="!total" class="bs-hq-task-window__state" role="status">{{ copy.empty }}</p>
      <div v-if="!compact" :style="{ height: `${after}px` }" aria-hidden="true" />
    </div>
  </section>
</template>

<style scoped>
.bs-hq-task-window { min-width: 0; }
.bs-hq-task-window p { margin: 0; color: var(--bs-text-muted); font-size: .75rem; line-height: 1.7; }
.bs-hq-task-window__scroll { max-height: min(60vh, 640px); overflow-y: auto; overflow-anchor: none; overscroll-behavior: contain; scrollbar-gutter: stable; }
.bs-hq-task-window__scroll--compact { max-height: none; overflow: visible; }
.bs-hq-task-window__scroll--compact .bs-hq-task-window__list > li { height: auto; }
.bs-hq-task-window__scroll--compact .bs-hq-task-window__card { min-height: 90px; }
.bs-hq-task-window__scroll:focus-visible { outline: 2px solid var(--bs-accent); outline-offset: 2px; }
.bs-hq-task-window__list { margin: 0; padding: 0; list-style: none; }
.bs-hq-task-window__list > li { height: 160px; box-sizing: border-box; padding-block-end: var(--bs-space-2); }
.bs-hq-task-window__card { display: flex; flex-direction: column; align-items: stretch; justify-content: center; gap: var(--bs-space-1); width: 100%; height: 100%; box-sizing: border-box; text-align: start; overflow: hidden; background: var(--bs-component-hq-glass-card); }
.bs-hq-task-window__card strong, .bs-hq-task-window__owner { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
.bs-hq-task-window__card strong { font-size: .85rem; line-height: 1.5; }
.bs-hq-task-window__card span, .bs-hq-task-window__card time { color: var(--bs-text-muted); font-size: .75rem; line-height: 1.5; }
.bs-hq-task-window__state { padding: var(--bs-space-3); }
</style>

<script setup lang="ts">
import { useDisplayClock } from '@building-suit/ux'
import BsButton from '../atoms/BsButton.vue'
import type { HqWorkActivity, HqWorkActivityCopy } from '../types/hqAgentsPresentation'

const props = defineProps<{ items: readonly HqWorkActivity[]; copy: HqWorkActivityCopy; locale?: string; compact?: boolean }>()
const emit = defineEmits<{ openTask: [id: string] }>()
const now = useDisplayClock(() => props.items.length > 0)
function elapsed(item: HqWorkActivity): string {
  const start = Date.parse(item.state === 'queued' ? item.createdAt : item.startedAt ?? item.createdAt)
  if (!now.value || !Number.isFinite(start)) return '—'
  const seconds = Math.max(0, Math.floor((now.value - start) / 1000))
  const number = new Intl.NumberFormat(props.locale, { minimumIntegerDigits: 2, useGrouping: false })
  return `${number.format(Math.floor(seconds / 60))}:${number.format(seconds % 60)}`
}
</script>

<template>
  <section class="bs-hq-activity" :data-compact="compact || undefined" :aria-label="copy.title">
    <h3>{{ copy.title }}</h3>
    <p v-if="!items.length" class="bs-hq-activity__empty">{{ copy.empty }}</p>
    <ul v-else>
      <li v-for="item in items" :key="item.id" :data-state="item.state">
        <div class="bs-hq-activity__line"><strong dir="auto">{{ item.agentName }}</strong><span>{{ copy[item.state] }}</span></div>
        <p>{{ copy.stages[item.stage] ?? copy.stage }}</p>
        <BsButton v-if="item.taskId" variant="secondary" size="sm" @click="emit('openTask', item.taskId)">{{ copy.openTask }}<template v-if="item.taskTitle"> · {{ item.taskTitle }}</template></BsButton>
        <p v-else-if="item.taskTitle" dir="auto">{{ item.taskTitle }}</p>
        <small>{{ item.state === 'queued' ? copy.waiting : copy.elapsed }} <bdi>{{ elapsed(item) }}</bdi></small>
      </li>
    </ul>
    <small>{{ copy.observed }}</small>
  </section>
</template>

<style scoped>
.bs-hq-activity { display: grid; gap: var(--bs-space-2); min-width: 0; padding: var(--bs-space-3); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-component-hq-glass-card); }
.bs-hq-activity h3, .bs-hq-activity p { margin: 0; font-size: .75rem; line-height: 1.6; overflow-wrap: anywhere; }
.bs-hq-activity ul { display: grid; gap: var(--bs-space-3); max-height: 10rem; overflow: auto; margin: 0; padding: 0; list-style: none; }
.bs-hq-activity[data-compact] ul { max-height: 6rem; }
.bs-hq-activity li { display: grid; gap: var(--bs-space-1); border-inline-start: 2px solid var(--bs-border); padding-inline-start: var(--bs-space-2); }
.bs-hq-activity li[data-state='working'] { border-color: var(--bs-accent); }
.bs-hq-activity__line { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: var(--bs-space-2); font-size: .75rem; }
.bs-hq-activity small, .bs-hq-activity__empty, .bs-hq-activity__line span { color: var(--bs-text-muted); font-size: .65rem; line-height: 1.6; }
.bs-hq-activity :deep(button) { text-align: start; justify-content: start; font-size: .7rem; overflow-wrap: anywhere; }
</style>

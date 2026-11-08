<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import BsTabs from '../molecules/BsTabs.vue'
import BsHqTaskWindow from '../molecules/BsHqTaskWindow.vue'
import type { HqAgentPresentation, HqTaskBrowserAdapter, HqTaskBrowserCopy, HqTaskGroup, HqTaskPresentation } from '../types/hqAgentsPresentation'
const props = defineProps<{ adapter: HqTaskBrowserAdapter; copy: HqTaskBrowserCopy; agents: readonly HqAgentPresentation[]; officeId?: string | null; showOwner?: boolean; locale?: string }>()
const emit = defineEmits<{ select: [task: HqTaskPresentation] }>()
const tab = ref<'all' | HqTaskGroup>('all')
const counts = ref<Record<HqTaskGroup, number> | null>(null)
const groups: HqTaskGroup[] = ['running', 'waiting', 'done']
const id = useId()
const tabs = computed(() => ['all', ...groups].map(value => ({ value, label: props.copy[value as 'all' | HqTaskGroup],
  ...(counts.value ? { count: value === 'all' ? counts.value.running + counts.value.waiting + counts.value.done : counts.value[value as HqTaskGroup] } : {}),
})))
const visibleGroups = computed(() => tab.value === 'all' ? groups : [tab.value])
watch(() => [props.officeId, props.adapter.revision], () => { counts.value = null })
function choose(value: string) { if (value === 'all' || groups.includes(value as HqTaskGroup)) tab.value = value as typeof tab.value }
</script>
<template>
  <section class="bs-hq-task-browser">
    <BsTabs variant="hq" class="bs-hq-task-browser__tabs" :model-value="tab" :tabs="tabs" :label="copy.all" :id-prefix="id" @update:model-value="choose" />
    <div :id="`${id}-panel`" role="tabpanel" :aria-labelledby="`${id}-${tab}`">
      <section v-for="group in visibleGroups" :key="`${officeId}:${group}:${tab === 'all'}`" class="bs-hq-task-browser__group">
        <h3 v-if="tab === 'all'">{{ copy[group] }} <span v-if="counts">{{ counts[group] }}</span></h3>
        <BsHqTaskWindow :adapter="adapter" :copy="copy" :group="group" :office-id="officeId ?? null" :compact="tab === 'all'" :agents="agents" :show-owner="showOwner" :locale="locale" @counts="counts = $event" @select="emit('select', $event)" />
      </section>
    </div>
  </section>
</template>
<style scoped>
.bs-hq-task-browser { display: grid; gap: var(--bs-space-3); min-width: 0; }
.bs-hq-task-browser__tabs { position: sticky; inset-block-start: 0; z-index: 2; flex-wrap: wrap; }
.bs-hq-task-browser__tabs :deep(.ls-action-tab) { padding-inline: var(--bs-space-2); }
.bs-hq-task-browser__group { min-width: 0; margin-block-end: var(--bs-space-4); }
.bs-hq-task-browser__group h3 { display: flex; gap: var(--bs-space-2); margin: 0 0 var(--bs-space-2); font-size: .85rem; }
.bs-hq-task-browser__group h3 span { color: var(--bs-text-muted); font-weight: var(--bs-weight-regular); }
</style>

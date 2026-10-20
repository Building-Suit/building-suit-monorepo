<script setup lang="ts">
import type { BsOfflineCounterView } from '../types/offlineCounterPresentation'
defineProps<{ view: BsOfflineCounterView; compact?: boolean }>()
const emit = defineEmits<{ reconcile: [id: string]; retry: [id: string] }>()
</script>
<template>
  <section v-if="view.notice || view.records.length" class="bs-offline-status" :data-compact="compact || undefined" aria-live="polite">
    <BsText v-if="view.notice" class="bs-offline-status__notice" as="p" size="sm" role="status"><BsIcon name="notification" :size="16" />{{ view.notice }}</BsText>
    <component :is="compact ? 'details' : 'div'" v-if="view.records.length">
      <summary v-if="compact">{{ view.recordsLabel || view.retry }} · {{ view.records.length }}</summary>
    <BsStack v-for="record in view.records" :key="record.id" gap="sm">
      <BsText as="p" :role="record.state === 'failed' && !record.isResolved ? 'alert' : undefined">{{ record.label }} · {{ record.id }} · {{ record.status }} <BsText v-if="record.detail">· {{ record.detail }}</BsText></BsText>
      <BsButton v-if="record.canRetry !== false && (record.state === 'failed' || record.state === 'unsynced')" @click="emit('retry', record.id)">{{ view.retry }}</BsButton>
      <BsButton v-if="record.canReconcile" @click="emit('reconcile', record.id)">{{ view.reconcile }}</BsButton>
      <BsLink v-if="record.receipt" :to="record.receipt">{{ record.id }}</BsLink>
    </BsStack>
    </component>
  </section>
</template>

<style scoped>
.bs-offline-status { padding: var(--bs-space-4); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-card); background: var(--bs-surface); }
.bs-offline-status[data-compact] { padding: var(--bs-space-2) 0; border: 0; border-radius: 0; background: transparent; }
.bs-offline-status__notice { display: flex; align-items: start; gap: var(--bs-space-2); margin: 0; color: var(--bs-text-muted); }
.bs-offline-status__notice :deep(svg) { flex-shrink: 0; margin-block-start: .15rem; color: var(--bs-status-warning); }
.bs-offline-status summary { cursor: pointer; padding-block: var(--bs-space-2); font-size: var(--bs-type-caption-size); }
.bs-offline-status details[open] { max-block-size: 16rem; overflow-y: auto; }
</style>

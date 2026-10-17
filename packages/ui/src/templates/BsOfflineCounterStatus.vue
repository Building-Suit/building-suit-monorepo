<script setup lang="ts">
import type { BsOfflineCounterView } from '../types/offlineCounterPresentation'
defineProps<{ view: BsOfflineCounterView }>()
const emit = defineEmits<{ reconcile: [id: string]; retry: [id: string] }>()
</script>
<template>
  <BsPanel padding="md" aria-live="polite">
    <BsText as="p" role="status">{{ view.notice }}</BsText>
    <BsStack v-for="record in view.records" :key="record.id" gap="sm">
      <BsText as="p" :role="record.state === 'failed' && !record.isResolved ? 'alert' : undefined">{{ record.label }} · {{ record.id }} · {{ record.status }} <BsText v-if="record.detail">· {{ record.detail }}</BsText></BsText>
      <BsButton v-if="record.canRetry !== false && (record.state === 'failed' || record.state === 'unsynced')" @click="emit('retry', record.id)">{{ view.retry }}</BsButton>
      <BsButton v-if="record.canReconcile" @click="emit('reconcile', record.id)">{{ view.reconcile }}</BsButton>
      <BsLink v-if="record.receipt" :to="record.receipt">{{ record.id }}</BsLink>
    </BsStack>
  </BsPanel>
</template>

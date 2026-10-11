<script setup lang="ts">
import type { BsInvitationAction } from '@building-suit/ux'
import type { BsAccessInvitationView } from '../types/accessPresentation'
const props = defineProps<{
  invitations: BsAccessInvitationView[]
  label: string
  emptyLabel: string
  pending?: boolean
  labels: { email: string; role: string; status: string; sent: string; actions: string; sender?: string; expires?: string }
}>()
const emit = defineEmits<{ action: [key: string, id: string] }>()
const columns = computed(() => [
  { key: 'email', header: props.labels.email },
  { key: 'role', header: props.labels.role, field: 'role' },
  { key: 'status', header: props.labels.status },
  ...(props.labels.sender ? [{ key: 'sender', header: props.labels.sender }] : []),
  { key: 'sent', header: props.labels.sent, field: 'sent' },
  ...(props.labels.expires ? [{ key: 'expires', header: props.labels.expires, field: 'expires' }] : []),
  { key: 'actions', header: props.labels.actions, align: 'end' as const },
])
</script>
<template>
  <BsInvitationTable :invitations="invitations" :columns="columns" :label="label" row-key="id" actions-key="actions" :actions="row => row.actions" :pending="pending" @action="(key, row) => emit('action', key, row.id)">
    <template #cell-email="{ row }"><BsText dir="ltr">{{ row.email }}</BsText></template>
    <template #cell-status="{ row }"><BsStatusBadge :status="row.status" :label="row.statusLabel" /></template>
    <template #cell-sender="{ row }"><BsText>{{ row.sender }}</BsText><BsText v-if="row.senderDetail" size="xs" tone="muted">{{ row.senderDetail }}</BsText></template>
    <template #empty><BsEmptyState :title="emptyLabel" /></template>
  </BsInvitationTable>
</template>

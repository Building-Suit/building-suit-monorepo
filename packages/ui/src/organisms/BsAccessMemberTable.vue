<script setup lang="ts">
import type { BsAccessMemberView, BsAccessMemberAction } from '../types/accessPresentation'
const props = defineProps<{
  members: BsAccessMemberView[]
  label: string
  emptyLabel: string
  labels: { name: string; role: string; status: string; actions: string; joined?: string; locations?: string }
  pending?: boolean
}>()
const emit = defineEmits<{ action: [key: BsAccessMemberAction['key'], id: string] }>()
const columns = computed(() => [
  { key: 'name', header: props.labels.name },
  { key: 'role', header: props.labels.role },
  ...(props.labels.locations ? [{ key: 'locations', header: props.labels.locations, field: 'locations' }] : []),
  { key: 'status', header: props.labels.status },
  ...(props.labels.joined ? [{ key: 'joined', header: props.labels.joined, field: 'joined' }] : []),
  { key: 'actions', header: props.labels.actions, align: 'end' as const },
])
</script>
<template>
  <BsTeamTable :members="members" :columns="columns" row-key="id" :label="label">
    <template #cell-name="{ row }">
      <BsText emphasis="semibold">{{ row.name }}</BsText>
      <BsText dir="ltr" size="xs" tone="muted">{{ row.email }}</BsText>
      <BsText v-if="row.jobTitle" size="xs" tone="muted">{{ row.jobTitle }}</BsText>
    </template>
    <template #cell-role="{ row }">
      <BsBadge>{{ row.role }}</BsBadge>
      <BsText v-if="row.roleNote" size="xs" tone="muted">{{ row.roleNote }}</BsText>
    </template>
    <template #cell-status="{ row }"><BsStatusBadge :status="row.status" :label="row.statusLabel" /></template>
    <template #cell-actions="{ row }">
      <BsInline gap="xs" :wrap="true">
        <BsButton v-for="action in row.actions" :key="action.key" size="sm" :variant="action.tone ?? 'default'" :disabled="pending || action.disabled" @click="emit('action', action.key, row.id)">{{ action.label }}</BsButton>
      </BsInline>
    </template>
    <template #empty><BsEmptyState :title="emptyLabel" /></template>
  </BsTeamTable>
</template>

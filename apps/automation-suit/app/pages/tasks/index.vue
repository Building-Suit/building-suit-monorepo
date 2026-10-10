<script setup lang="ts">
import { automationStatusTone } from '../../utils/automationStatusTone'
import type { BsDataTable } from '#components'
import type { TaskRow, DashboardResponse } from '../../../types/dashboard'
const workstream = ref(''); const statusFilter = ref('')
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
const rows = computed(() => (data.value?.tasks ?? []).filter(row => (!workstream.value || row.suit_slug === workstream.value) && (!statusFilter.value || row.status === statusFilter.value)))
const workstreamOptions = computed(() => [{ value: '', label: 'All workstreams' }, ...(data.value?.suits ?? []).map(suit => ({ value: suit.slug, label: suit.display_name }))])
const statusOptions = [{ value: '', label: 'All states' }, ...['planned', 'ready', 'blocked', 'in_progress', 'verification', 'failed', 'passed', 'complete', 'cancelled'].map(value => ({ value, label: value }))]

// Derive the public column contract from Nuxt's registered shared component.
type BsDataTableColumn<Row extends object> = NonNullable<Parameters<typeof BsDataTable<Row>>[0]['columns']>[number]

const taskColumns: BsDataTableColumn<TaskRow>[] = [
  { key: 'task_id', header: 'Task', field: 'task_id', width: 'content' },
  { key: 'suit_slug', header: 'Workstream', field: 'suit_slug' },
  { key: 'title', header: 'Title', field: 'title', width: 'xl' },
  { key: 'status', header: 'Status', field: 'status' },
  { key: 'model_profile', header: 'Profile', field: 'model_profile' },
]
</script>

<template>
  <BsPage padding="none" width="full">
    <BsStack gap="sm">
      <BsText size="xs" tone="muted" emphasis="semibold">
        Control plane
      </BsText>
      <BsHeading :level="1">
        Tasks
      </BsHeading>
    </BsStack>
    <BsInline>
      <BsSelect v-model="workstream" label="Workstream" :options="workstreamOptions" option-label="label" option-value="value" />
      <BsSelect v-model="statusFilter" label="Status" :options="statusOptions" option-label="label" option-value="value" />
    </BsInline>
    <BsAlert v-if="error" tone="error" :description="error.message" />
    <BsCard padding="none">
      <BsStack gap="sm">
        <BsDataTable :value="rows" row-key="task_id" label="Tasks" scroll-label="Tasks" :columns="taskColumns">
          <template #cell-task_id="{ row: task }">
            <BsLink :to="`/tasks/${task.task_id}`">
              {{ task.task_id }}
            </BsLink>
          </template>
          <template #cell-status="{ row: task }">
            <BsStatusBadge :status="task.status" :label="(task.status) || 'unknown'" :tone="automationStatusTone(task.status)" />
          </template>
        </BsDataTable>
      </BsStack>
    </BsCard>
  </BsPage>
</template>

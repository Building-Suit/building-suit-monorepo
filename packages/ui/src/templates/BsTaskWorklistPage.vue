<script setup lang="ts">
import type { BsTaskWorklistRow } from '../types/taskPresentation'
const workstream = defineModel<string>('workstream', { required: true })
const status = defineModel<string>('status', { required: true })
defineProps<{
  title: string
  eyebrow: string
  rows: BsTaskWorklistRow[]
  labels: { task: string; workstream: string; title: string; status: string; profile: string }
  workstreams: { value: string; label: string }[]
  statuses: { value: string; label: string }[]
  error?: string | null
}>()
</script>
<template>
  <BsPage padding="none" width="full"><BsStack gap="md">
    <BsStack gap="sm"><BsText size="xs" tone="muted" emphasis="semibold">{{ eyebrow }}</BsText><BsHeading :level="1">{{ title }}</BsHeading></BsStack>
    <BsInline :wrap="true"><BsSelect v-model="workstream" :label="labels.workstream" :options="workstreams" option-label="label" option-value="value" /><BsSelect v-model="status" :label="labels.status" :options="statuses" option-label="label" option-value="value" /></BsInline>
    <BsAlert v-if="error" tone="error" :description="error" />
    <BsDataTable :value="rows" row-key="id" :label="title" :scroll-label="title" :columns="[{ key: 'task', header: labels.task, width: 'content' }, { key: 'workstream', header: labels.workstream, field: 'workstream' }, { key: 'title', header: labels.title, field: 'title', width: 'xl' }, { key: 'status', header: labels.status }, { key: 'profile', header: labels.profile, field: 'profile' }]"><template #cell-task="{ row }"><BsLink :to="row.to">{{ row.id }}</BsLink></template><template #cell-status="{ row }"><BsStatusBadge :status="row.status" :label="row.statusLabel" :tone="row.statusTone" /></template></BsDataTable>
  </BsStack></BsPage>
</template>

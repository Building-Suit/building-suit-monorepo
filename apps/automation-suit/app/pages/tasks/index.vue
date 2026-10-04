<script setup lang="ts">
import type { DashboardResponse } from '../../../types/dashboard'
const workstream = ref(''); const statusFilter = ref('')
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
const rows = computed(() => (data.value?.tasks ?? []).filter(row => (!workstream.value || row.suit_slug === workstream.value) && (!statusFilter.value || row.status === statusFilter.value)))
const workstreamOptions = computed(() => [{ value: '', label: 'All workstreams' }, ...(data.value?.suits ?? []).map(suit => ({ value: suit.slug, label: suit.display_name }))])
const statusOptions = [{ value: '', label: 'All states' }, ...['planned', 'ready', 'blocked', 'in_progress', 'verification', 'failed', 'passed', 'complete', 'cancelled'].map(value => ({ value, label: value }))]
</script>

<template>
  <main class="space-y-5">
    <div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Control plane</p><h1 class="mt-2 text-3xl font-black">Tasks</h1></div>
    <div class="flex flex-wrap gap-2">
      <BsSelect v-model="workstream" label="Workstream" :options="workstreamOptions" option-label="label" option-value="value" class="min-w-48" />
      <BsSelect v-model="statusFilter" label="Status" :options="statusOptions" option-label="label" option-value="value" class="min-w-40" />
    </div>
    <p v-if="error" class="text-danger">{{ error.message }}</p>
    <BsCard padding="none">
      <BsDataTable :value="rows" data-key="task_id" label="Tasks" scroll-label="Tasks" class="overflow-x-auto">
        <Column field="task_id" header="Task"><template #body="{ data: task }"><NuxtLink class="font-mono font-bold text-link" :to="`/tasks/${task.task_id}`">{{ task.task_id }}</NuxtLink></template></Column>
        <Column field="suit_slug" header="Workstream" />
        <Column field="title" header="Title" />
        <Column field="status" header="Status"><template #body="{ data: task }"><DashboardStatusPill :value="task.status" /></template></Column>
        <Column field="model_profile" header="Profile" body-class="text-xs text-fg-muted" />
      </BsDataTable>
    </BsCard>
  </main>
</template>

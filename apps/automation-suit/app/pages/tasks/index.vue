<script setup lang="ts">
import { automationStatusTone } from '../../utils/automationStatusTone'
import type { BsTaskWorklistRow } from '@building-suit/ui/task-presentation'
import type { DashboardResponse } from '../../../types/dashboard'
const workstream = ref(''); const statusFilter = ref('')
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
const rows = computed(() => (data.value?.tasks ?? []).filter(row => (!workstream.value || row.suit_slug === workstream.value) && (!statusFilter.value || row.status === statusFilter.value)))
const workstreamOptions = computed(() => [{ value: '', label: 'All workstreams' }, ...(data.value?.suits ?? []).map(suit => ({ value: suit.slug, label: suit.display_name }))])
const statusOptions = [{ value: '', label: 'All states' }, ...['planned', 'ready', 'blocked', 'in_progress', 'verification', 'failed', 'passed', 'complete', 'cancelled'].map(value => ({ value, label: value }))]

const taskViews = computed<BsTaskWorklistRow[]>(() => rows.value.map(task => ({ id: task.task_id, to: `/tasks/${task.task_id}`, workstream: task.suit_slug, title: task.title, profile: task.model_profile || '', status: task.status || 'unknown', statusLabel: task.status || 'unknown', statusTone: automationStatusTone(task.status) })))
</script>

<template>
  <BsTaskWorklistPage v-model:workstream="workstream" v-model:status="statusFilter" title="Tasks" eyebrow="Control plane" :rows="taskViews" :workstreams="workstreamOptions" :statuses="statusOptions" :error="error?.message" :labels="{ task: 'Task', workstream: 'Workstream', title: 'Title', status: 'Status', profile: 'Profile' }" />
</template>

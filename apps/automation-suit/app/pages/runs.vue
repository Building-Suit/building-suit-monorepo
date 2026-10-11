<script setup lang="ts">
import type { BsExecutionActivityItem } from '@building-suit/ui/activity-presentation'
import { automationStatusTone } from '../utils/automationStatusTone'
import type { DashboardResponse } from '../../types/dashboard'
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
const activities = computed<BsExecutionActivityItem[]>(() => (data.value?.workflowRuns ?? []).map(run => ({ id: run.run_id, title: run.suit_slug, subtitle: run.run_id, status: run.status || 'unknown', statusLabel: run.status || 'unknown', statusTone: automationStatusTone(run.status), summary: `${run.completed_tasks} / ${run.max_tasks} tasks · stop requested: ${run.stop_requested ? 'yes' : 'no'}` })))
</script>
<template>
  <BsExecutionActivityPage eyebrow="Batch execution" title="Runs" :items="activities" :error="error?.message" />
</template>

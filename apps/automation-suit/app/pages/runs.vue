<script setup lang="ts">
import type { DashboardResponse } from '../../types/dashboard'
const { data, error } = await useFetch<DashboardResponse>('/api/dashboard')
</script>
<template><main class="space-y-5"><div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Batch execution</p><h1 class="mt-2 text-3xl font-black">Runs</h1></div><p v-if="error" class="text-danger">{{ error.message }}</p><article v-for="run in data?.workflowRuns || []" :key="run.run_id" class="rounded-card border border-[var(--bs-border)] bg-surface p-5"><div class="flex justify-between gap-3"><div><h2 class="font-black">{{ run.suit_slug }}</h2><p class="font-mono text-xs text-fg-muted">{{ run.run_id }}</p></div><DashboardStatusPill :value="run.status" /></div><p class="mt-3 text-sm">{{ run.completed_tasks }} / {{ run.max_tasks }} tasks · stop requested: {{ run.stop_requested ? 'yes' : 'no' }}</p></article></main></template>

<script setup lang="ts">
import type { ProjectRow, WorkstreamRow } from '../../types/operations'
const { data, error, refresh } = await useFetch<{ projects: ProjectRow[]; workstreams: WorkstreamRow[] }>('/api/projects')
const streamsFor = (id: string) => data.value?.workstreams.filter(row => row.project_id === id) ?? []
</script>

<template>
  <main class="space-y-5">
    <div class="flex items-center justify-between"><div><p class="text-xs font-bold uppercase tracking-widest text-fg-muted">Registry</p><h1 class="mt-2 text-3xl font-black">Projects</h1><p class="mt-1 text-sm text-fg-muted">Repository, branch, policy, workstream and concurrency configuration.</p></div><button class="rounded-control border border-[var(--bs-border)] px-3 py-2 text-sm font-bold" @click="refresh()">Refresh</button></div>
    <p v-if="error" class="rounded-card border border-danger/40 p-4 text-danger">{{ error.message }}</p>
    <article v-for="project in data?.projects || []" :key="project.project_id" class="rounded-card border border-[var(--bs-border)] bg-surface p-5">
      <div class="flex flex-wrap justify-between gap-3"><div><div class="flex items-center gap-2"><h2 class="text-xl font-black">{{ project.display_name }}</h2><DashboardStatusPill :value="project.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ project.slug }} · {{ project.github_repository }}</p></div><div class="text-end text-xs text-fg-muted"><p>{{ project.integration_branch }} → {{ project.production_branch }}</p><p>{{ project.retry_policy_id || 'global retry policy' }} · {{ project.default_model_profile }}</p></div></div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3"><div v-for="stream in streamsFor(project.project_id)" :key="stream.slug" class="rounded-control border border-[var(--bs-border)] p-3"><div class="flex justify-between gap-2"><strong>{{ stream.display_name }}</strong><DashboardStatusPill :value="stream.active ? 'active' : 'inactive'" /></div><p class="mt-1 font-mono text-xs text-fg-muted">{{ stream.slug }} · {{ stream.stack_key }}</p><p class="mt-2 text-xs text-fg-muted">{{ stream.application_path || 'No application path' }}</p></div></div>
      <details class="mt-4 text-xs"><summary class="cursor-pointer font-bold text-link">Configuration</summary><pre class="mt-2 overflow-auto rounded-control bg-background p-3">{{ JSON.stringify(project, null, 2) }}</pre></details>
    </article>
  </main>
</template>

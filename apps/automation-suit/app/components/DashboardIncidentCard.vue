<script setup lang="ts">
import type { Incident } from '../../types/dashboard'

defineProps<{ incident: Incident }>()
</script>

<template>
  <article
    class="rounded-card border p-4"
    :class="incident.severity === 'critical'
      ? 'border-danger/40 bg-[var(--bs-status-danger-bg)]'
      : incident.severity === 'warning'
        ? 'border-warning/40 bg-[var(--bs-status-warning-bg)]'
        : 'border-[var(--bs-border)] bg-surface'"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <DashboardStatusPill :value="incident.severity" />
          <span class="text-xs font-mono text-fg-muted">{{ incident.kind }}</span>
        </div>
        <h3 class="mt-2 text-base font-black text-fg">{{ incident.title }}</h3>
        <p class="mt-1 text-sm text-fg-muted">{{ incident.detail }}</p>
      </div>
      <div class="text-end text-xs text-fg-muted">
        <div v-if="incident.suit_slug">{{ incident.suit_slug }}</div>
        <div v-if="incident.task_id" class="font-mono">{{ incident.task_id }}</div>
      </div>
    </div>

    <div class="mt-4 rounded-control border border-[var(--bs-border)] bg-surface/70 p-3">
      <p class="text-xs font-bold uppercase tracking-wide text-fg-muted">Recovery</p>
      <p class="mt-1 text-sm text-fg">{{ incident.recovery }}</p>
    </div>

    <details class="mt-3 text-xs">
      <summary class="cursor-pointer font-bold text-link">Evidence</summary>
      <pre class="mt-2 max-h-64 overflow-auto rounded-control border border-[var(--bs-border)] bg-background p-3 font-mono text-[11px] leading-5 text-fg">{{ JSON.stringify(incident.evidence, null, 2) }}</pre>
    </details>
  </article>
</template>

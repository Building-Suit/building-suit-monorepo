<script setup lang="ts">
const props = defineProps<{ value?: string | null }>()

const normalized = computed(() => String(props.value || 'unknown').toLowerCase())
const tone = computed(() => {
  if (['failed', 'fail', 'critical', 'cancelled'].includes(normalized.value)) return 'danger'
  if (['blocked', 'warning', 'not_run', 'stopped'].includes(normalized.value)) return 'warning'
  if (['running', 'in_progress', 'verification', 'open', 'planned', 'queued'].includes(normalized.value)) return 'active'
  if (['passed', 'pass', 'complete', 'finished', 'succeeded', 'merged', 'approved'].includes(normalized.value)) return 'success'
  return 'neutral'
})
</script>

<template>
  <span
    class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold"
    :class="{
      'border-danger/40 bg-[var(--bs-status-danger-bg)] text-danger': tone === 'danger',
      'border-warning/40 bg-[var(--bs-status-warning-bg)] text-warning': tone === 'warning',
      'border-[var(--bs-border-strong)] bg-surface-muted text-fg': tone === 'active',
      'border-success/40 bg-[var(--bs-status-success-bg)] text-success': tone === 'success',
      'border-[var(--bs-border)] bg-surface-muted text-fg-muted': tone === 'neutral',
    }"
  >
    {{ value || 'unknown' }}
  </span>
</template>

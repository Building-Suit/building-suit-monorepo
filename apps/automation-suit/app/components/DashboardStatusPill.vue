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
  <BsStatusBadge :status="normalized" :label="value || 'unknown'" :tone="tone === 'active' ? 'info' : tone" />
</template>

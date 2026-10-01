<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  changeLabel?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' | string
  hint?: string
}>(), { changeLabel: undefined, tone: 'neutral', hint: undefined })

const toneClass = computed(() => ({
  neutral: 'text-fg-muted',
  success: 'text-[var(--bs-status-success)]',
  warning: 'text-[var(--bs-status-warning)]',
  danger: 'text-[var(--bs-status-error)]',
  info: 'text-[var(--bs-status-info)]',
}[props.tone] ?? props.tone))
</script>

<template>
  <BsCard padding="lg">
    <p class="text-sm text-fg-muted">{{ title }}</p>
    <div class="mt-2 text-2xl font-extrabold"><slot /></div>
    <p v-if="changeLabel" class="mt-1 text-xs font-medium" :class="toneClass">{{ changeLabel }}</p>
    <p v-else-if="hint" class="mt-1 text-xs text-fg-muted">{{ hint }}</p>
  </BsCard>
</template>

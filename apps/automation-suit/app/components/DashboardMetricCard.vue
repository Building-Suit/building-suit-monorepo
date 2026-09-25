<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; danger?: boolean }>()
</script>

<template>
  <div class="rounded-card border border-[var(--bs-border)] bg-surface p-4 shadow-sm">
    <p class="text-xs font-semibold uppercase tracking-wide text-fg-muted">{{ label }}</p>
    <p class="mt-2 text-3xl font-black" :class="danger ? 'text-danger' : 'text-fg'">{{ value }}</p>
    <p v-if="hint" class="mt-1 text-xs text-fg-muted">{{ hint }}</p>
  </div>
</template>

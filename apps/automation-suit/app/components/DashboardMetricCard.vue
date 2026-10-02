<script setup lang="ts">
defineProps<{ label: string; value: string | number; hint?: string; danger?: boolean }>()
</script>

<template>
  <BsKpiCard :title="label" :hint="hint" :tone="danger ? 'danger' : 'neutral'">
    <span :class="danger ? 'text-danger' : 'text-fg'">{{ value }}</span>
  </BsKpiCard>
</template>

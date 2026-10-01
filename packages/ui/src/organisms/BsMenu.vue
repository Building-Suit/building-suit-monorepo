<script setup lang="ts">
withDefaults(defineProps<{ label: string; align?: 'start' | 'end' }>(), { align: 'end' })
</script>

<template>
  <details class="ls-menu">
    <summary class="ls-action-icon" :aria-label="label"><slot name="trigger"><AppIcon name="menu" /></slot></summary>
    <div class="ls-menu__panel" :class="align === 'start' ? 'start-0' : 'end-0'" role="menu"><slot /></div>
  </details>
</template>

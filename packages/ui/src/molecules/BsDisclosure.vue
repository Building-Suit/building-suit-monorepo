<script setup lang="ts">
withDefaults(defineProps<{ summary: string; open?: boolean; variant?: 'plain' | 'surface'; density?: 'compact' | 'comfortable' }>(), {
  open: false, variant: 'plain', density: 'comfortable',
})
</script>

<template><details class="bs-disclosure" :class="[`bs-disclosure--${variant}`, `bs-disclosure--${density}`]" :open="open"><summary><span>{{ summary }}</span><BsIcon name="arrowDown" :size="16" /></summary><div class="bs-disclosure__content"><slot /></div></details></template>

<script setup lang="ts">
withDefaults(defineProps<{ shape?: 'text' | 'control' | 'circle' | 'block'; size?: 'xs' | 'sm' | 'md' | 'lg' | 'full'; ariaLabel?: string }>(), {
  shape: 'text', size: 'md', ariaLabel: undefined,
})
</script>

<template><span class="bs-skeleton ls-skeleton" :class="[`bs-skeleton--${shape}`, `bs-skeleton--${size}`]" :aria-label="ariaLabel" :aria-hidden="ariaLabel ? undefined : true" /></template>

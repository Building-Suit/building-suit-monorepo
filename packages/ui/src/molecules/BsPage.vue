<script setup lang="ts">
withDefaults(defineProps<{ width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; padding?: 'none' | 'sm' | 'md' | 'lg'; gap?: 'none' | 'sm' | 'md' | 'lg' }>(), {
  width: 'xl', padding: 'md', gap: 'lg',
})
</script>

<template><main class="bs-page" :class="[`bs-page--width-${width}`, `bs-page--padding-${padding}`, `bs-page--gap-${gap}`]"><slot /></main></template>

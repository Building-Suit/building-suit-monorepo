<script setup lang="ts">
withDefaults(defineProps<{ as?: 'section' | 'aside' | 'div'; tone?: 'default' | 'muted' | 'info'; padding?: 'sm' | 'md' | 'lg'; labelledby?: string }>(), {
  as: 'section', tone: 'default', padding: 'md', labelledby: undefined,
})
</script>

<template><component :is="as" class="bs-panel" :class="[`bs-panel--${tone}`, `bs-panel--padding-${padding}`]" :aria-labelledby="labelledby"><slot /></component></template>

<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article'; width?: 'sm' | 'md' | 'lg' | 'xl' | 'full'; padding?: 'none' | 'sm' | 'md' | 'lg'; center?: boolean }>(), {
  as: 'div', width: 'lg', padding: 'md', center: true,
})
</script>

<template><component :is="as" class="bs-container" :class="[`bs-container--${width}`, `bs-container--padding-${padding}`, { 'bs-container--center': center }]"><slot /></component></template>

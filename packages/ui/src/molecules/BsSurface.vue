<script setup lang="ts">
withDefaults(defineProps<{ as?: 'div' | 'section' | 'article' | 'aside'; variant?: 'default' | 'flat' | 'muted' | 'raised'; padding?: 'none' | 'sm' | 'md' | 'lg'; border?: boolean }>(), {
  as: 'div', variant: 'default', padding: 'md', border: true,
})
</script>

<template><component :is="as" class="bs-surface" :class="[`bs-surface--${variant}`, `bs-surface--padding-${padding}`, { 'bs-surface--border': border }]"><slot /></component></template>

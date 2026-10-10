<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'neutral' | 'success' | 'info' | 'warning' | 'danger' | 'featured'; size?: 'sm' | 'md'; pill?: boolean }>(), {
  tone: 'neutral', size: 'md', pill: true,
})
</script>

<template><span class="bs-badge" :class="[`bs-badge--${tone}`, `bs-badge--${size}`, { 'bs-badge--pill': pill }]"><slot /></span></template>

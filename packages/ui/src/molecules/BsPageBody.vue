<script setup lang="ts">
withDefaults(defineProps<{ gap?: 'none' | 'sm' | 'md' | 'lg'; scroll?: boolean }>(), { gap: 'md', scroll: false })
</script>

<template><div class="bs-page-body" :class="[`bs-page-body--gap-${gap}`, { 'bs-page-body--scroll': scroll }]"><slot /></div></template>

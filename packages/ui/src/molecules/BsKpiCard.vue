<script setup lang="ts">
defineProps<{ title: string; changeLabel?: string; tone?: string; hint?: string }>()
</script>
<template><article class="ls-card p-6"><p class="text-sm text-fg-muted">{{ title }}</p><p class="mt-2 text-2xl font-extrabold"><slot /></p><p v-if="changeLabel" class="mt-1 text-xs font-medium" :class="tone">{{ changeLabel }}</p><p v-else-if="hint" class="mt-1 text-xs text-fg-muted">{{ hint }}</p></article></template>

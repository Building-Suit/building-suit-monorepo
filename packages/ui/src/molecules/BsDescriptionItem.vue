<script setup lang="ts">
withDefaults(defineProps<{ term: string; orientation?: 'stacked' | 'inline'; truncate?: boolean }>(), { orientation: 'stacked', truncate: false })
</script>

<template><div class="bs-description-item" :class="[`bs-description-item--${orientation}`, { 'bs-description-item--truncate': truncate }]"><dt>{{ term }}</dt><dd><slot /></dd></div></template>

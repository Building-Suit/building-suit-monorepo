<script setup lang="ts">
defineProps<{ label: string; sections: Array<{ id: string; label: string }> }>()
</script>
<template>
  <nav class="bs-section-navigation" :aria-label="label"><a v-for="section in sections" :key="section.id" :href="`#${section.id}`">{{ section.label }}</a></nav>
</template>
<style scoped>
.bs-section-navigation { display: flex; flex-wrap: wrap; gap: .5rem; padding-block-end: 1rem; border-block-end: 1px solid var(--bs-border); }
.bs-section-navigation a { display: inline-flex; align-items: center; min-block-size: 2.75rem; padding-inline: 1rem; border: 1px solid var(--bs-border); border-radius: var(--bs-radius-control); background: var(--bs-surface); font-size: .875rem; font-weight: 600; overflow-wrap: anywhere; }
.bs-section-navigation a:hover { background: var(--bs-surface-muted); }
.bs-section-navigation a:focus-visible { outline: 2px solid var(--bs-focus-ring); outline-offset: 2px; }
</style>

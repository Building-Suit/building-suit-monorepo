<script setup lang="ts">
const props = withDefaults(defineProps<{ depth?: number }>(), { depth: 0 })
const depth = computed(() => Math.max(0, Math.min(32, props.depth)))
</script>

<template><div class="bs-hierarchy-branch" :class="{ 'bs-hierarchy-branch--nested': depth > 0 }" :style="{ '--bs-tree-depth': depth }"><slot /></div></template>

<style>
.bs-hierarchy-branch { position: relative; display: flex; align-items: center; gap: var(--bs-space-3); padding-inline-start: calc(var(--bs-tree-depth) * 1.5rem); }
.bs-hierarchy-branch--nested::before { content: ''; position: absolute; inset-inline-start: calc((var(--bs-tree-depth) - 1) * 1.5rem + 1rem); inset-block: -1rem; border-inline-start: 1px solid var(--bs-border-strong); }
.bs-hierarchy-branch--nested::after { content: ''; position: absolute; inset-inline-start: calc((var(--bs-tree-depth) - 1) * 1.5rem + 1rem); width: .5rem; inset-block-start: 50%; border-block-start: 1px solid var(--bs-border-strong); }
@media (max-width: 639px) {
  .bs-hierarchy-branch { gap: var(--bs-space-1); padding-inline-start: calc(min(var(--bs-tree-depth), 4) * .55rem); }
  .bs-hierarchy-branch--nested::before, .bs-hierarchy-branch--nested::after { inset-inline-start: calc((min(var(--bs-tree-depth), 4) - 1) * .55rem); }
}
</style>

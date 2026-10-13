<script setup lang="ts" generic="Entry extends object = Record<string, unknown>">
const props = defineProps<{ entries: Entry[]; label: string; itemKey: keyof Entry & string | ((entry: Entry) => string | number) }>()
function keyFor(entry: Entry) { return typeof props.itemKey === 'function' ? props.itemKey(entry) : String(entry[props.itemKey]) }
</script>

<template>
  <ol class="bs-timeline" :aria-label="label">
    <li v-for="(entry, index) in entries" :key="keyFor(entry)" class="bs-timeline__item">
      <span class="bs-timeline__marker" aria-hidden="true" />
      <BsBox class="bs-timeline__content"><slot :entry="entry" :index="index" /></BsBox>
    </li>
  </ol>
</template>

<style>
.bs-timeline { display: grid; margin: 0; padding: 0; list-style: none; }
.bs-timeline__item { position: relative; display: grid; grid-template-columns: 1rem minmax(0, 1fr); gap: var(--bs-space-3); padding-block-end: var(--bs-space-4); }
.bs-timeline__item:not(:last-child)::before { content: ''; position: absolute; inset-block: .75rem 0; inset-inline-start: .3125rem; width: 1px; background: var(--bs-border); }
.bs-timeline__marker { position: relative; z-index: 1; width: .6875rem; height: .6875rem; margin-block-start: .35rem; border: 2px solid var(--bs-primary); border-radius: 50%; background: var(--bs-surface); }
.bs-timeline__content { min-width: 0; }
</style>

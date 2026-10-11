<script setup lang="ts" generic="Entry extends object = Record<string, unknown>">
defineProps<{ entries: Entry[]; label: string; itemKey: keyof Entry & string | ((entry: Entry) => string | number) }>()
</script>

<template><BsTimeline :entries="entries" :label="label" :item-key="itemKey"><template #default="scope"><slot v-bind="scope" /></template></BsTimeline></template>

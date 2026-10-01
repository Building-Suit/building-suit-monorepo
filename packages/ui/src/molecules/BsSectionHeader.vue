<script setup lang="ts">
withDefaults(defineProps<{ title: string; description?: string; headingLevel?: 2 | 3 | 4 | 5 | 6 }>(), { description: undefined, headingLevel: 2 })
const slots = useSlots()
</script>

<template>
  <header class="ls-section-header">
    <div class="min-w-0"><component :is="`h${headingLevel}`" class="text-h3 font-bold">{{ title }}</component><p v-if="description" class="mt-1 text-sm text-fg-muted">{{ description }}</p></div>
    <div v-if="slots.actions" class="flex flex-wrap items-center gap-2"><slot name="actions" /></div>
  </header>
</template>

<script setup lang="ts">
export interface BsPageContextItem {
  label: string
  value: string
}

withDefaults(defineProps<{
  title: string
  subtitle?: string
  contextLabel?: string
  context?: BsPageContextItem[]
}>(), { subtitle: undefined, contextLabel: undefined, context: () => [] })

const slots = useSlots()
</script>

<template>
  <header class="flex min-w-0 flex-wrap items-start justify-between gap-4">
    <div class="min-w-0">
      <h1 class="text-h1 font-bold">{{ title }}</h1>
      <p v-if="subtitle" class="mt-1 text-sm text-fg-muted">{{ subtitle }}</p>
      <dl v-if="context.length" class="mt-3 flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted" :aria-label="contextLabel">
        <div v-for="item in context" :key="`${item.label}:${item.value}`" class="flex min-w-0 items-center gap-1.5">
          <dt class="font-semibold">{{ item.label }}</dt>
          <dd class="max-w-64 truncate text-fg">{{ item.value }}</dd>
        </div>
      </dl>
    </div>
    <div v-if="slots.actions" class="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end"><slot name="actions" /></div>
  </header>
</template>

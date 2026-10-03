<script setup lang="ts">
export type BsTableDensityValue = 'compact' | 'comfortable'

const model = defineModel<BsTableDensityValue>({ required: true })
withDefaults(defineProps<{
  label: string
  compactLabel: string
  comfortableLabel: string
  disabled?: boolean
}>(), { disabled: false })
</script>

<template>
  <div class="flex flex-wrap items-center gap-2" role="group" :aria-label="label">
    <span class="text-xs font-semibold text-fg-muted">{{ label }}</span>
    <BsButton
      v-for="value in (['compact', 'comfortable'] as const)"
      :key="value"
      size="sm"
      :variant="model === value ? 'primary' : 'default'"
      :aria-pressed="model === value"
      :disabled="disabled"
      @click="model = value"
    >
      {{ value === 'compact' ? compactLabel : comfortableLabel }}
    </BsButton>
  </div>
</template>

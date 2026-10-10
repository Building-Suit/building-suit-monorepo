<script setup lang="ts">
const model = defineModel<string | number | null>({ default: null })
defineProps<{ label: string; min?: number; max?: number; step?: number | 'any'; disabled?: boolean; invalid?: boolean; required?: boolean }>()
</script>

<template>
  <BsInput v-model="model" type="number" inputmode="decimal" :aria-label="label" :min="min" :max="max" :step="step ?? 'any'" :disabled="disabled" :invalid="invalid" :required="required" />
</template>

<script setup lang="ts">
import type { BsColumnMappingField } from '@building-suit/contracts'
const mapping = defineModel<Record<string, string | null>>({ default: () => ({}) })
const props = defineProps<{ fields: BsColumnMappingField[]; columns: Array<{ label: string; value: string; disabled?: boolean }>; disabled?: boolean; exclusiveColumns?: boolean; unmappedLabel?: string }>()
function optionsFor(key: string) {
  return props.columns.map(column => ({ ...column, disabled: column.disabled || (props.exclusiveColumns && Object.entries(mapping.value).some(([field, value]) => field !== key && value === column.value)) }))
}
function update(key: string, value: unknown) { mapping.value = { ...mapping.value, [key]: value == null ? null : String(value) } }
</script>

<template>
  <BsStack gap="md">
    <BsField v-for="field in fields" :key="field.key" v-slot="control" :label="field.label" :required="field.required" :error="field.error">
      <BsSelect :model-value="mapping[field.key] ?? null" :label="field.label" :options="optionsFor(field.key)" option-disabled="disabled" :show-clear="!field.required" :placeholder="unmappedLabel" :required="field.required" :aria-required="field.required || undefined" option-label="label" option-value="value" :disabled="disabled" :invalid="!!field.error" :aria-describedby="control.describedby" @update:model-value="update(field.key, $event)" />
    </BsField>
  </BsStack>
</template>

<script setup lang="ts">
import type { BsPointOfSaleChoice } from '../types/pointOfSalePresentation'
defineProps<{ label: string; options: BsPointOfSaleChoice[]; disabled?: boolean }>()
const model = defineModel<string>({ required: true })
const name = useId()
</script>
<template>
  <fieldset class="bs-payment-choices" :disabled="disabled">
    <legend>{{ label }}</legend>
    <div class="bs-payment-choices__grid">
      <label v-for="option in options" :key="option.value" class="bs-payment-choice" :data-selected="model === option.value" :data-disabled="disabled || option.disabled">
        <BsRadio :model-value="model" bare :value="option.value" :name="name" :aria-label="option.label" :disabled="disabled || option.disabled" @update:model-value="value => { if (typeof value === 'string') model = value }" />
        <BsIcon :name="option.icon || 'wallet'" :size="26" />
        <span>{{ option.label }}</span>
      </label>
    </div>
  </fieldset>
</template>
<style scoped>
.bs-payment-choices { border: 0; padding: 0; margin: 0; min-inline-size: 0; }
.bs-payment-choices legend { font-size: var(--bs-type-caption-size); font-weight: var(--bs-weight-semibold); margin-block-end: var(--bs-space-3); }
.bs-payment-choices__grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--bs-space-2); }
.bs-payment-choice { display: flex; flex-direction: column; position: relative; align-items: center; justify-content: center; gap: var(--bs-space-2); min-block-size: 5rem; padding: var(--bs-space-3) var(--bs-space-2); border: 1px solid var(--bs-border); border-radius: var(--bs-radius-button); cursor: pointer; text-align: center; font-size: var(--bs-type-caption-size); overflow-wrap: anywhere; }
.bs-payment-choice[data-selected='true'] { border-color: var(--bs-primary); background: color-mix(in srgb, var(--bs-primary) 9%, var(--bs-surface)); box-shadow: inset 0 0 0 1px var(--bs-primary); }
.bs-payment-choice:focus-within { outline: 2px solid var(--bs-focus-ring); outline-offset: 3px; }
.bs-payment-choice[data-disabled='true'] { opacity: .5; cursor: default; }
.bs-payment-choice :deep(.bs-bare-control) { position: absolute; inset-block-start: .35rem; inset-inline-end: .35rem; }
.bs-payment-choice :deep(input) { inline-size: 1rem; block-size: 1rem; accent-color: var(--bs-primary); }
</style>

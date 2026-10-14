<script setup lang="ts">
import { boundedQuantity, steppedQuantity, restoreQuantityInput } from '@building-suit/ux'
const props = withDefaults(defineProps<{ modelValue: number; label: string; decreaseLabel: string; increaseLabel: string; min?: number; max?: number; step?: number; disabled?: boolean }>(), { min: 0, max: 1000000, step: 1, disabled: false })
const emit = defineEmits<{ 'update:modelValue': [value: number] }>()
function change(value: string | number | null) { if (props.disabled || value === null || value === '') return; const next = boundedQuantity(Number(value), props.min, props.max); if (next !== null) emit('update:modelValue', next) }
function adjust(direction: -1 | 1) { if (props.disabled) return; const next = steppedQuantity(props.modelValue, direction, props.step, props.min, props.max); if (next !== null) emit('update:modelValue', next) }
</script>
<template>
  <div class="bs-quantity-stepper" role="group" :aria-label="label">
    <BsButton :aria-label="decreaseLabel" :disabled="disabled || modelValue <= min" @click="adjust(-1)">−</BsButton>
    <BsInput :model-value="modelValue" type="number" inputmode="decimal" :aria-label="label" :min="min" :max="max" step="any" required :disabled="disabled" @blur="restoreQuantityInput($event, modelValue)" @update:model-value="change" />
    <BsButton :aria-label="increaseLabel" :disabled="disabled || modelValue >= max" @click="adjust(1)">+</BsButton>
  </div>
</template>
<style scoped>
.bs-quantity-stepper { display: grid; grid-template-columns: 2.75rem minmax(3rem, 4rem) 2.75rem; gap: var(--bs-space-2); }
.bs-quantity-stepper :deep(button), .bs-quantity-stepper :deep(input) { min-block-size: var(--bs-tap-target-min); min-inline-size: 0; padding-inline: var(--bs-space-1); text-align: center; }
.bs-quantity-stepper :deep(input) { appearance: textfield; }
.bs-quantity-stepper :deep(input::-webkit-inner-spin-button), .bs-quantity-stepper :deep(input::-webkit-outer-spin-button) { appearance: none; margin: 0; }
</style>

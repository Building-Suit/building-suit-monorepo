<script setup lang="ts">
import { useCodeEntry } from '@building-suit/ux'
const props = defineProps<{
  modelValue: string
  label: string
  disabled?: boolean
  invalid?: boolean
  describedby?: string
  length?: number
  required?: boolean
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string]; complete: [value: string] }>()
const { inputs, inputLength, digits, updateDigit, onKeydown, onPaste } = useCodeEntry(() => props.modelValue, () => props.length, value => emit('update:modelValue', value), value => emit('complete', value))
</script>

<template>
  <fieldset class="bs-otp-input" dir="ltr" :aria-describedby="describedby" :aria-invalid="invalid || undefined" :disabled="disabled">
    <legend class="sr-only">{{ label }}</legend>
    <input
      v-for="(_, index) in inputLength"
      :key="index"
      :ref="element => { if (element) inputs[index] = element as HTMLInputElement }"
      :value="digits[index]"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      maxlength="1"
      :autocomplete="index === 0 ? 'one-time-code' : 'off'"
      :aria-label="`${label} ${index + 1}`"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      class="bs-otp-input__digit"
      @input="updateDigit(index, $event)"
      @keydown="onKeydown(index, $event)"
      @paste="onPaste"
    >
  </fieldset>
</template>

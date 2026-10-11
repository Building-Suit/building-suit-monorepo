<script setup lang="ts">
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
const inputs = ref<HTMLInputElement[]>([])
const inputLength = computed(() => props.length || 6)
const digits = computed(() => Array.from({ length: inputLength.value }, (_, index) => props.modelValue[index] ?? ''))

function commit(value: string) {
  const normalized = value.replace(/\D/g, '').slice(0, inputLength.value)
  emit('update:modelValue', normalized)
  if (normalized.length === inputLength.value) emit('complete', normalized)
}

function updateDigit(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value
  const next = [...digits.value]
  next[index] = value.replace(/\D/g, '').slice(-1)
  input.value = next[index]
  commit(next.join(''))
  if (next[index] && index < inputLength.value - 1) inputs.value[index + 1]?.focus()
}

function onKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
    inputs.value[index - 1]?.focus()
  }
  else if (event.key === 'ArrowLeft' && index > 0) {
    inputs.value[index - 1]?.focus()
  }
  else if (event.key === 'ArrowRight' && index < inputLength.value - 1) {
    inputs.value[index + 1]?.focus()
  }
}

function onPaste(event: ClipboardEvent) {
  const value = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, inputLength.value) ?? ''
  if (!value) return
  event.preventDefault()
  commit(value)
  inputs.value[Math.min(value.length, inputLength.value) - 1]?.focus()
}

onMounted(() => nextTick(() => inputs.value[0]?.focus()))
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

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type BsInputType = 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number' | 'date' | 'time' | 'datetime-local' | 'color'

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  invalid?: boolean
  type?: BsInputType
  modelModifiers?: { number?: boolean; trim?: boolean; lazy?: boolean }
}>(), { modelValue: '', invalid: false, type: 'text', modelModifiers: () => ({}) })

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function update(event: Event) {
  let value: string | number = (event.target as HTMLInputElement).value
  if (props.modelModifiers.trim) value = value.trim()
  if ((props.modelModifiers.number || props.type === 'number') && value !== '') value = Number(value)
  emit('update:modelValue', value)
}

function onInput(event: Event) {
  if (!props.modelModifiers.lazy) update(event)
}

function onChange(event: Event) {
  if (props.modelModifiers.lazy) update(event)
}
</script>

<template>
  <input
    v-bind="$attrs"
    class="ls-input"
    :type="type"
    :value="props.modelValue ?? ''"
    :aria-invalid="invalid || undefined"
    @input="onInput"
    @change="onChange"
  >
</template>

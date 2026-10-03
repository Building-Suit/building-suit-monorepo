<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | number | null
  invalid?: boolean
  modelModifiers?: { number?: boolean; trim?: boolean }
}>(), { modelValue: '', invalid: false, modelModifiers: () => ({}) })

const emit = defineEmits<{ 'update:modelValue': [value: string | number] }>()

function update(event: Event) {
  let value: string | number = (event.target as HTMLInputElement).value
  if (props.modelModifiers.trim) value = value.trim()
  if (props.modelModifiers.number && value !== '') value = Number(value)
  emit('update:modelValue', value)
}
</script>

<template>
  <input
    v-bind="$attrs"
    class="ls-input"
    :value="props.modelValue ?? ''"
    :aria-invalid="invalid || undefined"
    @input="update"
  >
</template>

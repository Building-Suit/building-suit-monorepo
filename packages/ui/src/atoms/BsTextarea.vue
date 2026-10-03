<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | null
  invalid?: boolean
  rows?: number
  modelModifiers?: { trim?: boolean; lazy?: boolean }
}>(), { modelValue: '', invalid: false, rows: 4, modelModifiers: () => ({}) })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function update(event: Event) {
  let value = (event.target as HTMLTextAreaElement).value
  if (props.modelModifiers.trim) value = value.trim()
  emit('update:modelValue', value)
}
</script>

<template>
  <textarea
    v-bind="$attrs"
    class="ls-input ls-textarea"
    :value="props.modelValue ?? ''"
    :rows="rows"
    :aria-invalid="invalid || undefined"
    @input="!props.modelModifiers.lazy && update($event)"
    @change="props.modelModifiers.lazy && update($event)"
  />
</template>

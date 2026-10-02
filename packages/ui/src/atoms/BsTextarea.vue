<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: string | null
  invalid?: boolean
  rows?: number
}>(), { modelValue: '', invalid: false, rows: 4 })

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
</script>

<template>
  <textarea
    v-bind="$attrs"
    class="ls-input ls-textarea"
    :value="props.modelValue ?? ''"
    :rows="rows"
    :aria-invalid="invalid || undefined"
    @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
  />
</template>

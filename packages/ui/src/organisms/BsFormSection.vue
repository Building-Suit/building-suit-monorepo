<script setup lang="ts">
withDefaults(defineProps<{
  title: string
  description?: string
  hint?: string
  error?: string | null
  required?: boolean
  disabled?: boolean
  columns?: 1 | 2 | 3 | 4
}>(), {
  description: undefined,
  hint: undefined,
  error: null,
  required: false,
  disabled: false,
  columns: 1,
})
</script>

<template>
  <BsFieldGroup
    v-slot="group"
    class="bs-form-section"
    :legend="title"
    :description="description"
    :hint="hint"
    :error="error"
    :required="required"
    :disabled="disabled"
    layout="grid"
    :columns="columns"
  ><slot v-bind="group" /></BsFieldGroup>
</template>

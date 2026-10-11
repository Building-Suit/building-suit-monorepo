<script setup lang="ts">
const props = withDefaults(defineProps<{
  legend: string
  description?: string
  hint?: string
  error?: string | null
  required?: boolean
  disabled?: boolean
  layout?: 'stack' | 'grid' | 'inline'
  columns?: 1 | 2 | 3 | 4
}>(), {
  description: undefined,
  hint: undefined,
  error: null,
  required: false,
  disabled: false,
  layout: 'stack',
  columns: 1,
})

const groupId = useId()
const descriptionId = computed(() => `${groupId}-description`)
const hintId = computed(() => `${groupId}-hint`)
const errorId = computed(() => `${groupId}-error`)
const describedby = computed(() => [
  props.description ? descriptionId.value : null,
  props.hint ? hintId.value : null,
  props.error ? errorId.value : null,
].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <fieldset
    class="bs-field-group"
    :disabled="disabled"
    :aria-describedby="describedby"
    :aria-invalid="Boolean(error) || undefined"
    :aria-required="required || undefined"
    :data-layout="layout"
    :data-columns="columns"
  >
    <legend class="bs-field-group__legend">{{ legend }}<span v-if="required" aria-hidden="true"> *</span></legend>
    <p v-if="description" :id="descriptionId" class="bs-field-group__description">{{ description }}</p>
    <div class="bs-field-group__content">
      <slot :describedby="describedby" :invalid="Boolean(error)" :required="required" />
    </div>
    <p v-if="hint" :id="hintId" class="ls-field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="ls-field__error" role="alert">{{ error }}</p>
  </fieldset>
</template>

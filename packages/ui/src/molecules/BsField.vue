<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  for?: string
  description?: string
  hint?: string
  help?: string
  error?: string | null
  required?: boolean
}>(), { for: undefined, description: undefined, hint: undefined, help: undefined, error: undefined, required: false })

const generatedId = useId()
const controlId = computed(() => props.for || generatedId)
const descriptionId = computed(() => `${controlId.value}-description`)
const helpId = computed(() => `${controlId.value}-help`)
const errorId = computed(() => `${controlId.value}-error`)
const helpText = computed(() => props.help || props.hint)
const describedby = computed(() => [
  props.description ? descriptionId.value : null,
  helpText.value ? helpId.value : null,
  props.error ? errorId.value : null,
].filter(Boolean).join(' ') || undefined)
</script>

<template>
  <div class="ls-field" :data-invalid="Boolean(error) || undefined">
    <label class="ls-field__label" :for="controlId">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <p v-if="description" :id="descriptionId" class="ls-field__description">{{ description }}</p>
    <slot :id="controlId" :describedby="describedby" :invalid="Boolean(error)" :required="required" />
    <p v-if="helpText" :id="helpId" class="ls-field__hint">{{ helpText }}</p>
    <p v-if="error" :id="errorId" class="ls-field__error" role="alert">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  label: string
  for?: string
  hint?: string
  error?: string
  required?: boolean
}>(), { for: undefined, hint: undefined, error: undefined, required: false })

const generatedId = useId()
const messageId = computed(() => `${props.for || generatedId}-message`)
</script>

<template>
  <div class="ls-field" :data-invalid="Boolean(error) || undefined">
    <label class="ls-field__label" :for="props.for">
      {{ label }}<span v-if="required" aria-hidden="true"> *</span>
    </label>
    <slot :describedby="hint || error ? messageId : undefined" :invalid="Boolean(error)" />
    <p v-if="error" :id="messageId" class="ls-field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="messageId" class="ls-field__hint">{{ hint }}</p>
  </div>
</template>

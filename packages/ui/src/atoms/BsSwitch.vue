<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  modelValue?: boolean
  label: string
  description?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  inputId?: string
  describedby?: string
}>(), {
  modelValue: false,
  description: undefined,
  disabled: false,
  required: false,
  invalid: false,
  inputId: undefined,
  describedby: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; change: [checked: boolean, event: Event] }>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)

function update(event: Event) {
  const checked = (event.target as HTMLInputElement).checked
  emit('update:modelValue', checked)
  emit('change', checked, event)
}
</script>

<template>
  <label class="bs-switch" :data-disabled="disabled || undefined" :data-invalid="invalid || undefined">
    <input
      :id="id"
      v-bind="$attrs"
      class="bs-switch__input"
      type="checkbox"
      role="switch"
      :checked="modelValue"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      @change="update"
    >
    <span class="bs-switch__track" aria-hidden="true"><span class="bs-switch__thumb" /></span>
    <span class="bs-switch__copy">
      <span class="bs-switch__label">{{ label }}<span v-if="required" aria-hidden="true"> *</span></span>
      <small v-if="description" class="bs-switch__description">{{ description }}</small>
    </span>
  </label>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type RadioValue = string | number | boolean

const props = withDefaults(defineProps<{
  modelValue?: RadioValue | null
  value: RadioValue
  label?: string
  bare?: boolean
  description?: string
  name?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  hideLabel?: boolean
  inputId?: string
  describedby?: string
}>(), {
  modelValue: null, label: '', bare: false,
  description: undefined,
  name: undefined,
  disabled: false,
  required: false,
  invalid: false,
  hideLabel: false,
  inputId: undefined,
  describedby: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: RadioValue]; change: [value: RadioValue, event: Event]; nativeChange: [event: Event] }>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)

function update(event: Event) {
  if (!(event.target as HTMLInputElement).checked) return
  emit('update:modelValue', props.value)
  emit('change', props.value, event)
  emit('nativeChange', event)
}
</script>

<template>
  <component :is="bare ? 'span' : 'label'" :class="bare ? 'bs-bare-control' : 'bs-check-control'" :data-disabled="disabled || undefined" :data-invalid="invalid || undefined">
    <input
      :id="id"
      v-bind="$attrs"
      class="bs-check-control__input"
      type="radio"
      :name="name"
      :value="value"
      :checked="Object.is(modelValue, value)"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      @change="update"
    >
    <span v-if="!bare" class="bs-check-control__copy" :class="{ 'sr-only': hideLabel }">
      <span class="bs-check-control__label">{{ label }}<span v-if="required" aria-hidden="true"> *</span></span>
      <small v-if="description" class="bs-check-control__description">{{ description }}</small>
    </span>
  </component>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type ChoiceValue = string | number
type CheckboxModel = boolean | ChoiceValue[]

const props = withDefaults(defineProps<{
  modelValue?: CheckboxModel
  label: string
  value?: ChoiceValue
  description?: string
  name?: string
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  indeterminate?: boolean
  hideLabel?: boolean
  inputId?: string
  describedby?: string
}>(), {
  modelValue: false,
  value: undefined,
  description: undefined,
  name: undefined,
  disabled: false,
  required: false,
  invalid: false,
  indeterminate: false,
  hideLabel: false,
  inputId: undefined,
  describedby: undefined,
})

const emit = defineEmits<{ 'update:modelValue': [value: CheckboxModel]; change: [checked: boolean, event: Event] }>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)
const input = ref<HTMLInputElement | null>(null)
const checked = computed(() => Array.isArray(props.modelValue)
  ? props.value !== undefined && props.modelValue.some(item => Object.is(item, props.value))
  : Boolean(props.modelValue))

function update(event: Event) {
  const selected = (event.target as HTMLInputElement).checked
  if (Array.isArray(props.modelValue)) {
    const current = props.modelValue
    const value = props.value
    if (value === undefined) return
    emit('update:modelValue', selected
      ? current.some(item => Object.is(item, value)) ? current : [...current, value]
      : current.filter(item => !Object.is(item, value)))
  }
  else emit('update:modelValue', selected)
  emit('change', selected, event)
}

watchEffect(() => {
  if (input.value) input.value.indeterminate = props.indeterminate
})
</script>

<template>
  <label class="bs-check-control" :data-disabled="disabled || undefined" :data-invalid="invalid || undefined">
    <input
      :id="id"
      ref="input"
      v-bind="$attrs"
      class="bs-check-control__input"
      type="checkbox"
      :name="name"
      :value="value"
      :checked="checked"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      @change="update"
    >
    <span class="bs-check-control__copy" :class="{ 'sr-only': hideLabel }">
      <span class="bs-check-control__label">{{ label }}<span v-if="required" aria-hidden="true"> *</span></span>
      <small v-if="description" class="bs-check-control__description">{{ description }}</small>
    </span>
  </label>
</template>

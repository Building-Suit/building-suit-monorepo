<script setup lang="ts">
import { useCheckboxSelection } from '@building-suit/ux'
defineOptions({ inheritAttrs: false })

type ChoiceValue = string | number
type CheckboxModel = boolean | ChoiceValue[]

const props = withDefaults(defineProps<{
  modelValue?: CheckboxModel
  label?: string
  bare?: boolean
  checked?: boolean
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
  modelValue: false, label: '', bare: false, checked: undefined,
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

const emit = defineEmits<{ 'update:modelValue': [value: CheckboxModel]; change: [checked: boolean, event: Event]; nativeChange: [event: Event] }>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)
const { input, checked, update, focus } = useCheckboxSelection({
  model: () => props.modelValue, checked: () => props.checked, choice: () => props.value, indeterminate: () => props.indeterminate,
}, (value, selected, event) => {
  emit('update:modelValue', value)
  emit('change', selected, event)
  emit('nativeChange', event)
})
defineExpose({ nativeElement: input, focus })
</script>

<template>
  <component :is="bare ? 'span' : 'label'" :class="bare ? 'bs-bare-control' : 'bs-check-control'" :data-disabled="disabled || undefined" :data-invalid="invalid || undefined">
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
    <span v-if="!bare" class="bs-check-control__copy" :class="{ 'sr-only': hideLabel }">
      <span class="bs-check-control__label">{{ label }}<span v-if="required" aria-hidden="true"> *</span></span>
      <small v-if="description" class="bs-check-control__description">{{ description }}</small>
    </span>
  </component>
</template>

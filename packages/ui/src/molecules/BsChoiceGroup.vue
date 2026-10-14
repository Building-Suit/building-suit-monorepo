<script setup lang="ts">
export interface BsChoiceOption {
  label: string
  value: string | number
  description?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  legend: string
  options: BsChoiceOption[]
  modelValue?: string | number | Array<string | number> | null
  type?: 'checkbox' | 'radio'
  name?: string
  description?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  inline?: boolean
}>(), { modelValue: null, type: 'checkbox', name: undefined, description: undefined, hint: undefined, error: undefined, required: false, disabled: false, inline: false })

const emit = defineEmits<{ 'update:modelValue': [value: string | number | Array<string | number>] }>()
const groupId = useId()
const groupName = computed(() => props.name || groupId)
const descriptionId = computed(() => `${groupId}-description`)
const hintId = computed(() => `${groupId}-hint`)
const errorId = computed(() => `${groupId}-error`)
const describedby = computed(() => [
  props.description ? descriptionId.value : null,
  props.hint ? hintId.value : null,
  props.error ? errorId.value : null,
].filter(Boolean).join(' ') || undefined)
const radioValue = computed(() => Array.isArray(props.modelValue) ? null : props.modelValue)

function update(value: string | number, selected: boolean) {
  if (props.type === 'radio') return emit('update:modelValue', value)
  const current = Array.isArray(props.modelValue) ? props.modelValue : []
  emit('update:modelValue', selected ? [...new Set([...current, value])] : current.filter(item => item !== value))
}
</script>

<template>
  <fieldset class="ls-choice-group" :disabled="disabled" :aria-describedby="describedby" :aria-invalid="Boolean(error) || undefined" :aria-required="required || undefined">
    <legend class="ls-field__label">{{ legend }}<span v-if="required" aria-hidden="true"> *</span></legend>
    <p v-if="description" :id="descriptionId" class="ls-field__description">{{ description }}</p>
    <div class="ls-choice-group__options" :data-inline="inline || undefined">
      <BsRadio
        v-for="option in type === 'radio' ? options : []"
        :key="option.value"
        :model-value="radioValue"
        :value="option.value"
        :label="option.label"
        :description="option.description"
        :name="groupName"
        :disabled="disabled || option.disabled"
        :required="required"
        :invalid="Boolean(error)"
        :describedby="describedby"
        @update:model-value="update(option.value, true)"
      />
      <BsCheckbox
        v-for="option in type === 'checkbox' ? options : []"
        :key="option.value"
        :model-value="Array.isArray(modelValue) ? modelValue : []"
        :value="option.value"
        :label="option.label"
        :description="option.description"
        :name="groupName"
        :disabled="disabled || option.disabled"
        :required="false"
        :invalid="Boolean(error)"
        :describedby="describedby"
        @change="selected => update(option.value, selected)"
      />
    </div>
    <p v-if="hint" :id="hintId" class="ls-field__hint">{{ hint }}</p>
    <p v-if="error" :id="errorId" class="ls-field__error" role="alert">{{ error }}</p>
  </fieldset>
</template>

<script setup lang="ts">
export interface BsChoiceOption {
  label: string
  value: string
  description?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  legend: string
  options: BsChoiceOption[]
  modelValue?: string | string[] | null
  type?: 'checkbox' | 'radio'
  name?: string
  hint?: string
  error?: string
  inline?: boolean
}>(), { modelValue: null, type: 'checkbox', name: undefined, hint: undefined, error: undefined, inline: false })

const emit = defineEmits<{ 'update:modelValue': [value: string | string[]] }>()
const groupId = useId()
const groupName = computed(() => props.name || groupId)
const messageId = computed(() => `${groupId}-message`)

function checked(value: string) {
  return props.type === 'radio' ? props.modelValue === value : Array.isArray(props.modelValue) && props.modelValue.includes(value)
}

function update(value: string, selected: boolean) {
  if (props.type === 'radio') return emit('update:modelValue', value)
  const current = Array.isArray(props.modelValue) ? props.modelValue : []
  emit('update:modelValue', selected ? [...new Set([...current, value])] : current.filter(item => item !== value))
}
</script>

<template>
  <fieldset class="ls-choice-group" :aria-describedby="hint || error ? messageId : undefined">
    <legend class="ls-field__label">{{ legend }}</legend>
    <div :class="inline ? 'flex flex-wrap gap-4' : 'grid gap-2'">
      <label v-for="option in options" :key="option.value" class="ls-choice">
        <input
          :type="type" :name="groupName" :value="option.value" :checked="checked(option.value)"
          :disabled="option.disabled" :aria-invalid="Boolean(error) || undefined"
          @change="update(option.value, ($event.target as HTMLInputElement).checked)"
        >
        <span><span class="font-semibold">{{ option.label }}</span><small v-if="option.description">{{ option.description }}</small></span>
      </label>
    </div>
    <p v-if="error" :id="messageId" class="ls-field__error" role="alert">{{ error }}</p>
    <p v-else-if="hint" :id="messageId" class="ls-field__hint">{{ hint }}</p>
  </fieldset>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false })

const model = defineModel<string>({ default: '' })
const props = withDefaults(defineProps<{
  label: string
  placeholder?: string
  description?: string
  hint?: string
  error?: string | null
  disabled?: boolean
  pending?: boolean
  required?: boolean
  clearLabel?: string
  inputId?: string
}>(), {
  placeholder: undefined,
  description: undefined,
  hint: undefined,
  error: null,
  disabled: false,
  pending: false,
  required: false,
  clearLabel: undefined,
  inputId: undefined,
})

const emit = defineEmits<{ search: [value: string]; clear: [] }>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)

function search() {
  if (!props.disabled && !props.pending) emit('search', model.value)
}
function clear() {
  model.value = ''
  emit('clear')
  emit('search', '')
}
</script>

<template>
  <BsField v-slot="field" :label="label" :for="id" :description="description" :hint="hint" :error="error" :required="required">
    <div class="bs-search-field__control">
      <BsInput
        :id="id"
        v-bind="$attrs"
        v-model="model"
        type="search"
        :placeholder="placeholder"
        :disabled="disabled || pending"
        :required="required"
        :invalid="field.invalid"
        :aria-describedby="field.describedby"
        :aria-busy="pending || undefined"
        @keydown.enter.prevent="search"
      />
      <BsButton v-if="clearLabel && model" type="button" variant="icon" :aria-label="clearLabel" :disabled="disabled || pending" @click="clear">
        <BsIcon name="close" :size="16" />
      </BsButton>
    </div>
  </BsField>
</template>

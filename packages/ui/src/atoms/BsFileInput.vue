<script setup lang="ts">
defineOptions({ inheritAttrs: false })

type FileModel = File | File[] | null

const props = withDefaults(defineProps<{
  modelValue?: FileModel
  label?: string
  bare?: boolean
  hideControl?: boolean
  selectedLabel?: string
  emptyLabel?: string
  multiple?: boolean
  disabled?: boolean
  required?: boolean
  invalid?: boolean
  inputId?: string
  describedby?: string
  variant?: 'control' | 'button'
}>(), {
  modelValue: null, label: '', bare: false, hideControl: false,
  selectedLabel: undefined,
  emptyLabel: undefined,
  multiple: false,
  disabled: false,
  required: false,
  invalid: false,
  inputId: undefined,
  describedby: undefined,
  variant: 'control',
})

const emit = defineEmits<{
  'update:modelValue': [value: FileModel]
  select: [value: FileModel]
  change: [event: Event]
}>()
const generatedId = useId()
const id = computed(() => props.inputId || generatedId)
const input = ref<HTMLInputElement | null>(null)
defineExpose({ nativeElement: input, click: () => input.value?.click(), focus: () => input.value?.focus() })
const selectedFiles = computed(() => props.modelValue == null ? [] : Array.isArray(props.modelValue) ? props.modelValue : [props.modelValue])
const selectedText = computed(() => props.selectedLabel || selectedFiles.value.map(file => file.name).join(', ') || props.emptyLabel)

function update(event: Event) {
  const files = Array.from((event.target as HTMLInputElement).files || [])
  const value = props.multiple ? files : files[0] || null
  emit('update:modelValue', value)
  emit('select', value)
  emit('change', event)
}

watch(() => props.modelValue, (value) => {
  if (value == null && input.value) input.value.value = ''
})
</script>

<template>
  <component :is="bare ? 'span' : 'label'" :class="bare ? 'bs-bare-control' : 'bs-file-input'" :data-variant="variant" :data-disabled="disabled || undefined" :data-invalid="invalid || undefined">
    <input
      :id="id"
      ref="input"
      v-bind="$attrs"
      :class="hideControl ? 'sr-only' : bare ? 'ls-input' : 'bs-file-input__native'"
      type="file"
      :multiple="multiple"
      :disabled="disabled"
      :required="required"
      :aria-invalid="invalid || undefined"
      :aria-describedby="describedby"
      @change="update"
    >
    <span v-if="!bare" class="bs-file-input__label">{{ label }}</span>
    <span v-if="!bare && selectedText" class="bs-file-input__selection" aria-live="polite">{{ selectedText }}</span>
  </component>
</template>

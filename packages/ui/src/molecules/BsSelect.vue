<script setup lang="ts">
import Select from 'primevue/select'
import type { SelectProps, SelectChangeEvent } from 'primevue/select'
import { provide } from 'vue'
defineOptions({ inheritAttrs: false })
const emit = defineEmits<{ change: [event: Event | SelectChangeEvent] }>()
const model = defineModel<string | number | null>({ default: null })
const props = withDefaults(defineProps<{
  value?: string | number | null
  label?: string
  options?: SelectProps['options']
  native?: boolean
  optionLabel?: SelectProps['optionLabel']
  optionValue?: SelectProps['optionValue']
  optionDisabled?: SelectProps['optionDisabled']
  virtual?: boolean
  virtualScrollerOptions?: SelectProps['virtualScrollerOptions']
}>(), { value: undefined, label: undefined, options: undefined, native: false, virtual: false, optionLabel: undefined, optionValue: undefined, optionDisabled: undefined, virtualScrollerOptions: undefined })
function optionField(option: unknown, field: string | ((option: unknown) => unknown) | undefined): unknown {
  if (typeof field === 'function') return field(option)
  if (field && typeof option === 'object' && option !== null) return field.split('.').reduce<unknown>((value, key) => value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, option)
  return option
}
const nativeOptions = computed(() => (props.options ?? []).map((option: unknown) => {
  const value = optionField(option, props.optionValue)
  return {
    value: value === null || typeof value === 'string' || typeof value === 'number' ? value : '',
    label: String(optionField(option, props.optionLabel) ?? ''),
    disabled: props.optionDisabled ? Boolean(optionField(option, props.optionDisabled)) : false,
  }
}))
const nativeModel = computed({ get: () => props.value !== undefined ? props.value : model.value, set: value => { model.value = value } })
provide('bs-native-select-value', nativeModel)
// PrimeVue treats '' and null as no selection. Represent explicit sentinel
// options internally while preserving the public domain values and callbacks.
const emptyOptionKey = `bs-select-empty-${useId()}`
const nullOptionKey = `bs-select-null-${useId()}`
const hasNullOption = computed(() => (props.options ?? []).some(option => optionField(option, props.optionValue) === null))
const primeModel = computed({
  get: () => nativeModel.value === '' ? emptyOptionKey : nativeModel.value === null && hasNullOption.value ? nullOptionKey : nativeModel.value,
  set: value => { nativeModel.value = value === emptyOptionKey ? '' : value === nullOptionKey ? null : value },
})
function forwardChange(event: SelectChangeEvent) { emit('change', { ...event, value: event.value === emptyOptionKey ? '' : event.value === nullOptionKey ? null : event.value }) }
function primeOptionValue(option: unknown) {
  const value = optionField(option, props.optionValue)
  return value === '' ? emptyOptionKey : value === null ? nullOptionKey : value
}
const nativeSelect = ref<HTMLSelectElement | null>(null)
const select = ref<InstanceType<typeof Select> | null>(null)
const focusController = useControlFocus(nativeSelect, select)
defineExpose({ focus: focusController.focus })
const attrs = useAttrs()
const accessibleLabel = computed(() => props.label || (typeof attrs['aria-label'] === 'string' ? attrs['aria-label'] : undefined))
const ui = useUiCopy()
</script>

<template>
  <select v-if="native" ref="nativeSelect" v-bind="$attrs" v-model="nativeModel" class="ls-input" :aria-label="accessibleLabel" @change="emit('change', $event)"><slot v-if="$slots.default" /><template v-else><option v-for="(option, index) in nativeOptions" :key="index" :value="option.value" :disabled="option.disabled">{{ option.label }}</option></template></select>
  <Select
    v-else
    ref="select"
    v-bind="$attrs" v-model="primeModel" :options="options" :option-label="optionLabel" :option-value="primeOptionValue" :option-disabled="optionDisabled"
    :aria-label="accessibleLabel" :placeholder="typeof $attrs.placeholder === 'string' ? $attrs.placeholder : accessibleLabel" @change="forwardChange"
    :empty-message="ui('empty')" :empty-filter-message="ui('empty')"
    :virtual-scroller-options="virtual || virtualScrollerOptions ? { ...virtualScrollerOptions, itemSize: 44 } : undefined"
    :pt="{
      root: { class: 'bs-select ls-input' }, label: { class: 'bs-select-label' },
      dropdown: { class: 'bs-select-trigger' }, overlay: { class: 'bs-select-overlay ls-card shadow-overlay' },
      header: { class: 'p-2' }, pcFilter: { root: { class: 'ls-input', 'aria-label': ui('search') + ' · ' + label } },
      list: { class: 'm-0 p-0 list-none' }, option: { class: 'bs-select-option' },
      emptyMessage: { class: 'p-3 text-fg-muted' },
    }"
  >
    <template v-for="(_, name) in $slots" :key="name" #[name]="scope"><slot :name="name" v-bind="name === 'value' && scope ? { ...scope, value: nativeModel } : scope || {}" /></template>
  </Select>
</template>

<style>
.bs-select { display: flex; align-items: center; padding-inline: 0; text-align: start; cursor: pointer; }
.bs-select-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-inline: var(--bs-space-4); }
.bs-select-trigger { display: grid; place-items: center; min-width: var(--bs-tap-target-min); min-height: var(--bs-tap-target-min); }
.bs-select-overlay { max-width: calc(100vw - 2rem); overflow: hidden; color: var(--bs-text); }
.bs-select-option { display: flex; align-items: center; height: var(--bs-tap-target-min); padding-inline: var(--bs-space-4); white-space: nowrap; cursor: pointer; }
.bs-select-option [data-pc-section='optionlabel'] { overflow: hidden; text-overflow: ellipsis; }
.bs-select-option[data-p-focused='true'] { background: var(--bs-surface-muted); outline: var(--bs-focus-ring-style); outline-offset: -2px; }
.bs-select-option[aria-selected='true'] { background: var(--bs-primary); color: var(--bs-text-on-primary); }
.bs-select[data-p-disabled='true'] { opacity: .6; cursor: not-allowed; }
.bs-select[data-p-invalid='true'] { border-color: var(--bs-status-error); }
</style>

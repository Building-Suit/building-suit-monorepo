<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import Select from 'primevue/select'
import type { SelectProps } from 'primevue/select'
defineOptions({ inheritAttrs: false })
const model = defineModel<string | number | null>({ default: null })
withDefaults(defineProps<{
  label: string
  options: SelectProps['options']
  optionLabel?: SelectProps['optionLabel']
  optionValue?: SelectProps['optionValue']
  virtual?: boolean
  virtualScrollerOptions?: SelectProps['virtualScrollerOptions']
}>(), { virtual: false, optionLabel: undefined, optionValue: undefined, virtualScrollerOptions: undefined })
const ui = useUiCopy()
const selectRef = ref<{ $el?: HTMLElement } | null>(null)

function activateFocusedFilterOption(event: KeyboardEvent) {
  if (event.key !== 'Enter' || event.isComposing) return

  const input = event.target as HTMLInputElement | null
  if (input?.getAttribute('role') !== 'searchbox') return

  const controlledListId = selectRef.value?.$el
    ?.querySelector<HTMLElement>('[role="combobox"]')
    ?.getAttribute('aria-controls')

  if (!controlledListId || input.getAttribute('aria-owns') !== controlledListId) return

  const optionId = input.getAttribute('aria-activedescendant')
  const option = optionId ? document.getElementById(optionId) : null

  if (!(option instanceof HTMLElement) || option.getAttribute('role') !== 'option') return

  event.preventDefault()
  event.stopImmediatePropagation()
  option.click()
}

onMounted(() => document.addEventListener('keydown', activateFocusedFilterOption, true))
onBeforeUnmount(() => document.removeEventListener('keydown', activateFocusedFilterOption, true))
</script>

<template>
  <Select
    ref="selectRef"
    v-bind="$attrs" v-model="model" :options="options" :option-label="optionLabel" :option-value="optionValue"
    :aria-label="label"
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
    <template v-for="(_, name) in $slots" :key="name" #[name]="scope"><slot :name="name" v-bind="scope || {}" /></template>
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

import { computed, ref, watchEffect } from 'vue'
export type CheckboxChoice = string | number
export type CheckboxSelection = boolean | CheckboxChoice[]
export function useCheckboxSelection(
  values: { model: () => CheckboxSelection; checked: () => boolean | undefined; choice: () => CheckboxChoice | undefined; indeterminate: () => boolean },
  commit: (value: CheckboxSelection, selected: boolean, event: Event) => void,
) {
  const input = ref<HTMLInputElement | null>(null)
  const checked = computed(() => values.checked() ?? (Array.isArray(values.model())
    ? values.choice() !== undefined && (values.model() as CheckboxChoice[]).some(item => Object.is(item, values.choice()))
    : Boolean(values.model())))
  function update(event: Event) {
    const selected = (event.target as HTMLInputElement).checked
    const model = values.model()
    if (Array.isArray(model)) {
      const choice = values.choice()
      if (choice === undefined) return
      commit(selected ? model.some(item => Object.is(item, choice)) ? model : [...model, choice]
        : model.filter(item => !Object.is(item, choice)), selected, event)
    }
    else commit(selected, selected, event)
  }
  watchEffect(() => { if (input.value) input.value.indeterminate = values.indeterminate() })
  return { input, checked, update, focus: () => input.value?.focus() }
}

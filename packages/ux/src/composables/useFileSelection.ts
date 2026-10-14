import { computed, ref, watch } from 'vue'
export type FileSelection = File | File[] | null
export function useFileSelection(
  model: () => FileSelection,
  multiple: () => boolean,
  commit: (value: FileSelection, event: Event) => void,
  resetAfterSelect: () => boolean = () => false,
) {
  const input = ref<HTMLInputElement | null>(null)
  const selectedFiles = computed(() => {
    const value = model()
    return value == null ? [] : Array.isArray(value) ? value : [value]
  })
  function update(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files || [])
    commit(multiple() ? files : files[0] || null, event)
    if (resetAfterSelect()) (event.target as HTMLInputElement).value = ''
  }
  watch(model, value => { if (value == null && input.value) input.value.value = '' })
  return { input, selectedFiles, update, click: () => input.value?.click(), focus: () => input.value?.focus() }
}

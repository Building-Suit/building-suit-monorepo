import { computed, ref, watch } from 'vue'
export function useTagSelection<T extends { id: string }>(assigned: () => readonly { id: string }[], options: () => readonly T[]) {
  const selected = ref<string | number | null>(null)
  const available = computed(() => options().filter(option => !assigned().some(tag => tag.id === option.id)))
  watch(available, values => { if (!values.some(option => option.id === selected.value)) selected.value = null })
  return { selected, available }
}

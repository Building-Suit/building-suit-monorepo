import { ref, type Ref } from 'vue'
export function useFileDrop(file: Ref<File | null>, disabled: () => boolean, selected: (file: File | null) => void) {
  const dragging = ref(false)
  function select(value: File | File[] | null) {
    if (disabled()) return
    file.value = Array.isArray(value) ? value[0] || null : value
    selected(file.value)
  }
  function drop(event: DragEvent) {
    dragging.value = false
    const dropped = event.dataTransfer?.files[0]
    if (!disabled() && dropped) select(dropped)
  }
  return { dragging, select, drop }
}

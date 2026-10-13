import { computed, ref, onMounted, nextTick } from 'vue'

/** Fixed-direction numeric code entry, paste normalization and keyboard focus. */
export function useCodeEntry(value: () => string, length: () => number | undefined, changed: (value: string) => void, completed: (value: string) => void) {
  const inputs = ref<HTMLInputElement[]>([])
  const inputLength = computed(() => length() || 6)
  const digits = computed(() => Array.from({ length: inputLength.value }, (_, index) => value()[index] ?? ''))

  function commit(value: string) {
    const normalized = value.replace(/\D/g, '').slice(0, inputLength.value)
    changed(normalized)
    if (normalized.length === inputLength.value) completed(normalized)
  }

  function updateDigit(index: number, event: Event) {
    const input = event.target as HTMLInputElement
    const value = input.value
    const next = [...digits.value]
    next[index] = value.replace(/\D/g, '').slice(-1)
    input.value = next[index]
    commit(next.join(''))
    if (next[index] && index < inputLength.value - 1) inputs.value[index + 1]?.focus()
  }

  function onKeydown(index: number, event: KeyboardEvent) {
    if (event.key === 'Backspace' && !digits.value[index] && index > 0) {
      inputs.value[index - 1]?.focus()
    }
    else if (event.key === 'ArrowLeft' && index > 0) {
      inputs.value[index - 1]?.focus()
    }
    else if (event.key === 'ArrowRight' && index < inputLength.value - 1) {
      inputs.value[index + 1]?.focus()
    }
  }

  function onPaste(event: ClipboardEvent) {
    const value = event.clipboardData?.getData('text').replace(/\D/g, '').slice(0, inputLength.value) ?? ''
    if (!value) return
    event.preventDefault()
    commit(value)
    inputs.value[Math.min(value.length, inputLength.value) - 1]?.focus()
  }

  onMounted(() => nextTick(() => inputs.value[0]?.focus()))
  return { inputs, inputLength, digits, updateDigit, onKeydown, onPaste }
}

import { ref, type Ref } from 'vue'
export function useGuardedChoice<T extends string>(value: Ref<T>, options: readonly T[], beforeChange?: (next: T) => boolean | Promise<boolean>) {
  const pending = ref(false)
  async function choose(next: string) {
    if (pending.value || !options.includes(next as T)) return false
    if (next === value.value) return true
    pending.value = true
    try {
      if (beforeChange && !await beforeChange(next as T)) return false
      value.value = next as T
      return true
    } finally { pending.value = false }
  }
  return { pending, choose }
}

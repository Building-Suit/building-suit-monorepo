import { onScopeDispose, shallowRef } from 'vue'
/** Clears temporary presentation values and invalidates late asynchronous responses. */
export function useExpiringValue<T>(empty: T, lifetime: number) {
  const value = shallowRef<T>(empty)
  let timer: ReturnType<typeof setTimeout> | undefined
  let generation = 0
  function clear() { generation++; if (timer !== undefined) clearTimeout(timer); timer = undefined; value.value = empty }
  async function load(read: () => Promise<T>) {
    clear()
    const requested = generation
    const result = await read()
    if (generation !== requested) return
    value.value = result
    timer = setTimeout(clear, lifetime)
  }
  onScopeDispose(clear)
  return { value, clear, load }
}

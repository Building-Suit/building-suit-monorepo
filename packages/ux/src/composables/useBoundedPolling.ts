import { onScopeDispose, ref } from 'vue'

/** Bounded interaction retries; cancellation also releases a pending delay. */
export function useBoundedPolling(work: () => Promise<boolean>, options: { attempts: number; delay: number }) {
  const pending = ref(false)
  let generation = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let release: (() => void) | undefined
  function cancel() {
    generation++
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    release?.(); release = undefined
    pending.value = false
  }
  async function start() {
    cancel()
    const active = generation
    pending.value = true
    try {
      for (let attempt = 0; attempt < options.attempts && generation === active; attempt++) {
        const complete = await work()
        if (generation !== active) return 'cancelled' as const
        if (complete) return 'completed' as const
        if (attempt + 1 < options.attempts) await new Promise<void>(resolve => {
          release = resolve
          timer = setTimeout(() => { timer = undefined; release = undefined; resolve() }, options.delay)
        })
      }
      return generation === active ? 'exhausted' as const : 'cancelled' as const
    } finally {
      if (generation === active) pending.value = false
    }
  }
  onScopeDispose(cancel)
  return { pending, start, cancel }
}

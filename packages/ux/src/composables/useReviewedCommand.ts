import { computed, ref, shallowRef, watch } from 'vue'

/** Keeps the reviewed payload and request identity through uncertain responses.
 * Known server rejections may reset; transport errors must retry the same command.
 */
export function useReviewedCommand<T, Q>(getInput: () => T, scope: () => string) {
  const review = shallowRef<Q | null>(null)
  const reviewedInput = shallowRef<T | null>(null)
  const requestId = ref<string | null>(null)
  const pending = ref(false)
  const error = ref('')
  const locked = computed(() => requestId.value !== null)
  let generation = 0
  const fingerprint = () => JSON.stringify(getInput())
  const reset = () => { generation++; review.value = null; reviewedInput.value = null; requestId.value = null; error.value = '' }
  watch(scope, reset, { flush: 'sync' })
  watch(fingerprint, () => { if (!locked.value) { generation++; review.value = null; reviewedInput.value = null } }, { flush: 'sync' })
  async function preview(load: (input: T) => Promise<Q>, describe: (error: unknown) => string) {
    if (pending.value || locked.value) return
    const token = ++generation
    const original = fingerprint()
    const input = structuredClone(getInput())
    pending.value = true; error.value = ''
    try {
      const result = await load(input)
      if (token === generation && original === fingerprint()) { review.value = result; reviewedInput.value = input }
    }
    catch (cause) { if (token === generation) error.value = describe(cause) }
    finally { pending.value = false }
  }
  async function submit(send: (request: string, input: T, quote: Q) => Promise<void>, describe: (error: unknown) => string) {
    if (pending.value || review.value === null || reviewedInput.value === null) return false
    pending.value = true; error.value = ''
    requestId.value ??= crypto.randomUUID()
    const token = generation
    try {
      await send(requestId.value, reviewedInput.value, review.value)
      if (generation === token) reset()
      return true
    }
    catch (cause) { if (generation === token) error.value = describe(cause); return false }
    finally { pending.value = false }
  }
  return { review, reviewedInput, pending, error, locked, requestId, preview, submit, reset }
}

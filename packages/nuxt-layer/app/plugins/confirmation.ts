import { shallowRef } from 'vue'
import type { ConfirmationRequest } from '@building-suit/ux'

export default defineNuxtPlugin(nuxtApp => {
  const current = shallowRef<ConfirmationRequest | null>(null)
  const queue: Array<{ request: ConfirmationRequest; resolve: (value: boolean) => void }> = []
  let resolveCurrent: ((value: boolean) => void) | undefined
  function next() {
    const item = queue.shift()
    current.value = item?.request ?? null
    resolveCurrent = item?.resolve
  }
  function answer(value: boolean) { const resolve = resolveCurrent; current.value = null; resolveCurrent = undefined; resolve?.(value); next() }
  function ask(request: ConfirmationRequest): Promise<boolean>
  function ask(message: string, title?: string): Promise<boolean>
  function ask(requestOrMessage: ConfirmationRequest | string, title?: string): Promise<boolean> {
    if (import.meta.server) return Promise.resolve(false)
    const request = typeof requestOrMessage === 'string' ? { message: requestOrMessage, title } : requestOrMessage
    return new Promise(resolve => { queue.push({ request, resolve }); if (!current.value) next() })
  }
  nuxtApp.vueApp.onUnmount(() => { resolveCurrent?.(false); for (const item of queue) item.resolve(false); queue.length = 0 })
  return { provide: { bsConfirm: { current, ask, answer } } }
})

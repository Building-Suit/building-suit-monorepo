import { shallowRef } from 'vue'
export default defineNuxtPlugin(nuxtApp => {
  const current = shallowRef<{ message: string; title?: string } | null>(null)
  const queue: Array<{ request: { message: string; title?: string }; resolve: (value: boolean) => void }> = []
  let resolveCurrent: ((value: boolean) => void) | undefined
  function next() {
    const item = queue.shift()
    current.value = item?.request ?? null
    resolveCurrent = item?.resolve
  }
  function answer(value: boolean) { const resolve = resolveCurrent; current.value = null; resolveCurrent = undefined; resolve?.(value); next() }
  function ask(message: string, title?: string): Promise<boolean> {
    if (import.meta.server) return Promise.resolve(false)
    return new Promise(resolve => { queue.push({ request: { message, title }, resolve }); if (!current.value) next() })
  }
  nuxtApp.vueApp.onUnmount(() => { resolveCurrent?.(false); for (const item of queue) item.resolve(false); queue.length = 0 })
  return { provide: { bsConfirm: { current, ask, answer } } }
})

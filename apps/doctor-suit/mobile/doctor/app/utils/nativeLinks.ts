/** Native URL navigation waits for Nuxt mount. Memory-only; no command/auth replay. */
export function createDoctorMobileLinks(open: (url: string) => Promise<void>, failed: () => void) {
  let mounted = false, disposed = false, receivedEvent = false
  let pending: string | null = null, running: Promise<void> | null = null
  function drain(): Promise<void> {
    if (running) return running
    if (!mounted || disposed || pending === null) return Promise.resolve()
    running = (async () => {
      while (!disposed && pending !== null) {
        const url = pending; pending = null
        try { await open(url) } catch { if (!disposed) failed() }
      }
    })().finally(() => { running = null; if (!disposed && pending !== null) return drain() })
    return running
  }
  function enqueue(url: string) {
    if (disposed) return Promise.resolve()
    pending = url.length <= 200 ? url : '/unavailable'
    return drain()
  }
  return {
    launch: (url: string) => receivedEvent ? Promise.resolve() : enqueue(url),
    event: (url: string) => { receivedEvent = true; return enqueue(url) },
    mount: () => { mounted = true; return drain() },
    dispose: () => { disposed = true; pending = null },
  }
}

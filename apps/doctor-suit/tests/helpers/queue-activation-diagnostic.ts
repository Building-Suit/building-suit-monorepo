/** Fixed booleans/counts only. No names, values, text, URLs or request data. */
export function observeQueueActivation(button: HTMLElement) {
  const document = button.ownerDocument
  const events: { event: string; disabled: boolean; connected: boolean; dialogs: number }[] = []
  const counts = { pointerdown: 0, pointerup: 0, click: 0, focus: 0, blur: 0, disabledChanges: 0, dialogChanges: 0 }
  let disposed = false
  let dialogs = Math.min(5, document.querySelectorAll('[role="dialog"]').length)
  const snapshot = () => ({ disabled: button.hasAttribute('disabled'), connected: button.isConnected, dialogs })
  const record = (event: string) => {
    if (disposed) return
    events.push({ event, ...snapshot() })
    if (events.length > 12) events.shift()
  }
  const names = ['pointerdown', 'pointerup', 'click', 'focus', 'blur'] as const
  const listeners = names.map(name => {
    const listener = () => { counts[name] = Math.min(100, counts[name] + 1); record(name) }
    button.addEventListener(name, listener, true)
    return { name, listener }
  })
  const disabled = new MutationObserver(() => {
    if (disposed) return
    counts.disabledChanges = Math.min(100, counts.disabledChanges + 1)
    record('disabled')
  })
  disabled.observe(button, { attributes: true, attributeFilter: ['disabled'] })
  const overlays = new MutationObserver(() => {
    if (disposed) return
    const next = Math.min(5, document.querySelectorAll('[role="dialog"]').length)
    if (next === dialogs) return
    dialogs = next
    counts.dialogChanges = Math.min(100, counts.dialogChanges + 1)
    record('dialogs')
  })
  overlays.observe(document.documentElement, { childList: true, subtree: true })
  record('armed')
  return {
    read: () => ({ ...snapshot(), counts: { ...counts }, events: events.map(event => ({ ...event })) }),
    dispose() {
      disposed = true
      for (const { name, listener } of listeners) button.removeEventListener(name, listener, true)
      disabled.disconnect(); overlays.disconnect()
    },
  }
}

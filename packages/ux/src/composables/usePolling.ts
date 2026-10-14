/** Request-scoped polling with cleanup when its owning view unmounts. */
export function usePolling(refresh: () => unknown, interval: () => number) {
  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => { timer = setInterval(() => { void refresh() }, interval()) })
  onBeforeUnmount(() => { if (timer !== undefined) clearInterval(timer) })
}

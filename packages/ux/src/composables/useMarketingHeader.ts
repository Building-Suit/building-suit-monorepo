/** Marketing header elevation observes the page sentinel and releases its observer. */
export function useMarketingHeader() {
  const hydrated = ref(false)
  const topSentinel = ref<HTMLElement | null>(null)
  const headerElevated = ref(false)
  let observer: IntersectionObserver | undefined
  useTheme()
  onMounted(() => {
    hydrated.value = true
    if (topSentinel.value) {
      observer = new IntersectionObserver(([entry]) => { headerElevated.value = !entry?.isIntersecting }, { threshold: 0.01 })
      observer.observe(topSentinel.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())
  return { hydrated, topSentinel, headerElevated }
}

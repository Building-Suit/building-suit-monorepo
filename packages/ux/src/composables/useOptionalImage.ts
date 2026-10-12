import { computed, onMounted, ref, watch } from 'vue'
/** Optional media is progressive enhancement; broken/unsafe sources use the same local placeholder. */
export function useOptionalImage(source: () => string | null | undefined, element?: () => HTMLImageElement | null) {
  const broken = ref(false)
  const image = computed(() => {
    const value = source()?.trim()
    if (!value || value.length > 2000 || /\s/.test(value)) return null
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? value : null } catch { return null }
  })
  watch(source, () => { broken.value = false })
  if (element) onMounted(() => {
    const node = element()
    // An SSR image can fail before hydration attaches its error listener.
    if (node?.complete && node.naturalWidth === 0) broken.value = true
  })
  return { image, broken, failed: () => { broken.value = true } }
}

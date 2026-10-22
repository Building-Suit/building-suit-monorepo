import { computed, onMounted, ref, watch } from 'vue'
/** Optional media is progressive enhancement; broken/unsafe sources use the same local placeholder. */
export function useOptionalImage(source: () => string | null | undefined, element?: () => HTMLImageElement | null, localPreview: () => boolean = () => false, inlineRaster: () => boolean = () => false) {
  const broken = ref(false)
  const image = computed(() => {
    const value = source()?.trim()
    if (value && inlineRaster() && value.length <= 175000 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) return value
    if (!value || value.length > 2000 || /\s/.test(value)) return null
    try {
      const url = new URL(value)
      const preview = localPreview() && url.protocol === 'blob:' && typeof location !== 'undefined' && url.origin === location.origin
      const localStorage = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) && url.pathname.startsWith('/storage/v1/object/sign/shop-catalog-images/')
      return (url.protocol === 'https:' || preview || localStorage) && !url.username && !url.password ? value : null
    } catch { return null }
  })
  watch(source, () => { broken.value = false })
  if (element) onMounted(() => {
    const node = element()
    // An SSR image can fail before hydration attaches its error listener.
    if (node?.complete && node.naturalWidth === 0) broken.value = true
  })
  return { image, broken, failed: () => { broken.value = true } }
}

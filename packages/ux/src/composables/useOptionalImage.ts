import { computed, ref, watch } from 'vue'
/** Optional media is progressive enhancement; broken/unsafe sources use the same local placeholder. */
export function useOptionalImage(source: () => string | null | undefined) {
  const broken = ref(false)
  const image = computed(() => {
    const value = source()?.trim()
    if (!value || value.length > 2000 || /\s/.test(value)) return null
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? value : null } catch { return null }
  })
  watch(source, () => { broken.value = false })
  return { image, broken, failed: () => { broken.value = true } }
}

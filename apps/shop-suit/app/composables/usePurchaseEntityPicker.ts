import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
type Choice = { id: string; name: string }
/** Product-owned lazy RPC adapter; the shared picker owns presentation. */
export function usePurchaseEntityPicker(kind: 'product' | 'supplier') {
  const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
  const { currentId } = useShop()
  const user = useSupabaseUser()
  const { locale } = useI18n()
  const search = ref('')
  const page = ref(1)
  const items = ref<Choice[]>([])
  const total = ref(0)
  const pending = ref(false)
  const failed = ref(false)
  let generation = 0
  const copy = computed(() => locale.value === 'ar'
    ? { more: 'تحميل المزيد', failed: 'تعذّر تحميل الخيارات.', retry: 'إعادة المحاولة' }
    : { more: 'Load more', failed: 'Could not load choices.', retry: 'Retry' })
  async function load(append = false) {
    const request = ++generation
    const shopId = currentId.value
    if (!shopId) { items.value = []; total.value = 0; pending.value = false; return }
    pending.value = true
    failed.value = false
    const args = { p_shop_id: shopId, p_search: search.value.trim() || null, p_page: page.value, p_page_size: 20 }
    try {
      const result = kind === 'product'
        ? await rpc.rpc('list_products', { ...args, p_category_id: null })
        : await rpc.rpc('list_vendors', { ...args, p_is_active: true })
      if (request !== generation) return
      if (result.error) throw result.error
      const data = result.data as { items: Choice[]; total: number }
      items.value = append ? [...items.value, ...data.items] : data.items
      total.value = data.total
    } catch { if (request === generation) failed.value = true }
    finally { if (request === generation) pending.value = false }
  }
  function query(value: string) { search.value = value; page.value = 1; void load() }
  function more() { if (pending.value) return; page.value += 1; void load(true) }
  function options(selected?: Choice) { return selected && !items.value.some(item => item.id === selected.id) ? [selected, ...items.value] : items.value }
  watch([currentId, () => user.value?.id], () => { generation++; search.value = ''; page.value = 1; items.value = []; total.value = 0; void load() }, { immediate: true })
  onScopeDispose(() => { generation++ })
  return { items, pending, copy, error: computed(() => failed.value ? copy.value.failed : null), hasMore: computed(() => items.value.length < total.value), query, more, options, retry: () => load(page.value > 1) }
}

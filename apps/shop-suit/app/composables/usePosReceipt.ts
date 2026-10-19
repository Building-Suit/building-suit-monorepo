import type { BsReceiptPreview } from '@building-suit/ui/types/receiptPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { SaleReceiptSnapshot } from '~/types/receipt'
import { projectReceipt, projectReceiptCopy } from '~/utils/receiptPresentation'
import { usePosReceiptStore } from '~/stores/posReceipt'
import { useShopScopeStore } from '~/stores/scope'

export function usePosReceipt() {
  const store = usePosReceiptStore()
  const scope = useShopScopeStore()
  const { currentId, currentLocationId } = useShop()
  const { t, locale } = useI18n()
  const receiptTranslate = useReceiptTranslation()
  const rpc = useShopClient<ShopRpcDatabase>().schema('public')
  const chosenLanguage = ref<'en' | 'ar' | null>(null)
  const completing = ref(false)
  const recentOpen = ref(false)
  const paperSize = ref<'thermal_80' | 'a4'>('thermal_80')
  const share = useSaleReceiptShare()
  const overlay = useOverlayState()
  watch([() => scope.actorId, () => scope.revision, currentId, currentLocationId], () => {
    store.selectScope(JSON.stringify([scope.actorId, scope.revision, currentId.value, currentLocationId.value]))
    chosenLanguage.value = null; completing.value = false; recentOpen.value = false; share.clearImage(); overlay.close()
  }, { immediate: true, flush: 'sync' })
  const query = useShopQuery(
    () => `shop-data:pos-receipt:${store.invoiceId ?? 'latest'}`,
    async (): Promise<SaleReceiptSnapshot | null> => {
      if (!currentId.value || !currentLocationId.value) return null
      const result = await rpc.rpc('get_own_pos_receipt', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_invoice_id: store.invoiceId })
      if (result.error) throw result.error
      return result.data as SaleReceiptSnapshot | null
    },
    { watch: [currentId, currentLocationId, () => store.invoiceId], default: () => null, enabled: () => Boolean(overlay.open.value && !recentOpen.value && scope.actorId && currentId.value && currentLocationId.value) },
  )
  const recentQuery = useShopQuery(
    () => 'shop-data:pos-recent-receipts',
    async () => {
      if (!currentId.value || !currentLocationId.value) return []
      const result = await rpc.rpc('list_own_pos_receipts', { p_shop_id: currentId.value, p_location_id: currentLocationId.value })
      if (result.error) throw result.error
      return result.data ?? []
    },
    { watch: [currentId, currentLocationId], default: () => [], enabled: () => Boolean(overlay.open.value && recentOpen.value && scope.actorId && currentId.value && currentLocationId.value) },
  )
  watch(() => query.data.value?.invoiceId, () => {
    const value = query.data.value
    if (!value) return
    if (value.invoiceId !== store.invoiceId) store.remember(value.invoiceId)
    paperSize.value = value.paperSize; share.clearImage()
  }, { immediate: true })
  const language = computed(() => chosenLanguage.value ?? query.data.value?.presentation?.language ?? (locale.value === 'ar' ? 'ar' : 'en'))
  const projected = computed(() => query.data.value ? projectReceipt(query.data.value, language.value, key => receiptTranslate(key, language.value)) : null)
  const view = computed<BsReceiptPreview>(() => ({
    paperSize: paperSize.value, paperOptions: [{ value: 'thermal_80', label: t('receipt.thermal80') }, { value: 'a4', label: t('receipt.a4') }],
    receipt: projected.value?.view ?? null,
    documentCopy: projected.value?.copy ?? projectReceiptCopy(undefined, key => receiptTranslate(key, language.value)),
    copy: { back: locale.value === 'ar' ? 'إغلاق' : 'Close', print: store.printed ? t('receipt.reprint') : t('receipt.print'), language: t('receipt.language'), paperSize: t('receipt.paperSize'), share: t('receipt.share'), download: t('receipt.download'), loading: t('receipt.loading'), loadError: t('receipt.loadError'), retry: t('common.retry'), unavailable: t('receipt.unavailable') },
    language: language.value, languageOptions: [{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }],
    printed: store.printed, loading: query.pending.value || completing.value, error: Boolean(query.error.value), sharing: share.sharing.value, shareError: share.shareError.value,
    lastLabel: t('receipt.myRecent'),
    recent: {
      active: recentOpen.value, title: t('receipt.myRecent'), hint: t('receipt.recentHint'), empty: t('receipt.recentEmpty'),
      loading: recentQuery.pending.value, error: Boolean(recentQuery.error.value), openLabel: t('receipt.open'), backLabel: t('receipt.backToRecent'),
      items: recentQuery.data.value.map(item => ({ id: item.invoiceId, number: item.invoiceNumber,
        issued: new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.issuedAt)),
        total: new Intl.NumberFormat(locale.value, { style: 'currency', currency: item.currency }).format(item.total),
      })),
    },
  }))
  async function refresh() {
    // Receipt retrieval has its own retry state; a successful payment stays successful.
    try { await (recentOpen.value ? recentQuery.refresh() : query.refresh()) } catch { /* Colada retains the receipt error. */ }
  }
  async function completed(invoiceId: string) {
    const captured = store.scope
    completing.value = true; store.remember(invoiceId); share.clearImage(); chosenLanguage.value = null; recentOpen.value = false; overlay.show()
    try { await nextTick(); if (store.scope === captured) await refresh() }
    finally { if (store.scope === captured) completing.value = false }
  }
  async function open() {
    const captured = store.scope
    recentOpen.value = true; overlay.show(); await nextTick()
    if (store.scope === captured) await refresh()
  }
  function select(id: string) {
    if (!recentQuery.data.value.some(item => item.invoiceId === id)) return
    store.remember(id); chosenLanguage.value = null; share.clearImage(); recentOpen.value = false
  }
  function setPaper(value: string) { if (value === 'thermal_80' || value === 'a4') paperSize.value = value }
  function setLanguage(value: string | number | (string | number)[]) { if (value === 'en' || value === 'ar') chosenLanguage.value = value }
  return { view, visible: overlay.open, completed, open, select, setLanguage, setPaper, refresh, printed: () => store.markPrinted(), share: () => query.data.value && share.shareReceipt(query.data.value, language.value, store.printed), download: share.downloadReceiptImage }
}

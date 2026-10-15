import { renderReceiptDocument } from '@building-suit/ui/utils/receiptDocument'
import { copyDocumentImage, renderDocumentImage, downloadDocumentImage } from '@building-suit/ux'
import type { SaleReceiptSnapshot } from '~/types/receipt'
import { projectReceipt } from '~/utils/receiptPresentation'

export function useSaleReceiptShare() {
  const { t, locale } = useI18n()
  const { push: pushToast } = useToasts()
  const { currentId, currentLocationId } = useShop()
  const route = useRoute()
  const sharing = ref(false)
  const shareError = ref('')
  let fallback: { markup: string; filename: string } | null = null
  let generation = 0

  function clearImage() {
    generation += 1
    fallback = null
    shareError.value = ''
    sharing.value = false
  }
  watch([currentId, currentLocationId, () => String(route.params.id ?? '')], clearImage)
  onScopeDispose(clearImage)

  async function currentImage(markup: string, attempt: number) {
    const image = await renderDocumentImage(markup)
    if (attempt !== generation) throw new Error('STALE_DOCUMENT')
    return image
  }

  async function shareReceipt(receipt: SaleReceiptSnapshot, language = receipt.presentation?.language ?? locale.value, reprint = false) {
    if (sharing.value || !import.meta.client) return
    sharing.value = true
    shareError.value = ''
    fallback = null
    const attempt = ++generation
    try {
      const projected = projectReceipt(receipt, language, key => t(key, {}, { locale: language }))
      const markup = renderReceiptDocument(projected.view, projected.copy, language, reprint)
      fallback = { markup, filename: receipt.invoiceNumber }
      await copyDocumentImage(() => currentImage(markup, attempt))
      if (attempt === generation) pushToast({ tone: 'success', title: t('receipt.copied') })
    }
    catch { if (attempt === generation) shareError.value = t('receipt.shareError') }
    finally { if (attempt === generation) sharing.value = false }
  }

  async function downloadReceiptImage() {
    if (!fallback || sharing.value) return
    const value = fallback
    const attempt = ++generation
    sharing.value = true
    try {
      await downloadDocumentImage(() => currentImage(value.markup, attempt), value.filename)
      if (attempt === generation) shareError.value = ''
    }
    catch { if (attempt === generation) shareError.value = t('receipt.imageError') }
    finally { if (attempt === generation) sharing.value = false }
  }

  return { sharing, shareError, shareReceipt, downloadReceiptImage }
}

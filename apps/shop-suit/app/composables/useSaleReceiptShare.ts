import { renderReceiptDocument } from '@building-suit/ui/utils/receiptDocument'
import { copyDocumentImage, renderDocumentImage, downloadDocumentImage } from '@building-suit/ux'
import type { SaleReceiptSnapshot } from '~/types/receipt'
import { projectReceipt } from '~/utils/receiptPresentation'

export function useSaleReceiptShare() {
  const { t, locale } = useI18n()
  const { push: pushToast } = useToasts()
  const sharing = ref(false)
  const shareError = ref('')
  let fallback: { markup: string; filename: string } | null = null

  async function shareReceipt(receipt: SaleReceiptSnapshot, language = receipt.presentation?.language ?? locale.value, reprint = false) {
    if (sharing.value || !import.meta.client) return
    sharing.value = true
    shareError.value = ''
    const projected = projectReceipt(receipt, language, key => t(key, {}, { locale: language }))
    const markup = renderReceiptDocument(projected.view, projected.copy, language, reprint)
    fallback = { markup, filename: receipt.invoiceNumber }
    try {
      await copyDocumentImage(() => renderDocumentImage(markup))
      pushToast({ tone: 'success', title: t('receipt.copied') })
    }
    catch { shareError.value = t('receipt.shareError') }
    finally { sharing.value = false }
  }

  async function downloadReceiptImage() {
    if (!fallback || sharing.value) return
    sharing.value = true
    try {
      await downloadDocumentImage(() => renderDocumentImage(fallback!.markup), fallback.filename)
      shareError.value = ''
    }
    catch { shareError.value = t('receipt.imageError') }
    finally { sharing.value = false }
  }

  return { sharing, shareError, shareReceipt, downloadReceiptImage }
}

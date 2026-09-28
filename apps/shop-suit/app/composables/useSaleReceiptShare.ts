import type { SaleReceiptSnapshot } from '~/types/receipt'
import { buildReceiptShareText } from '~/utils/receipt'

export function useSaleReceiptShare() {
  const { t, locale } = useI18n()
  const { push: pushToast } = useToasts()
  const sharing = ref(false)
  const shareError = ref('')

  async function shareReceipt(receipt: SaleReceiptSnapshot) {
    if (sharing.value || !import.meta.client) return
    sharing.value = true
    shareError.value = ''
    const text = buildReceiptShareText(receipt, {
      invoice: t('receipt.invoice'), date: t('receipt.date'), location: t('receipt.location'),
      staff: t('receipt.staff'), customer: t('receipt.customer'), items: t('receipt.items'),
      payment: t('receipt.payment'), total: t('receipt.total'), quantity: t('receipt.quantity'),
      compliance: t('receipt.compliance'), walkIn: t('receipt.walkIn'),
    }, locale.value, method => t(`payments.methods.${method}`))
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: `${receipt.business.name} · ${receipt.invoiceNumber}`, text })
      }
      else {
        await navigator.clipboard.writeText(text)
        pushToast({ tone: 'success', title: t('receipt.copied') })
      }
    }
    catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) shareError.value = t('receipt.shareError')
    }
    finally { sharing.value = false }
  }

  return { sharing, shareError, shareReceipt }
}

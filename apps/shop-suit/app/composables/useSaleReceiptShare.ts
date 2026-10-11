import type { SaleReceiptSnapshot } from '~/types/receipt'
import { buildReceiptShareText } from '~/utils/receipt'

export function useSaleReceiptShare() {
  const { t, locale } = useI18n()
  const { push: pushToast } = useToasts()
  const { sharing, share } = useBrowserShare()
  const shareError = ref('')

  async function shareReceipt(receipt: SaleReceiptSnapshot) {
    if (sharing.value || !import.meta.client) return
    shareError.value = ''
    const text = buildReceiptShareText(receipt, {
      invoice: t('receipt.invoice'), date: t('receipt.date'), location: t('receipt.location'),
      staff: t('receipt.staff'), customer: t('receipt.customer'), items: t('receipt.items'),
      payment: t('receipt.payment'), total: t('receipt.total'), quantity: t('receipt.quantity'),
      compliance: t('receipt.compliance'), walkIn: t('receipt.walkIn'),
    }, locale.value, method => t(`payments.methods.${method}`))
    const result = await share({ title: `${receipt.business.name} · ${receipt.invoiceNumber}`, text })
    if (result === 'copied') pushToast({ tone: 'success', title: t('receipt.copied') })
    if (result === 'error') shareError.value = t('receipt.shareError')
  }

  return { sharing, shareError, shareReceipt }
}

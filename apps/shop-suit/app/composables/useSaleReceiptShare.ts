import type { SaleReceiptSnapshot } from '~/types/receipt'
import { buildReceiptShareText } from '~/utils/receipt'

export function useSaleReceiptShare() {
  const { t, locale } = useI18n()
  const { push: pushToast } = useToasts()
  const { sharing, share } = useBrowserShare()
  const shareError = ref('')

  async function shareReceipt(receipt: SaleReceiptSnapshot, language = receipt.presentation?.language ?? locale.value) {
    if (sharing.value || !import.meta.client) return
    shareError.value = ''
    const translate = (key: string) => t(key, {}, { locale: language })
    const text = buildReceiptShareText(receipt, {
      invoice: translate('receipt.invoice'), date: translate('receipt.date'), location: translate('receipt.location'),
      staff: translate('receipt.staff'), customer: translate('receipt.customer'), items: translate('receipt.items'),
      payment: translate('receipt.payment'), total: translate('receipt.total'), quantity: translate('receipt.quantity'),
      compliance: translate('receipt.compliance'), walkIn: translate('receipt.walkIn'),
    }, language, method => translate(`payments.methods.${method}`))
    const result = await share({ title: `${receipt.business.name} · ${receipt.invoiceNumber}`, text })
    if (result === 'copied') pushToast({ tone: 'success', title: t('receipt.copied') })
    if (result === 'error') shareError.value = t('receipt.shareError')
  }

  return { sharing, shareError, shareReceipt }
}

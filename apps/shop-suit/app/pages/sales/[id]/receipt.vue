<script setup lang="ts">
import type { BsReceiptView, BsReceiptDocumentCopy, BsReceiptPageCopy } from '@building-suit/ui/types/receiptPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { ReceiptPaperSize, SaleReceiptSnapshot } from '~/types/receipt'
import { formatReceiptDate, formatReceiptMoney } from '~/utils/receipt'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

const route = useRoute()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId } = useShop()
const { t, locale } = useI18n()
const saleId = computed(() => String(route.params.id ?? ''))
const chosenLanguage = ref<'en' | 'ar' | null>(null)
const paperSize = ref<ReceiptPaperSize>('thermal_80')
const printed = ref(route.query.origin !== 'pos')
const { sharing, shareError, shareReceipt } = useSaleReceiptShare()

const { data: receipt, pending, error, refresh } = useAsyncData(
  () => `shop-data:sale-receipt:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${saleId.value}`,
  async (): Promise<SaleReceiptSnapshot | null> => {
    if (!currentId.value || !currentLocationId.value || !saleId.value) return null
    const { data, error: receiptError } = await rpc.rpc('get_location_sale_receipt', {
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_invoice_id: saleId.value,
    })
    if (receiptError) throw receiptError
    return data as SaleReceiptSnapshot | null
  },
  { watch: [currentId, currentLocationId, saleId], default: () => null },
)

const receiptLanguage = computed<'en' | 'ar'>({
  get: () => chosenLanguage.value ?? receipt.value?.presentation?.language ?? (locale.value === 'ar' ? 'ar' : 'en'),
  set: value => { chosenLanguage.value = value },
})
watch([currentId, currentLocationId, saleId], () => { chosenLanguage.value = null })

watch(receipt, (value) => {
  if (value) {
    paperSize.value = value.paperSize
  }
}, { immediate: true })

function copy(key: string, params?: Record<string, unknown>) {
  return t(`receipt.${key}`, params ?? {}, { locale: receiptLanguage.value })
}
function paymentLabel(method: SaleReceiptSnapshot['payments'][number]['method']) {
  return t(`payments.methods.${method}`, {}, { locale: receiptLanguage.value })
}
function money(value: number) {
  return receipt.value ? formatReceiptMoney(value, receipt.value.currency, receiptLanguage.value) : ''
}
function date(value: string) { return formatReceiptDate(value, receiptLanguage.value) }
const { print } = useDocumentPrint()
async function printReceipt() {
  if (receipt.value && await print()) printed.value = true
}
const receiptView = computed<BsReceiptView | null>(() => {
  const value = receipt.value
  if (!value) return null
  return {
    logoDataUrl: value.presentation?.logoDataUrl, notes: value.presentation?.notes,
    direction: value.presentation?.direction === 'auto' ? undefined : value.presentation?.direction,
    issuer: value.business.name, issuerDetails: [value.business.address, value.business.phone].filter((item): item is string => Boolean(item)),
    invoice: value.invoiceNumber, issued: date(value.issuedAt), location: value.location,
    staff: value.staffName || '—', customer: value.customer.name || copy('walkIn'),
    lines: value.lines.map(line => ({ id: line.id, label: line.name, description: value.presentation?.showDescriptions === false ? undefined : line.description || line.sku || undefined, quantity: String(Number(line.quantity)), unitPrice: money(line.unitPrice), total: money(line.total) })),
    totals: [ { id: 'subtotal', label: copy('subtotal'), value: money(value.subtotal) },
      ...(value.discount ? [{ id: 'discount', label: copy('discount'), value: '− ' + money(value.discount) }] : []),
      ...(value.tax?.calculationEnabled ? [{ id: 'tax', label: receiptLanguage.value === 'ar' ? 'الضريبة' : 'Tax', value: money(value.tax.tax) }] : []),
      { id: 'total', label: copy('total'), value: money(value.total), emphasis: true } ],
    payments: value.payments.map(payment => ({ id: payment.id, summary: `${paymentLabel(payment.method)} · ${money(payment.amount)}`, reference: payment.reference })),
    footer: value.footer,
  }
})
const pageCopy = computed<BsReceiptPageCopy>(() => ({
  back: t('receipt.back'), print: printed.value ? t('receipt.reprint') : t('receipt.print'),
  language: t('receipt.language'), paperSize: t('receipt.paperSize'), share: t('receipt.share'),
  loading: t('receipt.loading'), loadError: t('receipt.loadError'), retry: t('common.retry'), unavailable: t('receipt.unavailable'),
}))
const documentCopy = computed<BsReceiptDocumentCopy>(() => ({
  title: receipt.value?.presentation?.documentLabel || copy('title'),
  reprintLabel: copy('reprintLabel'),
  invoice: receipt.value?.presentation?.referenceLabel || copy('invoice'),
  date: copy('date'),
  location: copy('location'),
  address: copy('address'),
  phone: copy('phone'),
  staff: copy('staff'),
  customer: copy('customer'),
  items: copy('items'),
  item: copy('item'),
  quantity: copy('quantity'),
  unitPrice: copy('unitPrice'),
  lineTotal: copy('lineTotal'),
  total: copy('total'),
  payment: copy('payment'),
  compliance: copy('compliance'),
}))
const languageModel = computed<string>({ get: () => receiptLanguage.value, set: value => { if (value === 'en' || value === 'ar') receiptLanguage.value = value } })
const paperModel = computed<string>({ get: () => paperSize.value, set: value => { if (value === 'thermal_80' || value === 'a4') paperSize.value = value } })
const paperOptions = computed(() => [{ value: 'thermal_80', label: t('receipt.thermal80') }, { value: 'a4', label: t('receipt.a4') }])
</script>
<template>
  <BsReceiptPage v-model:language="languageModel" v-model:paper-size="paperModel" :receipt="receiptView" :copy="pageCopy" :document-copy="documentCopy" :back-to="`/sales/${saleId}`" :language-options="[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]" :paper-options="paperOptions" :printed="printed" :sharing="sharing" :share-error="shareError" :loading="pending" :error="Boolean(error)" @print="printReceipt" @share="receipt && shareReceipt(receipt, receiptLanguage)" @retry="refresh()"/>
</template>

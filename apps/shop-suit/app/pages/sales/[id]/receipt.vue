<script setup lang="ts">
import type { BsReceiptView, BsReceiptDocumentCopy, BsReceiptPageCopy } from '@building-suit/ui/types/receiptPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { ReceiptPaperSize, SaleReceiptSnapshot } from '~/types/receipt'
import { projectReceipt, projectReceiptCopy } from '~/utils/receiptPresentation'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

const route = useRoute()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId } = useShop()
const { t, locale } = useI18n()
const saleId = computed(() => String(route.params.id ?? ''))
const chosenLanguage = ref<'en' | 'ar' | null>(null)
const paperSize = ref<ReceiptPaperSize>('thermal_80')
const printed = ref(route.query.origin !== 'pos')
const { sharing, shareError, shareReceipt, downloadReceiptImage } = useSaleReceiptShare()

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

const { print } = useDocumentPrint()
async function printReceipt() {
  if (receipt.value && await print()) printed.value = true
}
const projected = computed(() => receipt.value ? projectReceipt(receipt.value, receiptLanguage.value, key => t(key, {}, { locale: receiptLanguage.value })) : null)
const receiptView = computed<BsReceiptView | null>(() => projected.value?.view ?? null)
const pageCopy = computed<BsReceiptPageCopy>(() => ({
  back: t('receipt.back'), print: printed.value ? t('receipt.reprint') : t('receipt.print'),
  language: t('receipt.language'), paperSize: t('receipt.paperSize'), share: t('receipt.share'), download: t('receipt.download'),
  loading: t('receipt.loading'), loadError: t('receipt.loadError'), retry: t('common.retry'), unavailable: t('receipt.unavailable'),
}))
const documentCopy = computed<BsReceiptDocumentCopy>(() => projected.value?.copy ?? projectReceiptCopy(undefined, key => t(key, {}, { locale: receiptLanguage.value })))
const languageModel = computed<string>({ get: () => receiptLanguage.value, set: value => { if (value === 'en' || value === 'ar') receiptLanguage.value = value } })
const paperModel = computed<string>({ get: () => paperSize.value, set: value => { if (value === 'thermal_80' || value === 'a4') paperSize.value = value } })
const paperOptions = computed(() => [{ value: 'thermal_80', label: t('receipt.thermal80') }, { value: 'a4', label: t('receipt.a4') }])
</script>
<template>
  <BsReceiptPage v-model:language="languageModel" v-model:paper-size="paperModel" :receipt="receiptView" :copy="pageCopy" :document-copy="documentCopy" :back-to="`/sales/${saleId}`" :language-options="[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]" :paper-options="paperOptions" :printed="printed" :sharing="sharing" :share-error="shareError" :loading="pending" :error="Boolean(error)" @print="printReceipt" @share="receipt && shareReceipt(receipt, receiptLanguage, printed)" @download="downloadReceiptImage" @retry="refresh()"/>
</template>

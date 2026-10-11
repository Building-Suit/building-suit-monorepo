<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { ReceiptPaperSize, SaleReceiptSnapshot } from '~/types/receipt'
import { formatReceiptDate, formatReceiptMoney } from '~/utils/receipt'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

const route = useRoute()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId } = useShop()
const { t, locale } = useI18n()
const saleId = computed(() => String(route.params.id ?? ''))
const receiptLanguage = ref<'en' | 'ar'>(locale.value === 'ar' ? 'ar' : 'en')
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

watch(receipt, (value) => {
  if (value) paperSize.value = value.paperSize
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
async function printReceipt() {
  if (!import.meta.client || !receipt.value) return
  await nextTick()
  window.print()
  printed.value = true
}
</script>

<template>
  <BsPage>
    <BsPrintActions :back-to="`/sales/${saleId}`" :back-label="t('receipt.back')" :print-label="printed ? t('receipt.reprint') : t('receipt.print')" :disabled="!receipt" @print="printReceipt">
      <BsChoiceGroup v-model="receiptLanguage" type="radio" inline :legend="t('receipt.language')" :options="[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]" />
      <BsSelect v-model="paperSize" :label="t('receipt.paperSize')" :options="[{ value: 'thermal_80', label: t('receipt.thermal80') }, { value: 'a4', label: t('receipt.a4') }]" option-label="label" option-value="value" />
      <BsButton variant="secondary" :pending="sharing" :disabled="!receipt" @click="receipt && shareReceipt(receipt)">{{ t('receipt.share') }}</BsButton>
    </BsPrintActions>
    <BsAlert v-if="shareError" tone="error">{{ shareError }}</BsAlert>
    <BsStateSurface v-if="pending" state="loading" :title="t('receipt.loading')" />
    <BsStateSurface v-else-if="error" state="error" :title="t('receipt.loadError')" :action-label="t('common.retry')" @action="refresh()" />
    <BsStateSurface v-else-if="!receipt" state="empty" :title="t('receipt.unavailable')" />
    <BsPrintableDocument v-else :format="paperSize === 'thermal_80' ? 'receipt' : 'a4'" :label="copy('title')" :dir="receiptLanguage === 'ar' ? 'rtl' : 'ltr'" :lang="receiptLanguage">
      <template #header>
        <BsDocumentHeader :title="copy('title')" :issuer="receipt.business.name" :details="[receipt.business.address, receipt.business.phone].filter((value): value is string => Boolean(value))">
          <BsText v-if="printed" emphasis="bold">{{ copy('reprintLabel') }}</BsText>
        </BsDocumentHeader>
      </template>
      <BsDescriptionList density="compact">
        <BsDescriptionItem :term="copy('invoice')">
          <BsText dir="ltr">{{ receipt.invoiceNumber }}</BsText>
        </BsDescriptionItem>
        <BsDescriptionItem :term="copy('date')">{{ date(receipt.issuedAt) }}</BsDescriptionItem>
        <BsDescriptionItem :term="copy('location')">{{ receipt.location.name }}<BsText v-if="receipt.location.code" as="span" dir="ltr"> · {{ receipt.location.code }}</BsText>
        </BsDescriptionItem>
        <BsDescriptionItem v-if="receipt.location.address" :term="copy('address')">{{ receipt.location.address }}</BsDescriptionItem>
        <BsDescriptionItem v-if="receipt.location.phone" :term="copy('phone')">
          <BsText dir="ltr">{{ receipt.location.phone }}</BsText>
        </BsDescriptionItem>
        <BsDescriptionItem :term="copy('staff')">{{ receipt.staffName || '—' }}</BsDescriptionItem>
        <BsDescriptionItem :term="copy('customer')">{{ receipt.customer.name || copy('walkIn') }}</BsDescriptionItem>
      </BsDescriptionList>
      <BsDocumentLines :label="copy('items')" :item-label="copy('item')" :quantity-label="copy('quantity')" :price-label="copy('unitPrice')" :total-label="copy('lineTotal')" :lines="receipt.lines.map(line => ({ id: line.id, label: line.name, description: line.sku || undefined, quantity: String(Number(line.quantity)), unitPrice: money(line.unitPrice), total: money(line.total) }))" />
      <BsDocumentTotals
        :label="copy('total')" :totals="[
          { id: 'subtotal', label: copy('subtotal'), value: money(receipt.subtotal) },
          ...(receipt.discount ? [{ id: 'discount', label: copy('discount'), value: '− ' + money(receipt.discount) }] : []),
          { id: 'total', label: copy('total'), value: money(receipt.total), emphasis: true },
        ]" />
      <BsContentSection :title="copy('payment')">
        <BsInline v-for="payment in receipt.payments" :key="payment.id" justify="between">
          <BsText>{{ paymentLabel(payment.method) }} · {{ money(payment.amount) }}</BsText>
          <BsText v-if="payment.reference" dir="ltr">{{ payment.reference }}</BsText>
        </BsInline>
      </BsContentSection>
      <template #footer>
        <BsText v-if="receipt.footer" wrap="preserve">{{ receipt.footer }}</BsText>
        <BsText size="xs">{{ copy('compliance') }}</BsText>
      </template>
    </BsPrintableDocument>
  </BsPage>
</template>

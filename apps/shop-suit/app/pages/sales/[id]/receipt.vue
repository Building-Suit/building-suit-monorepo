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
  <div class="receipt-page mx-auto max-w-5xl space-y-5">
    <div class="receipt-controls flex flex-wrap items-center justify-between gap-3">
      <NuxtLink :to="`/sales/${saleId}`" class="inline-flex min-h-11 items-center font-semibold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ t('receipt.back') }}</NuxtLink>
      <div class="flex flex-wrap gap-2">
        <div class="flex rounded-xl border border-border p-1" role="group" :aria-label="t('receipt.language')">
          <BsButton v-for="language in ['en', 'ar'] as const" :key="language" type="button" class="min-h-11 rounded-lg px-3 text-sm font-bold" :class="receiptLanguage === language ? 'bg-primary text-primary-foreground' : ''" @click="receiptLanguage = language">{{ language === 'ar' ? 'العربية' : 'English' }}</BsButton>
        </div>
        <select v-model="paperSize" class="ls-select min-h-11" :aria-label="t('receipt.paperSize')">
          <option value="thermal_80">{{ t('receipt.thermal80') }}</option>
          <option value="a4">{{ t('receipt.a4') }}</option>
        </select>
        <BsButton :disabled="!receipt" class="min-h-11" @click="printReceipt">{{ printed ? t('receipt.reprint') : t('receipt.print') }}</BsButton>
        <BsButton severity="secondary" :pending="sharing" :disabled="!receipt" class="min-h-11" @click="receipt && shareReceipt(receipt)">{{ t('receipt.share') }}</BsButton>
      </div>
    </div>

    <p v-if="shareError" role="alert" class="receipt-controls rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ shareError }}</p>
    <div v-if="pending" role="status" class="ls-card p-12 text-center">{{ t('receipt.loading') }}</div>
    <div v-else-if="error" role="alert" class="ls-card p-8 text-center"><p>{{ t('receipt.loadError') }}</p><BsButton severity="secondary" class="mt-3" @click="refresh()">{{ t('common.retry') }}</BsButton></div>
    <div v-else-if="!receipt" role="status" class="ls-card p-8 text-center"><p>{{ t('receipt.unavailable') }}</p><NuxtLink :to="`/sales/${saleId}`" class="mt-3 inline-block font-bold text-[var(--bs-link)]">{{ t('receipt.back') }}</NuxtLink></div>

    <article v-else class="receipt-print-surface mx-auto bg-white text-black" :class="paperSize === 'thermal_80' ? 'receipt-thermal' : 'receipt-a4'" :dir="receiptLanguage === 'ar' ? 'rtl' : 'ltr'" :lang="receiptLanguage">
      <header class="text-center">
        <p v-if="printed" class="receipt-copy-label">{{ copy('reprintLabel') }}</p>
        <h1>{{ receipt.business.name }}</h1>
        <p v-if="receipt.business.address">{{ receipt.business.address }}</p>
        <p v-if="receipt.business.phone" dir="ltr">{{ receipt.business.phone }}</p>
        <div class="receipt-rule" />
        <p class="receipt-title">{{ copy('title') }}</p>
      </header>

      <dl class="receipt-meta">
        <div><dt>{{ copy('invoice') }}</dt><dd dir="ltr">{{ receipt.invoiceNumber }}</dd></div>
        <div><dt>{{ copy('date') }}</dt><dd>{{ date(receipt.issuedAt) }}</dd></div>
        <div><dt>{{ copy('location') }}</dt><dd>{{ receipt.location.name }}<template v-if="receipt.location.code"> · <span dir="ltr">{{ receipt.location.code }}</span></template></dd></div>
        <div v-if="receipt.location.address"><dt>{{ copy('address') }}</dt><dd>{{ receipt.location.address }}</dd></div>
        <div v-if="receipt.location.phone"><dt>{{ copy('phone') }}</dt><dd dir="ltr">{{ receipt.location.phone }}</dd></div>
        <div><dt>{{ copy('staff') }}</dt><dd>{{ receipt.staffName || '—' }}</dd></div>
        <div><dt>{{ copy('customer') }}</dt><dd>{{ receipt.customer.name || copy('walkIn') }}</dd></div>
      </dl>

      <div class="receipt-rule" />
      <section class="receipt-items" :aria-label="copy('items')">
        <div class="receipt-item-row receipt-item-head" aria-hidden="true"><span>{{ copy('item') }}</span><span>{{ copy('quantity') }}</span><span>{{ copy('unitPrice') }}</span><span>{{ copy('lineTotal') }}</span></div>
        <ul><li v-for="line in receipt.lines" :key="line.id" class="receipt-item-row"><span><strong>{{ line.name }}</strong><small v-if="line.sku" dir="ltr">{{ line.sku }}</small></span><span><span class="sr-only">{{ copy('quantity') }}: </span>{{ Number(line.quantity) }}</span><span><span class="sr-only">{{ copy('unitPrice') }}: </span>{{ money(line.unitPrice) }}</span><span><span class="sr-only">{{ copy('lineTotal') }}: </span>{{ money(line.total) }}</span></li></ul>
      </section>

      <div class="receipt-rule" />
      <dl class="receipt-totals">
        <div><dt>{{ copy('subtotal') }}</dt><dd>{{ money(receipt.subtotal) }}</dd></div>
        <div v-if="receipt.discount"><dt>{{ copy('discount') }}</dt><dd>− {{ money(receipt.discount) }}</dd></div>
        <div class="receipt-grand-total"><dt>{{ copy('total') }}</dt><dd>{{ money(receipt.total) }}</dd></div>
      </dl>

      <section class="receipt-payments" :aria-label="copy('payment')">
        <h2>{{ copy('payment') }}</h2>
        <p v-for="payment in receipt.payments" :key="payment.id"><span>{{ paymentLabel(payment.method) }} · {{ money(payment.amount) }}</span><span v-if="payment.reference" dir="ltr">{{ payment.reference }}</span></p>
      </section>

      <footer class="text-center">
        <p v-if="receipt.footer" class="receipt-footer-copy">{{ receipt.footer }}</p>
        <p class="receipt-compliance">{{ copy('compliance') }}</p>
      </footer>
    </article>
  </div>
</template>

<style scoped>
.receipt-print-surface { box-sizing: border-box; box-shadow: 0 18px 60px rgb(15 23 42 / 14%); font-family: Manrope, "IBM Plex Sans Arabic", sans-serif; line-height: 1.45; }
.receipt-thermal { width: min(100%, 80mm); padding: 5mm 4mm; font-size: 11px; page: receipt-thermal; }
.receipt-a4 { width: min(100%, 210mm); min-height: 260mm; padding: 16mm; font-size: 14px; page: receipt-a4; }
.receipt-print-surface h1 { font-size: 1.45em; font-weight: 800; }
.receipt-title { font-size: 1.15em; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; }
.receipt-copy-label { display: inline-block; margin-block-end: 4px; border: 1px solid currentColor; padding: 2px 7px; font-weight: 800; }
.receipt-rule { margin-block: 12px; border-block-start: 1px dashed #111; }
.receipt-meta, .receipt-totals { display: grid; gap: 4px; }
.receipt-meta > div, .receipt-totals > div { display: flex; justify-content: space-between; gap: 12px; }
.receipt-meta dt, .receipt-totals dt { font-weight: 700; }
.receipt-meta dd, .receipt-totals dd { text-align: end; }
.receipt-item-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px; padding-block: 6px; border-block-end: 1px dotted #999; }
.receipt-item-row > :not(:first-child) { text-align: end; white-space: nowrap; }
.receipt-item-head { font-weight: 800; }
.receipt-item-row small { display: block; color: #444; }
.receipt-grand-total { font-size: 1.3em; font-weight: 800; }
.receipt-payments { margin-block-start: 14px; }
.receipt-payments h2 { font-weight: 800; }
.receipt-payments p { display: flex; justify-content: space-between; gap: 12px; }
.receipt-footer-copy { margin-block-start: 18px; font-weight: 700; white-space: pre-wrap; }
.receipt-compliance { margin-block-start: 14px; font-size: .82em; color: #333; }
@page receipt-thermal { size: 80mm auto; margin: 0; }
@page receipt-a4 { size: A4; margin: 0; }
@media print {
  :global(body *) { visibility: hidden !important; }
  .receipt-print-surface, .receipt-print-surface * { visibility: visible !important; }
  .receipt-print-surface { position: absolute; inset: 0 auto auto 0; box-shadow: none; margin: 0 !important; max-width: none; }
  .receipt-thermal { width: 80mm; }
  .receipt-a4 { width: 210mm; min-height: 297mm; }
}
@media (max-width: 640px) {
  .receipt-a4 { padding: 8mm; font-size: 12px; }
}
</style>

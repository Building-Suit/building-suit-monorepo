<script setup lang="ts">
import type { BsCommerceDocumentCopy, BsCommerceDocumentForm, BsCommerceCorrectionForm, BsCommerceDocumentView } from '@building-suit/ui/types/commerceDocumentPresentation'

import { shopCommandErrorMessage } from '~/utils/shopCommandErrorMessage'
import { saleCopy } from '~/utils/saleCopy'
import type { TaxQuote } from '~/types/tax'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { SaleReceiptSnapshot } from '~/types/receipt'
const { businessCurrency } = useShop()

definePageMeta({
  layout: 'default',
  middleware: ['auth', 'business-mode'],
})

type SaleLine = {
  id: string
  item_type: 'product' | 'service'
  item_name: string
  quantity: number
  unit_price: number
  discount_amount: number
  total_amount: number
  product_id: string | null
  service_id: string | null
  product_sku_snapshot: string | null
  product_barcode_snapshot: string | null
  discount_type_snapshot: string | null
  discount_value_snapshot: number | null
}
type SaleMovement = {
  id: string
  productId: string
  invoiceItemId: string
  batchId: string
  quantityChange: number
  unitCostSnapshot: number
  createdAt: string
}
type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
type PaymentEvent = {
  id: string
  eventType: 'receipt' | 'reversal' | 'refund'
  paymentId: string
  allocationId: string
  amount: number
  eventAt: string
  method: PaymentMethod | null
  reference: string | null
  reason?: string
  remainingEffective: number
}
type SaleDetail = {
  currency?: string
  id: string
  invoice_number: string | null
  status: 'draft' | 'issued'
  created_at: string
  issued_at: string | null
  total_amount: number
  discount_amount: number
  notes: string | null
  client_id: string | null
  client_name_snapshot: string | null
  client_phone_snapshot: string | null
  client_email_snapshot: string | null
  client_address_snapshot: string | null
  due_date: string | null
  amountPaid: number
  outstanding: number
  settlementState: 'unpaid' | 'partial' | 'paid' | null
  overdue: boolean
  canManage: boolean
  canIssue: boolean
  canReceivePayment: boolean
  canReversePayment: boolean
  canRefundPayment: boolean
  lines: SaleLine[]
  movements: SaleMovement[]
  payments: PaymentEvent[]
}
type SaleCorrection = {
  id: string
  kind: 'void' | 'full_return'
  effectiveAt: string
  reason: string
  reference: string | null
  refundAmount: number
  restoredQuantity: number
  createdAt: string
  actorProfileId: string
}
type SaleCorrectionState = {
  canCorrect: boolean
  partialReturnsAvailable: false
  correction: SaleCorrection | null
}

const route = useRoute()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId } = useShop()
const { t, locale } = useI18n()
const confirmation = useConfirmation()
const { push: pushToast } = useToasts()
const { sharing: sharingReceipt, shareError, shareReceipt } = useSaleReceiptShare()
const saleId = computed(() => String(route.params.id ?? ''))
const issuing = ref(false)
const actionError = ref('')
const issueRequestId = ref<string | null>(null)
const paymentDialog = ref<'receipt' | 'reversal' | 'refund' | null>(null)
const paymentDialogOpen = computed({
  get: () => paymentDialog.value !== null,
  set: value => { if (!value) paymentDialog.value = null },
})
const selectedPayment = ref<PaymentEvent | null>(null)
const paymentAmount = ref(0)
const paymentDate = ref(new Date().toISOString().slice(0, 10))
const paymentMethod = ref<PaymentMethod>('cash')
const paymentReference = ref('')
const paymentReason = ref('')
const paymentPending = ref(false)
const { dirty: paymentDirty } = useRecordAction(() => ({ amount: paymentAmount.value, date: paymentDate.value, method: paymentMethod.value, reference: paymentReference.value, reason: paymentReason.value }), paymentDialogOpen)
const correctionOpen = ref(false)
const correctionPending = ref(false)
const correctionDate = ref(new Date().toISOString().slice(0, 10))
const correctionReason = ref('')
const correctionReference = ref('')
const correctionRequestId = ref<string | null>(null)
const { dirty: correctionDirty } = useRecordAction(() => ({ date: correctionDate.value, reason: correctionReason.value, reference: correctionReference.value }), correctionOpen)
watch([currentId, currentLocationId, saleId], () => {
  paymentDialog.value = null
  selectedPayment.value = null
  correctionOpen.value = false
  actionError.value = ''
  paymentRequestId.value = null
  correctionRequestId.value = null
})
const paymentRequestId = ref<string | null>(null)
watch([paymentAmount, paymentDate, paymentMethod, paymentReference, paymentReason], () => {
  if (!paymentPending.value) paymentRequestId.value = null
})

const { data: sale, pending, error, refresh } = useAsyncData(
  () => `shop-data:sale:${currentId.value ?? 'none'}:${saleId.value}`,
  async (): Promise<SaleDetail | null> => {
    if (!currentId.value || !currentLocationId.value || !saleId.value) return null
    const { data, error: queryError } = await shopRpc.rpc('get_location_sale', {
      p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_invoice_id: saleId.value,
    })
    if (queryError) throw queryError
    return data as SaleDetail | null
  }, { watch: [currentId, currentLocationId, saleId], default: () => null },
)

const { data: saleTax, pending: taxPending, error: taxError, refresh: refreshTax } = useAsyncData(
 () => `shop-data:sale-tax:${currentId.value}:${currentLocationId.value}:${saleId.value}`,
 async () => {
  if (!currentId.value || !currentLocationId.value || !saleId.value) return null
  const result = await shopRpc.rpc('get_sale_tax_snapshot', { p_shop_id: currentId.value, p_invoice_id: saleId.value })
  if (result.error) throw result.error
  return result.data as (TaxQuote & { orderDiscount?: number }) | null
 }, { watch: [currentId, currentLocationId, saleId], default: () => null },
)
const orderDiscount = ref(0)
const discountAction = useRecordAction(() => orderDiscount.value)
const { visible: discountOpen, dirty: discountDirty } = discountAction
const discountPending = ref(false)
function editOrderDiscount() { orderDiscount.value = Number(saleTax.value?.orderDiscount ?? 0); discountAction.edit() }
async function saveOrderDiscount() {
 if (!currentId.value || !saleId.value || discountPending.value) return
 discountPending.value = true
 try {
  const result = await shopRpc.rpc('set_sale_order_discount', { p_shop_id: currentId.value, p_invoice_id: saleId.value, p_discount: orderDiscount.value })
  if (result.error) throw result.error
  await refreshTax(); discountAction.complete()
 } catch { actionError.value = locale.value === 'ar' ? 'تعذر حفظ الخصم.' : 'Unable to save order discount.' }
 finally { discountPending.value = false }
}
watch([currentId, currentLocationId, saleId], () => discountAction.complete())

const { data: receiptSnapshot, refresh: refreshReceipt } = useAsyncData(
  () => `shop-data:sale-receipt:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${saleId.value}`,
  async (): Promise<SaleReceiptSnapshot | null> => {
    if (!currentId.value || !currentLocationId.value || !saleId.value) return null
    const { data, error: receiptError } = await shopRpc.rpc('get_location_sale_receipt', {
      p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_invoice_id: saleId.value,
    })
    if (receiptError) throw receiptError
    return data as SaleReceiptSnapshot | null
  }, { watch: [currentId, currentLocationId, saleId], default: () => null },
)

const { data: correctionState, pending: correctionLoading, error: correctionLoadError, refresh: refreshCorrection } = useAsyncData(
  () => `shop-data:sale-correction:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${saleId.value}`,
  async (): Promise<SaleCorrectionState | null> => {
    if (!currentId.value || !currentLocationId.value || !saleId.value) return null
    const { data, error: correctionError } = await shopRpc.rpc('sale_correction_state', {
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_invoice_id: saleId.value,
    })
    if (correctionError) throw correctionError
    return data as SaleCorrectionState | null
  }, { watch: [currentId, currentLocationId, saleId], default: () => null },
)

function readableError(message?: string) {
  if (message?.includes('SALE_OPEN_CASH_SHIFT_REQUIRED')) return t('sales.openCashShiftRequired')
  if (message?.includes('INSUFFICIENT_STOCK')) return saleCopy(t, 'sales.insufficientStock', sale.value?.lines ?? [])
  if (message?.includes('OUTSTANDING_SALE_REQUIRES_CUSTOMER')) return t('sales.customerRequired')
  if (message?.includes('PAYMENT_OVERPAYMENT_REJECTED')) return t('payments.overpayment')
  if (message?.includes('PAYMENT_ADJUSTMENT_EXCEEDS_EFFECTIVE_AMOUNT')) return t('payments.adjustmentExceeded')
  if (message?.includes('CUSTOMERLESS_PAYMENT_ADJUSTMENT_DEFERRED')) return t('payments.customerlessDeferred')
  if (message?.includes('SALE_ALREADY_CORRECTED')) return t('saleCorrections.alreadyCorrected')
  if (message?.includes('SALE_CORRECTION_REQUEST_CONFLICT')) return t('saleCorrections.requestConflict')
  if (message?.includes('ACCOUNTING_PERIOD_CLOSED')) return t('saleCorrections.periodClosed')
  if (message?.includes('SHOP_PERMISSION_DENIED')) return t('saleCorrections.denied')
  return t('sales.issueError')
}

function openCorrection() {
  if (!correctionState.value?.canCorrect || correctionPending.value) return
  actionError.value = ''
  correctionDate.value = new Date().toISOString().slice(0, 10)
  correctionReason.value = ''
  correctionReference.value = ''
  correctionRequestId.value = null
  correctionOpen.value = true
}

async function submitCorrection() {
  if (!currentId.value || !currentLocationId.value || !sale.value
    || !correctionState.value?.canCorrect || correctionPending.value
    || correctionReason.value.trim().length < 2) return
  if (!await confirmation.ask(saleCopy(t, 'saleCorrections.confirm', sale.value?.lines ?? []))) return
  correctionPending.value = true
  actionError.value = ''
  correctionRequestId.value ??= crypto.randomUUID()
  try {
    const { error: correctionError } = await shopRpc.rpc('correct_location_sale', {
      p_request_id: correctionRequestId.value,
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_invoice_id: sale.value.id,
      p_effective_at: new Date(`${correctionDate.value}T12:00:00`).toISOString(),
      p_reason: correctionReason.value.trim(),
      p_reference: correctionReference.value.trim() || null,
    })
    if (correctionError) throw correctionError
    correctionRequestId.value = null
    correctionOpen.value = false
    await Promise.all([
      refresh(), refreshCorrection(), refreshReceipt(), refreshTax(),
      refreshNuxtData('shop-data:sales'),
      refreshNuxtData('shop-data:inventory-overview'),
      refreshNuxtData('shop-data:customer-statement'),
      refreshNuxtData('shop-data:cash-shifts'),
    ])
    pushToast({ tone: 'success', title: t('saleCorrections.saved') })
  }
  catch (correctionError) {
    actionError.value = readableError(shopCommandErrorMessage(correctionError))
  }
  finally { correctionPending.value = false }
}

function openReceipt() {
  if (!sale.value?.client_id || sale.value.outstanding <= 0) return
  actionError.value = ''
  selectedPayment.value = null
  paymentAmount.value = Number(sale.value.outstanding)
  paymentDate.value = new Date().toISOString().slice(0, 10)
  paymentMethod.value = 'cash'
  paymentReference.value = ''
  paymentReason.value = ''
  paymentRequestId.value = null
  paymentDialog.value = 'receipt'
}

function openAdjustment(kind: 'reversal' | 'refund', event: PaymentEvent) {
  actionError.value = ''
  selectedPayment.value = event
  paymentAmount.value = Number(event.remainingEffective)
  paymentDate.value = new Date().toISOString().slice(0, 10)
  paymentMethod.value = event.method ?? 'cash'
  paymentReference.value = ''
  paymentReason.value = ''
  paymentRequestId.value = null
  paymentDialog.value = kind
}

async function submitPayment() {
  if (!currentId.value || !currentLocationId.value || !sale.value || !paymentDialog.value || paymentPending.value
    || !Number.isFinite(paymentAmount.value) || paymentAmount.value <= 0) return
  if (paymentDialog.value !== 'receipt' && paymentReason.value.trim().length < 2) {
    actionError.value = t('payments.reasonRequired'); return
  }
  const confirmationKey = paymentDialog.value === 'reversal' ? 'payments.reverseConfirm'
    : paymentDialog.value === 'refund' ? 'payments.refundConfirm' : null
  if (confirmationKey && !await confirmation.ask(t(confirmationKey))) return
  paymentPending.value = true
  actionError.value = ''
  paymentRequestId.value ??= crypto.randomUUID()
  const effectiveAt = new Date(`${paymentDate.value}T12:00:00`).toISOString()
  try {
    let result
    if (paymentDialog.value === 'receipt') {
      result = await shopRpc.rpc('record_location_customer_receipt', {
        p_request_id: paymentRequestId.value, p_shop_id: currentId.value,
        p_location_id: currentLocationId.value,
        p_customer_id: sale.value.client_id!, p_amount: Number(paymentAmount.value),
        p_paid_at: effectiveAt, p_method: paymentMethod.value,
        p_reference: paymentReference.value.trim() || null, p_notes: null,
        p_allocations: [{ invoice_id: sale.value.id, amount: Number(paymentAmount.value) }],
      })
    }
    else if (paymentDialog.value === 'reversal') {
      result = await shopRpc.rpc('reverse_customer_receipt', {
        p_request_id: paymentRequestId.value, p_shop_id: currentId.value,
        p_original_payment_id: selectedPayment.value!.paymentId, p_effective_at: effectiveAt,
        p_reason: paymentReason.value.trim(),
        p_allocations: [{ allocation_id: selectedPayment.value!.allocationId, amount: Number(paymentAmount.value) }],
      })
    }
    else {
      result = await shopRpc.rpc('refund_customer_receipt', {
        p_request_id: paymentRequestId.value, p_shop_id: currentId.value,
        p_original_payment_id: selectedPayment.value!.paymentId, p_effective_at: effectiveAt,
        p_method: paymentMethod.value, p_reference: paymentReference.value.trim() || null,
        p_reason: paymentReason.value.trim(),
        p_allocations: [{ allocation_id: selectedPayment.value!.allocationId, amount: Number(paymentAmount.value) }],
      })
    }
    if (result.error) throw result.error
    paymentRequestId.value = null
    paymentDialog.value = null
    await Promise.all([refresh(), refreshReceipt(), refreshTax(), refreshNuxtData('shop-data:sales'), refreshNuxtData('shop-data:customer-statement')])
    pushToast({ tone: 'success', title: t('payments.saved') })
  }
  catch (paymentError) { actionError.value = readableError(shopCommandErrorMessage(paymentError)) }
  finally { paymentPending.value = false }
}

async function issue() {
  if (!currentId.value || !currentLocationId.value || !sale.value || sale.value.status !== 'draft' || !sale.value.canIssue || taxPending.value || Boolean(taxError.value) || issuing.value) return
  if (!sale.value.client_id) { actionError.value = t('sales.customerRequired'); return }
  if (!await confirmation.ask(saleCopy(t, 'sales.issueConfirm', sale.value?.lines ?? []))) return
  issuing.value = true
  actionError.value = ''
  issueRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('issue_location_sale', {
      p_request_id: issueRequestId.value,
      p_shop_id: currentId.value,
      p_location_id: currentLocationId.value,
      p_invoice_id: sale.value.id,
    })
    if (error) throw error
    issueRequestId.value = null
    await Promise.all([
      refresh(),
      refreshNuxtData('shop-data:sales'),
      refreshNuxtData('shop-data:inventory-overview'),
      refreshNuxtData('shop-data:recent-invoices'),
    ])
    pushToast({ tone: 'success', title: saleCopy(t, 'sales.issuedSuccess', sale.value?.lines ?? []) })
  }
  catch (issueError) { actionError.value = readableError(shopCommandErrorMessage(issueError)) }
  finally { issuing.value = false }
}

function money(value: number) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: sale.value?.status === 'draft' ? businessCurrency.value : sale.value?.currency || businessCurrency.value, maximumFractionDigits: 20 }).format(value)
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

useShopRealtime('sales', () => paymentDirty.value || correctionDirty.value)

const commerceMethods = computed(() => (['cash', 'bank_transfer', 'card', 'wallet', 'cheque', 'other'] as PaymentMethod[]).map(value => ({ value, label: t(`payments.methods.${value}`) })))
const commerceForm = computed<BsCommerceDocumentForm>({ get: () => ({ amount: paymentAmount.value, date: paymentDate.value, method: paymentMethod.value, reference: paymentReference.value, notes: '', reason: paymentReason.value, quantities: {} }), set: value => { paymentAmount.value = value.amount; paymentDate.value = value.date; if (commerceMethods.value.some(method => method.value === value.method)) paymentMethod.value = value.method as PaymentMethod; paymentReference.value = value.reference; paymentReason.value = value.reason } })
const commerceCorrectionForm = computed<BsCommerceCorrectionForm>({ get: () => ({ date: correctionDate.value, reference: correctionReference.value, reason: correctionReason.value }), set: value => { correctionDate.value = value.date; correctionReference.value = value.reference; correctionReason.value = value.reason } })
const commerceCopy = computed<BsCommerceDocumentCopy>(() => ({
  back: t('sales.back'), loading: t('common.loading'), loadError: t('sales.loadError'), retry: t('sales.retry'), notFound: t('sales.notFound'), party: t('sales.customerSnapshot'), date: t('sales.issuedAt'), created: t('sales.createdAt'), notes: t('sales.notes'), total: t('sales.total'), balance: t('payments.outstanding'), discount: t('sales.discount'), paid: t('payments.paid'), due: t('sales.dueDate'), settlement: t('payments.title'), lines: t('sales.lines'), item: t('sales.item'), quantity: t('sales.quantity'), price: t('sales.unitPrice'), available: '', payments: t('payments.history'), credits: '', inventory: t('sales.inventoryTrace'), empty: t('payments.empty'), noInventory: t('sales.noInventoryEffect'), noParty: t('sales.noCustomer'), details: t('sales.details'), batch: t('sales.batch'), open: t('sales.open'), recordPayment: t('payments.recordReceipt'), recordCredit: '', recordReturn: '', reverse: t('payments.reverse'), refund: t('payments.refund'), issue: t('sales.issue'), issuing: t('sales.issuing'), edit: t('sales.editDraft'), reprint: t('receipt.reprint'), share: t('receipt.share'), amount: t('payments.amount'), method: t('payments.method'), reference: t('payments.reference'), reason: t('payments.reason'), save: t('payments.save'), cancel: t('sales.cancel'), correction: t('saleCorrections.title'), correctionLoading: t('saleCorrections.loading'), correctionError: t('saleCorrections.loadError'), refunded: t('saleCorrections.refunded'), restored: t('saleCorrections.restored'), correct: t('saleCorrections.action'), correctionDialog: t('saleCorrections.dialogTitle'), correctionSubmit: t('saleCorrections.submit'),
}))
const commerceView = computed<BsCommerceDocumentView>(() => {
  const value = sale.value
  const correction = correctionState.value?.correction
  const issued = value?.status === 'issued'
  const draft = value?.status === 'draft'
  return {
    loading: pending.value, error: Boolean(error.value), found: Boolean(value), title: value?.invoice_number || t('sales.draftNumber'), subtitle: t('sales.details'), status: value ? t(`sales.${value.status}`) : '', actionError: [actionError.value, shareError.value].filter(Boolean).join(' · '), success: '', notice: [issued ? t('sales.immutable') : t('sales.paymentBoundary'), issued && !value?.client_id ? t('payments.customerlessPaid') : ''].filter(Boolean).join(' '),
    party: { name: value?.client_name_snapshot || '', to: value?.client_id ? `/customers/${value.client_id}` : '', phone: value?.client_phone_snapshot || '—', email: value?.client_email_snapshot || '—', address: value?.client_address_snapshot || '—' },
    amountBreakdown: saleTax.value?.calculationEnabled ? [{ label: locale.value === 'ar' ? 'قبل الضريبة' : 'Before tax', value: money(saleTax.value.net) }, { label: locale.value === 'ar' ? 'الضريبة' : 'Tax', value: money(saleTax.value.tax) }] : [],
    orderDiscount: { label: locale.value === 'ar' ? 'خصم على الطلب' : 'Order discount', canEdit: Boolean(draft && value?.canManage), pending: discountPending.value, dirty: discountDirty.value },
    detail: { date: formatDate(value?.issued_at || null), created: formatDate(value?.created_at || null), notes: value?.notes || '—', total: money(Number(draft && saleTax.value ? saleTax.value.total : value?.total_amount || 0)), balance: money(Number(value?.outstanding || 0)), discount: money(Number(value?.discount_amount || 0)), paid: money(Number(correction ? correction.refundAmount : value?.amountPaid || 0)), due: value?.due_date || '—', settlement: issued ? [correction ? t('payments.settlement.corrected') : t(`payments.settlement.${value?.settlementState}`), value?.overdue && !correction ? t('payments.overdue') : ''].filter(Boolean).join(' · ') : '' },
    showCreated: true, showDiscount: true, showNotes: true, showPaid: Boolean(issued), showDue: Boolean(issued), showAvailable: false, showPayments: Boolean(issued), showCredits: false, inventoryTable: false,
    relatedAction: value ? { label: locale.value === 'ar' ? 'العمولات' : 'Commissions', to: `/commissions?sale=${value.id}` } : undefined,
    canPayment: Boolean(issued && value?.client_id && value.outstanding > 0 && value.canReceivePayment), canCredit: false, canReturn: false, canIssue: Boolean(draft && value?.canIssue && !taxPending.value && !taxError.value), issuing: issuing.value, editTo: draft && value?.canManage ? `/sales?edit=${value.id}` : '', receiptTo: !draft && receiptSnapshot.value && value ? `/sales/${value.id}/receipt` : '', canShare: Boolean(!draft && receiptSnapshot.value), sharing: sharingReceipt.value,
    lines: (value?.lines || []).map(line => ({ id: line.id, name: line.item_name, description: [t(`sales.${line.item_type}`), line.product_sku_snapshot].filter(Boolean).join(' · '), quantity: String(Number(line.quantity)), price: money(Number(line.unit_price)), total: money(Number(line.total_amount)), discount: money(Number(line.discount_amount)), available: '', returnMaximum: 0 })),
    events: (value?.payments || []).map(event => ({ id: event.id, title: `${t(`payments.events.${event.eventType}`)} · ${money(Number(event.amount))}`, description: [formatDate(event.eventAt), event.method ? t(`payments.methods.${event.method}`) : '', event.reference].filter(Boolean).join(' · '), reason: event.reason || '', canReverse: Boolean(event.eventType === 'receipt' && value?.client_id && !correction && event.remainingEffective > 0 && value.canReversePayment), canRefund: Boolean(event.eventType === 'receipt' && value?.client_id && !correction && event.remainingEffective > 0 && value.canRefundPayment) })), credits: [],
    movements: (value?.lines || []).filter(line => line.item_type === 'product').flatMap(line => (value?.movements || []).filter(movement => movement.invoiceItemId === line.id).map(movement => ({ id: movement.id, date: '', name: line.item_name, quantity: String(Math.abs(Number(movement.quantityChange))), cost: '', batch: movement.batchId, to: `/inventory?product=${movement.productId}` }))),
    correction: { visible: Boolean(issued), loading: correctionLoading.value, error: Boolean(correctionLoadError.value), canCorrect: Boolean(issued && correctionState.value?.canCorrect), title: correction ? t(`saleCorrections.kinds.${correction.kind}`) : '', description: correction ? [formatDate(correction.effectiveAt), correction.reference].filter(Boolean).join(' · ') : '', reason: correction?.reason || '', refunded: correction ? money(Number(correction.refundAmount)) : '', restored: correction ? String(Number(correction.restoredQuantity)) : '', notice: correctionState.value ? t(correctionState.value.canCorrect ? 'saleCorrections.available' : 'saleCorrections.readOnly') : '', fullOnly: t('saleCorrections.fullOnly') },
    dialog: { title: paymentDialog.value ? t(`payments.${paymentDialog.value}Title`) : '', dirty: paymentDirty.value, pending: paymentPending.value, maximum: undefined, showAmount: true, showMethod: paymentDialog.value !== 'reversal', showReference: paymentDialog.value !== 'reversal', showNotes: false, showReason: paymentDialog.value !== 'receipt', showQuantities: false, total: '' },
    correctionDialog: { dirty: correctionDirty.value, pending: correctionPending.value, warning: saleCopy(t, 'saleCorrections.warning', value?.lines || []) },
  }
})
function reverseCommerceEvent(id: string) { const event = sale.value?.payments.find(event => event.id === id); if (event) openAdjustment('reversal', event) }
function refundCommerceEvent(id: string) { const event = sale.value?.payments.find(event => event.id === id); if (event) openAdjustment('refund', event) }
function shareCommerceReceipt() { if (receiptSnapshot.value) return shareReceipt(receiptSnapshot.value) }
</script>

<template>
  <BsCommerceDocumentPage v-model:discount-open="discountOpen" v-model:order-discount="orderDiscount" v-model:form="commerceForm" v-model:correction-form="commerceCorrectionForm" v-model:dialog-open="paymentDialogOpen" v-model:correction-open="correctionOpen" :copy="commerceCopy" :view="commerceView" back-to="/sales" inventory-to="" :methods="commerceMethods" :constraints="{ referenceLength: 200, notesLength: 2000, reasonMinimum: 2, reasonMaximum: 1000, amountMinimum: 0.01, amountStep: 0.01, quantityStep: 0.001 }" @edit-order-discount="editOrderDiscount" @save-order-discount="saveOrderDiscount" @retry="refresh(); refreshTax()" @issue="issue" @share="shareCommerceReceipt" @payment="openReceipt" @reverse="reverseCommerceEvent" @refund="refundCommerceEvent" @correct="openCorrection" @retry-correction="refreshCorrection()" @submit="submitPayment" @submit-correction="submitCorrection"/>
</template>

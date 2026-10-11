<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { SaleReceiptSnapshot } from '~/types/receipt'

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
  if (message?.includes('INSUFFICIENT_STOCK')) return t('sales.insufficientStock')
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
  if (!await confirmation.ask(t('saleCorrections.confirm'))) return
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
      refresh(), refreshCorrection(), refreshReceipt(),
      refreshNuxtData('shop-data:sales'),
      refreshNuxtData('shop-data:inventory-overview'),
      refreshNuxtData('shop-data:customer-statement'),
      refreshNuxtData('shop-data:cash-shifts'),
    ])
    pushToast({ tone: 'success', title: t('saleCorrections.saved') })
  }
  catch (correctionError) {
    actionError.value = readableError(correctionError instanceof Error ? correctionError.message : undefined)
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
    await Promise.all([refresh(), refreshReceipt(), refreshNuxtData('shop-data:sales'), refreshNuxtData('shop-data:customer-statement')])
    pushToast({ tone: 'success', title: t('payments.saved') })
  }
  catch (paymentError) { actionError.value = readableError(shopCommandErrorMessage(paymentError)) }
  finally { paymentPending.value = false }
}

async function issue() {
  if (!currentId.value || !currentLocationId.value || !sale.value || sale.value.status !== 'draft' || !sale.value.canIssue || issuing.value) return
  if (!sale.value.client_id) { actionError.value = t('sales.customerRequired'); return }
  if (!await confirmation.ask(t('sales.issueConfirm'))) return
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
    pushToast({ tone: 'success', title: t('sales.issuedSuccess') })
  }
  catch (issueError) { actionError.value = readableError(shopCommandErrorMessage(issueError)) }
  finally { issuing.value = false }
}

function money(value: number) {
  return new Intl.NumberFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(value)
}
function formatDate(value: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
function lineMovements(lineId: string) { return sale.value?.movements.filter(movement => movement.invoiceItemId === lineId) ?? [] }
</script>

<template>
  <BsStack>
    <BsLink to="/sales">{{ t('sales.back') }}</BsLink>
    <BsStack v-if="pending">
      <BsSkeleton/>
      <BsSkeleton/>
    </BsStack>
    <BsBox v-else-if="error" role="alert" padding="md">
      <BsText as="p">{{ t('sales.loadError') }}</BsText>
      <BsButton variant="link" type="button" @click="refresh()">{{ t('sales.retry') }}</BsButton>
    </BsBox>
    <BsPanel v-else-if="!sale" padding="md">{{ t('sales.notFound') }}</BsPanel>
    <template v-else>
      <BsInline justify="between">
        <BsBox>
          <BsInline>
            <BsHeading :level="1">{{ sale.invoice_number || t('sales.draftNumber') }}</BsHeading>
            <BsText as="span">{{ t(`sales.${sale.status}`) }}</BsText>
          </BsInline>
          <BsText as="p" size="sm" tone="muted">{{ t('sales.details') }}</BsText>
        </BsBox>
        <BsInline>
          <template v-if="sale.status === 'draft'">
            <BsLink v-if="sale.canManage" :to="{ path: '/sales', query: { edit: sale.id } }">{{ t('sales.editDraft') }}</BsLink>
            <BsButton v-if="sale.canIssue" type="button" :disabled="issuing" @click="issue">{{ issuing ? t('sales.issuing') : t('sales.issue') }}</BsButton>
          </template>
          <template v-else>
            <BsButton v-if="correctionState?.canCorrect" type="button" severity="danger" :disabled="correctionPending" @click="openCorrection">{{ t('saleCorrections.action') }}</BsButton>
            <template v-if="receiptSnapshot">
              <BsLink :to="`/sales/${sale.id}/receipt`">{{ t('receipt.reprint') }}</BsLink>
              <BsButton type="button" severity="secondary" :pending="sharingReceipt" @click="shareReceipt(receiptSnapshot)">{{ t('receipt.share') }}</BsButton>
            </template>
          </template>
        </BsInline>
      </BsInline>
      <BsText v-if="actionError" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsText v-if="shareError" role="alert" as="p" size="sm" tone="danger">{{ shareError }}</BsText>
      <BsText v-if="sale.status === 'issued'" as="p" size="sm">{{ t('sales.immutable') }}</BsText>
      <BsText v-if="sale.status === 'draft'" as="p" size="sm">{{ t('sales.paymentBoundary') }}</BsText>
      <BsPanel v-if="sale.status === 'issued'" padding="md">
        <BsHeading :level="2">{{ t('saleCorrections.title') }}</BsHeading>
        <BsText v-if="correctionLoading" as="p" size="sm" tone="muted">{{ t('saleCorrections.loading') }}</BsText>
        <BsBox v-else-if="correctionLoadError" role="alert">
          <BsText as="p">{{ t('saleCorrections.loadError') }}</BsText>
          <BsButton type="button" severity="secondary" @click="refreshCorrection()">{{ t('common.retry') }}</BsButton>
        </BsBox>
        <BsBox v-else-if="correctionState?.correction" padding="md">
          <BsText as="p" emphasis="semibold">{{ t(`saleCorrections.kinds.${correctionState.correction.kind}`) }}</BsText>
          <BsText as="p" tone="muted">{{ formatDate(correctionState.correction.effectiveAt) }}<template v-if="correctionState.correction.reference"> · {{ correctionState.correction.reference }}</template>
          </BsText>
          <BsText as="p">{{ correctionState.correction.reason }}</BsText>
          <BsDescriptionList>
            <BsDescriptionItem :term="(t('saleCorrections.refunded'))">
              <BsText as="span">{{ money(Number(correctionState.correction.refundAmount)) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('saleCorrections.restored'))">
              <BsText as="span">{{ Number(correctionState.correction.restoredQuantity) }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsBox>
        <BsText v-else-if="correctionState" as="p" size="sm" tone="muted">{{ t(correctionState.canCorrect ? 'saleCorrections.available' : 'saleCorrections.readOnly') }}</BsText>
        <BsText as="p" size="sm" tone="muted">{{ t('saleCorrections.fullOnly') }}</BsText>
      </BsPanel>
      <BsGrid :columns="2">
        <BsPanel padding="md">
          <BsHeading :level="2">{{ t('sales.customerSnapshot') }}</BsHeading>
          <BsStack v-if="sale.client_name_snapshot">
            <BsText as="p" emphasis="semibold">
              <BsLink v-if="sale.client_id" :to="`/customers/${sale.client_id}`">{{ sale.client_name_snapshot }}</BsLink>
              <template v-else>{{ sale.client_name_snapshot }}</template>
            </BsText>
            <BsText as="p">{{ sale.client_phone_snapshot || '—' }}</BsText>
            <BsText as="p">{{ sale.client_email_snapshot || '—' }}</BsText>
            <BsText as="p">{{ sale.client_address_snapshot || '—' }}</BsText>
          </BsStack>
          <BsText v-else as="p" size="sm" tone="muted">{{ t('sales.noCustomer') }}</BsText>
        </BsPanel>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ t('sales.details') }}</BsHeading>
          <BsDescriptionList>
            <BsDescriptionItem :term="(t('sales.createdAt'))">
              <BsText as="span">{{ formatDate(sale.created_at) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('sales.issuedAt'))">
              <BsText as="span">{{ formatDate(sale.issued_at) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('sales.notes'))">
              <BsText as="span">{{ sale.notes || '—' }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('sales.discount'))">
              <BsText as="span">{{ money(Number(sale.discount_amount)) }}</BsText>
            </BsDescriptionItem>
            <BsDescriptionItem :term="(t('sales.total'))">
              <BsText as="span" size="lg" emphasis="semibold">{{ money(Number(sale.total_amount)) }}</BsText>
            </BsDescriptionItem>
          </BsDescriptionList>
        </BsPanel>
      </BsGrid>
      <BsPanel v-if="sale.status === 'issued'" padding="md">
        <BsInline justify="between">
          <BsBox>
            <BsHeading :level="2">{{ t('payments.title') }}</BsHeading>
            <BsText as="p" size="sm" tone="muted">{{ correctionState?.correction ? t('payments.settlement.corrected') : t(`payments.settlement.${sale.settlementState}`) }}<template v-if="sale.overdue && !correctionState?.correction"> · {{ t('payments.overdue') }}</template>
            </BsText>
          </BsBox>
          <BsButton v-if="sale.client_id && sale.outstanding > 0 && sale.canReceivePayment" type="button" @click="openReceipt">{{ t('payments.recordReceipt') }}</BsButton>
        </BsInline>
        <BsDescriptionList>
          <BsDescriptionItem :term="(t('sales.total'))">
            <BsText as="span" emphasis="semibold">{{ money(Number(sale.total_amount)) }}</BsText>
          </BsDescriptionItem>
          <BsDescriptionItem :term="(t('payments.paid'))">
            <BsText as="span" emphasis="semibold">{{ money(Number(correctionState?.correction ? correctionState.correction.refundAmount : sale.amountPaid)) }}</BsText>
          </BsDescriptionItem>
          <BsDescriptionItem :term="(t('payments.outstanding'))">
            <BsText as="span" emphasis="semibold">{{ money(Number(sale.outstanding)) }}</BsText>
          </BsDescriptionItem>
          <BsDescriptionItem :term="(t('sales.dueDate'))">
            <BsText as="span">{{ sale.due_date || '—' }}</BsText>
          </BsDescriptionItem>
        </BsDescriptionList>
        <BsText v-if="!sale.client_id" as="p" size="sm">{{ t('payments.customerlessPaid') }}</BsText>
        <BsStack>
          <BsHeading :level="3">{{ t('payments.history') }}</BsHeading>
          <BsText v-if="!sale.payments.length" as="p" size="sm" tone="muted">{{ t('payments.empty') }}</BsText>
          <BsInline v-for="event in sale.payments" :key="event.id" justify="between">
            <BsBox>
              <BsText as="p" emphasis="semibold">{{ t(`payments.events.${event.eventType}`) }} · {{ money(Number(event.amount)) }}</BsText>
              <BsText as="p" tone="muted">{{ formatDate(event.eventAt) }}<template v-if="event.method"> · {{ t(`payments.methods.${event.method}`) }}</template>
                <template v-if="event.reference"> · {{ event.reference }}</template>
              </BsText>
              <BsText v-if="event.reason" as="p">{{ event.reason }}</BsText>
            </BsBox>
            <BsInline v-if="event.eventType === 'receipt' && sale.client_id && !correctionState?.correction && event.remainingEffective > 0">
              <BsButton v-if="sale.canReversePayment" type="button" @click="openAdjustment('reversal', event)">{{ t('payments.reverse') }}</BsButton>
              <BsButton v-if="sale.canRefundPayment" type="button" @click="openAdjustment('refund', event)">{{ t('payments.refund') }}</BsButton>
            </BsInline>
          </BsInline>
        </BsStack>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ t('sales.lines') }}</BsHeading>
        <BsBox scroll="x">
          <BsDataTable :value="sale.lines" data-key="id" :columns="[{ key: 'column0', header: (t('sales.item')) }, { key: 'column1', header: (t('sales.quantity')), align: 'end' }, { key: 'column2', header: (t('sales.unitPrice')), align: 'end' }, { key: 'column3', header: (t('sales.discount')), align: 'end' }, { key: 'column4', header: (t('sales.lineTotal')), align: 'end' }]">
            <template #cell-column0="{ row: line }">
              <BsText as="p" emphasis="semibold">{{ line.item_name }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ t(`sales.${line.item_type}`) }}<template v-if="line.product_sku_snapshot"> · {{ line.product_sku_snapshot }}</template>
              </BsText>
            </template>
            <template #cell-column1="{ row: line }">{{ Number(line.quantity) }}</template>
            <template #cell-column2="{ row: line }">{{ money(Number(line.unit_price)) }}</template>
            <template #cell-column3="{ row: line }">{{ money(Number(line.discount_amount)) }}</template>
            <template #cell-column4="{ row: line }">{{ money(Number(line.total_amount)) }}</template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ t('sales.inventoryTrace') }}</BsHeading>
        <BsText v-if="!sale.movements.length" as="p" size="sm" tone="muted">{{ t('sales.noInventoryEffect') }}</BsText>
        <BsStack v-else>
          <template v-for="line in sale.lines.filter(item => item.item_type === 'product')" :key="line.id">
            <BsGrid v-for="movement in lineMovements(line.id)" :key="movement.id" :columns="4">
              <BsText as="p" emphasis="semibold">{{ line.item_name }}</BsText>
              <BsText as="p">
                <BsText as="span" tone="muted">{{ t('sales.movement') }}:</BsText> {{ Math.abs(Number(movement.quantityChange)) }}</BsText>
              <BsText as="p">
                <BsText as="span" tone="muted">{{ t('sales.batch') }}:</BsText> {{ movement.batchId }}</BsText>
              <BsLink :to="`/inventory?product=${movement.productId}`">{{ t('sales.open') }}</BsLink>
            </BsGrid>
          </template>
        </BsStack>
      </BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="paymentDialogOpen" :title="paymentDialog ? t(`payments.${paymentDialog}Title`) : ''" :dirty="paymentDirty" :pending="paymentPending" :error="actionError" :submit-label="t('payments.save')" :cancel-label="t('sales.cancel')" @submit="submitPayment">
      <BsField v-slot="field" :label="(t('payments.amount'))">
        <BsInput :id="field.id" v-model.number="paymentAmount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
      </BsField>
      <BsField v-slot="field" :label="(t('payments.date'))">
        <BsInput :id="field.id" v-model="paymentDate" :aria-describedby="field.describedby" type="date" required/>
      </BsField>
      <BsField v-if="paymentDialog !== 'reversal'" v-slot="field" :label="(t('payments.method'))">
        <BsSelect v-model="paymentMethod" :input-id="field.id" :aria-describedby="field.describedby" :label="t('payments.method')" :options="[...(['cash','bank_transfer','card','wallet','cheque','other']).map(method => ({ value: method, label: (t(`payments.methods.${method}`)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
      </BsField>
      <BsField v-if="paymentDialog !== 'reversal'" v-slot="field" :label="(t('payments.reference'))">
        <BsInput :id="field.id" v-model="paymentReference" :aria-describedby="field.describedby" :maxlength="200"/>
      </BsField>
      <BsField v-if="paymentDialog !== 'receipt'" v-slot="field" :label="(t('payments.reason'))">
        <BsTextarea :id="field.id" v-model="paymentReason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="correctionOpen" :title="t('saleCorrections.dialogTitle')" :dirty="correctionDirty" :pending="correctionPending" :error="actionError" :submit-label="t('saleCorrections.submit')" :cancel-label="t('sales.cancel')" submit-tone="danger" @submit="submitCorrection">
      <BsText as="p" size="sm" tone="warning">{{ t('saleCorrections.warning') }}</BsText>
      <BsField v-slot="field" :label="(t('saleCorrections.date'))">
        <BsInput :id="field.id" v-model="correctionDate" :aria-describedby="field.describedby" type="date" required/>
      </BsField>
      <BsField v-slot="field" :label="(t('saleCorrections.reference'))">
        <BsInput :id="field.id" v-model="correctionReference" :aria-describedby="field.describedby" :maxlength="200"/>
      </BsField>
      <BsField v-slot="field" :label="(t('saleCorrections.reason'))">
        <BsTextarea :id="field.id" v-model="correctionReason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="4"/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>

<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type PaymentMethod = 'cash' | 'bank_transfer' | 'card' | 'wallet' | 'cheque' | 'other'
type PurchaseItem = { id: string; productId: string; productName: string; quantity: number; unitCost: number; totalCost: number; availableToReturn: number; batchId: string | null }
type PaymentEvent = { id: string; eventType: 'payment' | 'reversal'; paymentId: string; allocationId: string; amount: number; eventAt: string; method?: PaymentMethod; reference?: string | null; reason?: string | null; remainingEffective?: number }
type Credit = { id: string; amount: number; effectiveAt: string; reason: string; reference: string | null; purchaseReturnId: string | null }
type PurchaseReturn = { id: string; returnedAt: string; reason: string; reference: string | null; totalAmount: number; items: Array<{ id: string; productId: string; quantity: number; unitCost: number; totalAmount: number; batchId: string }> }
type Movement = { id: string; productId: string; batchId: string; quantityChange: number; unitCostSnapshot: number; createdAt: string; referenceId: string }
type PurchaseDetail = {
  id: string; vendorId: string; vendorNameSnapshot: string; invoiceNumber: string | null
  status: 'posted' | 'void'; issuedAt: string; totalAmount: number; payable: number
  settlementState: 'unpaid' | 'partial' | 'paid'; notes: string | null; createdAt: string
  canManagePurchases: boolean; canRecordPayment: boolean; canReversePayment: boolean
  canRecordCredit: boolean; canReturnStock: boolean; items: PurchaseItem[]
  paymentEvents: PaymentEvent[]; credits: Credit[]; returns: PurchaseReturn[]; receiptMovements: Movement[]
}

const route = useRoute()
const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const captureScope = useShopTaskScope()
const nuxtApp = useNuxtApp()
const { locale } = useI18n()
const { currentId } = useShop()
const purchaseId = computed(() => String(route.params.id ?? ''))
const isArabic = computed(() => locale.value === 'ar')
const actionError = ref('')
const success = ref('')
const paymentOpen = ref(false)
const creditOpen = ref(false)
const returnOpen = ref(false)
const reversalOpen = ref(false)
const pendingAction = ref(false)
const requestId = ref<string | null>(null)
const selectedPayment = ref<PaymentEvent | null>(null)
const paymentMethods: PaymentMethod[] = ['cash', 'bank_transfer', 'card', 'wallet', 'cheque', 'other']

function localToday() { return new Date().toISOString().slice(0, 10) }
const paymentForm = reactive({ amount: 0, date: localToday(), method: 'cash' as PaymentMethod, reference: '', notes: '' })
const creditForm = reactive({ amount: 0, date: localToday(), reason: '', reference: '' })
const returnForm = reactive({ date: localToday(), reason: '', reference: '', quantities: {} as Record<string, number> })
const reversalForm = reactive({ amount: 0, date: localToday(), reason: '', reference: '' })

const { dirty: paymentDirty } = useRecordAction(() => paymentForm, paymentOpen)

const { dirty: creditDirty } = useRecordAction(() => creditForm, creditOpen)

const { dirty: returnDirty } = useRecordAction(() => returnForm, returnOpen)

const { dirty: reversalDirty } = useRecordAction(() => reversalForm, reversalOpen)

const copy = computed(() => isArabic.value ? {
  back: 'العودة إلى المشتريات', title: 'تفاصيل فاتورة المورد', supplier: 'المورد', invoice: 'رقم فاتورة المورد',
  date: 'التاريخ', total: 'الإجمالي', payable: 'المتبقي للدفع', status: 'حالة السداد', unpaid: 'غير مدفوع', partial: 'مدفوع جزئيًا', paid: 'مدفوع',
  lines: 'بنود واستلامات المخزون', product: 'المنتج', quantity: 'الكمية', available: 'متاح للإرجاع', unitCost: 'تكلفة الوحدة',
  payments: 'المدفوعات', payment: 'دفعة', reversal: 'عكس دفعة', credits: 'أرصدة ومرتجعات المورد', returns: 'مرتجعات المخزون', inventory: 'سجل المخزون',
  recordPayment: 'تسجيل دفعة', recordCredit: 'تسجيل رصيد مالي', recordReturn: 'تسجيل مرتجع مخزون', reverse: 'عكس',
  amount: 'المبلغ', method: 'الطريقة', reference: 'المرجع', notes: 'ملاحظات', reason: 'السبب', save: 'حفظ', cancel: 'إلغاء', saving: 'جاري الحفظ…',
  empty: 'لا توجد أحداث بعد.', loading: 'جاري التحميل…', loadError: 'تعذّر تحميل تفاصيل المشتريات.', retry: 'إعادة المحاولة', notFound: 'لم يتم العثور على المشتريات.',
  invalidPayment: 'أدخل مبلغًا صالحًا لا يتجاوز الرصيد المستحق.', invalidCredit: 'أدخل رصيدًا صالحًا وسببًا واضحًا.', invalidReturn: 'اختر كمية متاحة للإرجاع واكتب السبب.', invalidReversal: 'أدخل مبلغ عكس صالحًا وسببًا واضحًا.',
  paymentSaved: 'تم تسجيل دفعة المورد.', creditSaved: 'تم تسجيل رصيد المورد دون حركة مخزون.', returnSaved: 'تم تسجيل المرتجع وخفض المخزون والقيمة مرة واحدة.', reversalSaved: 'تم عكس الدفعة واستعادة الرصيد المستحق.',
  confirmPayment: 'تسجيل دفعة المورد وخفض الرصيد المستحق بالمبلغ المعروض؟', confirmCredit: 'تسجيل رصيد مالي وخفض المستحق دون تحريك المخزون؟', confirmReturn: 'إرجاع الكميات المحددة وخفض المخزون وقيمته ومستحق المورد؟',
  confirmReversal: 'عكس هذا الجزء من الدفعة؟ سيعود إلى الرصيد المستحق مع بقاء الدفعة الأصلية دون تغيير.',
  cash: 'نقدي', bank_transfer: 'تحويل بنكي', card: 'بطاقة', wallet: 'محفظة', cheque: 'شيك', other: 'أخرى',
} : {
  back: 'Back to purchases', title: 'Supplier bill detail', supplier: 'Supplier', invoice: 'Supplier invoice',
  date: 'Date', total: 'Total', payable: 'Remaining payable', status: 'Settlement', unpaid: 'Unpaid', partial: 'Partially paid', paid: 'Paid',
  lines: 'Lines and inventory receipts', product: 'Product', quantity: 'Quantity', available: 'Available to return', unitCost: 'Unit cost',
  payments: 'Payments', payment: 'Payment', reversal: 'Payment reversal', credits: 'Supplier credits and returns', returns: 'Stock returns', inventory: 'Inventory trail',
  recordPayment: 'Record payment', recordCredit: 'Record financial credit', recordReturn: 'Return available stock', reverse: 'Reverse',
  amount: 'Amount', method: 'Method', reference: 'Reference', notes: 'Notes', reason: 'Reason', save: 'Save', cancel: 'Cancel', saving: 'Saving…',
  empty: 'No events yet.', loading: 'Loading…', loadError: 'Could not load purchase details.', retry: 'Retry', notFound: 'Purchase not found.',
  invalidPayment: 'Enter a valid amount that does not exceed the payable.', invalidCredit: 'Enter a valid credit and a clear reason.', invalidReturn: 'Select available quantity to return and enter a reason.', invalidReversal: 'Enter a valid reversal amount and a clear reason.',
  paymentSaved: 'Supplier payment recorded.', creditSaved: 'Supplier credit recorded without stock movement.', returnSaved: 'Return recorded; stock and value were reduced exactly once.', reversalSaved: 'Payment reversed and payable restored.',
  confirmPayment: 'Record the supplier payment and reduce the payable by the amount shown?', confirmCredit: 'Record a financial credit and reduce the payable without moving stock?', confirmReturn: 'Return the selected quantities and reduce stock, inventory value, and supplier payable?',
  confirmReversal: 'Reverse this payment amount? The original payment remains immutable and the payable will be restored.',
  cash: 'Cash', bank_transfer: 'Bank transfer', card: 'Card', wallet: 'Wallet', cheque: 'Cheque', other: 'Other',
})

const { data: purchase, pending, error, refresh } = useAsyncData(
  () => `shop-data:purchase:${currentId.value ?? 'none'}:${purchaseId.value}`,
  async (): Promise<PurchaseDetail | null> => {
    if (!currentId.value || !purchaseId.value) return null
    const { data, error } = await shopRpc.rpc('get_purchase', { p_shop_id: currentId.value, p_purchase_id: purchaseId.value })
    if (error) throw error
    return data as PurchaseDetail | null
  }, { watch: [currentId, purchaseId], default: () => null },
)

watch([paymentForm, creditForm, returnForm, reversalForm], () => { if (!pendingAction.value) requestId.value = null }, { deep: true })

function money(value: number) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value)) }
function displayDate(value: string) { return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function eventLabel(event: PaymentEvent) { return event.eventType === 'payment' ? copy.value.payment : copy.value.reversal }
function methodLabel(method: PaymentMethod) { return copy.value[method] }
function settlementLabel(state: PurchaseDetail['settlementState']) { return copy.value[state] }
function hasCentPrecision(value: number) { return Math.abs(Math.round(value * 100) - value * 100) < 0.000001 }
function readableError(value: unknown) {
  const message = value instanceof Error ? value.message : ''
  if (message.includes('OVERPAYMENT') || message.includes('EXCEEDS_PAYABLE')) return copy.value.invalidPayment
  if (message.includes('STOCK_UNAVAILABLE')) return copy.value.invalidReturn
  if (message.includes('ACCOUNTING_PERIOD_CLOSED')) return isArabic.value ? 'الفترة المحاسبية مغلقة.' : 'The accounting period is closed.'
  if (message.includes('SHOP_PERMISSION_DENIED')) return isArabic.value ? 'ليست لديك صلاحية تنفيذ هذا الإجراء.' : 'You do not have permission for this action.'
  return copy.value.loadError
}
function effectiveAt(date: string) { return new Date(`${date}T12:00:00`).toISOString() }
async function finish(message: string) {
  paymentOpen.value = creditOpen.value = returnOpen.value = reversalOpen.value = false
  requestId.value = null
  await Promise.all([refresh(), refreshNuxtData(Object.keys(nuxtApp.payload.data).filter(key => key.startsWith('shop-data:purchases:')))])
  success.value = message
}

function openPayment() { if (!purchase.value) return; Object.assign(paymentForm, { amount: Number(purchase.value.payable), date: localToday(), method: 'cash', reference: '', notes: '' }); actionError.value = ''; success.value = ''; paymentOpen.value = true }
async function savePayment() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const amount = Number(paymentForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(purchase.value.payable) || !hasCentPrecision(amount)) { actionError.value = copy.value.invalidPayment; return }
  const inScope = captureScope()
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${copy.value.confirmPayment} ${money(amount)}`) || !inScope()) return
    const { error } = await shopRpc.rpc('record_supplier_payment', { p_request_id: requestId.value, p_shop_id: currentId.value, p_vendor_id: purchase.value.vendorId, p_amount: amount, p_paid_at: effectiveAt(paymentForm.date), p_method: paymentForm.method, p_reference: paymentForm.reference.trim() || null, p_notes: paymentForm.notes.trim() || null, p_allocations: [{ vendor_invoice_id: purchase.value.id, amount }] })
    if (!inScope()) return
    if (error) throw error
    await finish(copy.value.paymentSaved)
  } catch (error) { if (inScope()) actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openCredit() { if (!purchase.value) return; Object.assign(creditForm, { amount: Number(purchase.value.payable), date: localToday(), reason: '', reference: '' }); actionError.value = ''; success.value = ''; creditOpen.value = true }
async function saveCredit() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const amount = Number(creditForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(purchase.value.payable) || !hasCentPrecision(amount) || creditForm.reason.trim().length < 2) { actionError.value = copy.value.invalidCredit; return }
  const inScope = captureScope()
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${copy.value.confirmCredit} ${money(amount)}`) || !inScope()) return
    const { error } = await shopRpc.rpc('record_supplier_credit', { p_request_id: requestId.value, p_shop_id: currentId.value, p_vendor_id: purchase.value.vendorId, p_purchase_id: purchase.value.id, p_amount: amount, p_effective_at: effectiveAt(creditForm.date), p_reason: creditForm.reason.trim(), p_reference: creditForm.reference.trim() || null })
    if (!inScope()) return
    if (error) throw error
    await finish(copy.value.creditSaved)
  } catch (error) { if (inScope()) actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openReturn() { if (!purchase.value) return; Object.assign(returnForm, { date: localToday(), reason: '', reference: '', quantities: {} }); actionError.value = ''; success.value = ''; returnOpen.value = true }
const returnTotal = computed(() => purchase.value?.items.reduce((total, item) => total + Number(returnForm.quantities[item.id] || 0) * Number(item.unitCost), 0) ?? 0)
async function saveReturn() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const items = purchase.value.items.flatMap(item => { const quantity = Number(returnForm.quantities[item.id] || 0); return quantity > 0 ? [{ vendor_invoice_item_id: item.id, quantity }] : [] })
  if (!items.length || returnForm.reason.trim().length < 2 || returnTotal.value > Number(purchase.value.payable) || items.some(entry => { const item = purchase.value!.items.find(value => value.id === entry.vendor_invoice_item_id)!; return entry.quantity > Number(item.availableToReturn) || Math.round(entry.quantity * 1000) !== entry.quantity * 1000 })) { actionError.value = copy.value.invalidReturn; return }
  const inScope = captureScope()
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${copy.value.confirmReturn} ${money(returnTotal.value)}`) || !inScope()) return
    const { error } = await shopRpc.rpc('record_purchase_return', { p_request_id: requestId.value, p_shop_id: currentId.value, p_purchase_id: purchase.value.id, p_returned_at: effectiveAt(returnForm.date), p_reason: returnForm.reason.trim(), p_reference: returnForm.reference.trim() || null, p_items: items })
    if (!inScope()) return
    if (error) throw error
    await finish(copy.value.returnSaved)
  } catch (error) { if (inScope()) actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openReversal(event: PaymentEvent) { selectedPayment.value = event; Object.assign(reversalForm, { amount: Number(event.remainingEffective ?? 0), date: localToday(), reason: '', reference: '' }); actionError.value = ''; success.value = ''; reversalOpen.value = true }
async function saveReversal() {
  if (!currentId.value || !purchase.value || !selectedPayment.value || pendingAction.value) return
  const amount = Number(reversalForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selectedPayment.value.remainingEffective ?? 0) || !hasCentPrecision(amount) || reversalForm.reason.trim().length < 2) { actionError.value = copy.value.invalidReversal; return }
  const inScope = captureScope()
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${copy.value.confirmReversal} ${money(amount)}`) || !inScope()) return
    const { error } = await shopRpc.rpc('reverse_supplier_payment', { p_request_id: requestId.value, p_shop_id: currentId.value, p_original_payment_id: selectedPayment.value.paymentId, p_effective_at: effectiveAt(reversalForm.date), p_reason: reversalForm.reason.trim(), p_reference: reversalForm.reference.trim() || null, p_allocations: [{ allocation_id: selectedPayment.value.allocationId, amount }] })
    if (!inScope()) return
    if (error) throw error
    await finish(copy.value.reversalSaved)
  } catch (error) { if (inScope()) actionError.value = readableError(error) } finally { pendingAction.value = false }
}
</script>

<template>
  <BsStack>
    <BsLink to="/purchases">{{ copy.back }}</BsLink>
    <BsText v-if="pending" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
    <BsBox v-else-if="error" role="alert" padding="md">
      <BsText as="p">{{ copy.loadError }}</BsText>
      <BsButton @click="refresh()">{{ copy.retry }}</BsButton>
    </BsBox>
    <BsText v-else-if="!purchase" as="p" size="sm" tone="muted">{{ copy.notFound }}</BsText>
    <template v-else>
      <BsPageHeader  :title="copy.title">
        <template #actions>
          <BsInline v-if="purchase.status === 'posted' && Number(purchase.payable) > 0">
            <BsButton v-if="purchase.canRecordPayment" @click="openPayment">{{ copy.recordPayment }}</BsButton>
            <BsButton v-if="purchase.canRecordCredit" @click="openCredit">{{ copy.recordCredit }}</BsButton>
            <BsButton v-if="purchase.canReturnStock && purchase.items.some(item => Number(item.availableToReturn) > 0)" @click="openReturn">{{ copy.recordReturn }}</BsButton>
          </BsInline>
        </template>
      </BsPageHeader>
      <BsText v-if="success" role="status" as="p" size="sm">{{ success }}</BsText>
      <BsText v-if="actionError && !paymentOpen && !creditOpen && !returnOpen && !reversalOpen" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsPanel padding="md">
        <BsBox>
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.supplier }}</BsText>
          <BsText as="p" emphasis="semibold">{{ purchase.vendorNameSnapshot }}</BsText>
        </BsBox>
        <BsBox>
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.date }}</BsText>
          <BsText as="p">{{ displayDate(purchase.issuedAt) }}</BsText>
        </BsBox>
        <BsBox>
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.total }}</BsText>
          <BsText as="p" emphasis="semibold">{{ money(purchase.totalAmount) }}</BsText>
        </BsBox>
        <BsBox>
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.payable }}</BsText>
          <BsText as="p" size="lg" emphasis="semibold">{{ money(purchase.payable) }}</BsText>
        </BsBox>
        <BsBox>
          <BsText as="p" size="xs" tone="muted" emphasis="semibold">{{ copy.status }}</BsText>
          <BsText as="p" emphasis="semibold">{{ settlementLabel(purchase.settlementState) }}</BsText>
        </BsBox>
      </BsPanel>
      <BsPanel padding="md">
        <BsHeading :level="2">{{ copy.lines }}</BsHeading>
        <BsBox scroll="x">
          <BsDataTable :value="purchase.items" data-key="id" :columns="[{ key: 'column0', header: (copy.product) }, { key: 'column1', header: (copy.quantity), align: 'end' }, { key: 'column2', header: (copy.available), align: 'end' }, { key: 'column3', header: (copy.unitCost), align: 'end' }, { key: 'column4', header: (copy.total), align: 'end' }]">
            <template #cell-column0="{ row: item }">{{ item.productName }}</template>
            <template #cell-column1="{ row: item }">{{ item.quantity }}</template>
            <template #cell-column2="{ row: item }">{{ item.availableToReturn }}</template>
            <template #cell-column3="{ row: item }">{{ money(item.unitCost) }}</template>
            <template #cell-column4="{ row: item }">{{ money(item.totalCost) }}</template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsGrid :columns="2">
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.payments }}</BsHeading>
          <BsStack>
            <BsText v-if="!purchase.paymentEvents.length" as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
            <BsInline v-for="event in purchase.paymentEvents" :key="event.id" justify="between">
              <BsBox>
                <BsText as="p" emphasis="semibold">{{ eventLabel(event) }} · {{ money(event.amount) }}</BsText>
                <BsText as="p" size="xs" tone="muted">{{ displayDate(event.eventAt) }}<BsText v-if="event.method" as="span"> · {{ methodLabel(event.method) }}</BsText>
                  <BsText v-if="event.reference" as="span"> · {{ event.reference }}</BsText>
                </BsText>
                <BsText v-if="event.reason" as="p" size="sm">{{ event.reason }}</BsText>
              </BsBox>
              <BsButton v-if="event.eventType === 'payment' && purchase.canReversePayment && Number(event.remainingEffective) > 0" @click="openReversal(event)">{{ copy.reverse }}</BsButton>
            </BsInline>
          </BsStack>
        </BsPanel>
        <BsPanel padding="md">
          <BsHeading :level="2">{{ copy.credits }}</BsHeading>
          <BsStack>
            <BsText v-if="!purchase.credits.length" as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
            <BsBox v-for="credit in purchase.credits" :key="credit.id" as="article">
              <BsText as="p" emphasis="semibold">{{ money(credit.amount) }} · {{ credit.purchaseReturnId ? copy.returns : copy.recordCredit }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ displayDate(credit.effectiveAt) }}<BsText v-if="credit.reference" as="span"> · {{ credit.reference }}</BsText>
              </BsText>
              <BsText as="p" size="sm">{{ credit.reason }}</BsText>
            </BsBox>
          </BsStack>
        </BsPanel>
      </BsGrid>
      <BsPanel padding="md">
        <BsInline justify="between">
          <BsHeading :level="2">{{ copy.inventory }}</BsHeading>
          <BsLink to="/inventory">{{ copy.inventory }}</BsLink>
        </BsInline>
        <BsBox scroll="x">
          <BsDataTable :value="purchase.receiptMovements" data-key="id" :columns="[{ key: 'column0', header: (copy.date) }, { key: 'column1', header: (copy.product) }, { key: 'column2', header: (copy.quantity), align: 'end' }, { key: 'column3', header: (copy.unitCost), align: 'end' }]">
            <template #cell-column0="{ row: movement }">{{ displayDate(movement.createdAt) }}</template>
            <template #cell-column1="{ row: movement }">{{ purchase.items.find(item => item.productId === movement.productId)?.productName || '—' }}</template>
            <template #cell-column2="{ row: movement }">{{ movement.quantityChange }}</template>
            <template #cell-column3="{ row: movement }">{{ money(movement.unitCostSnapshot) }}</template>
            <template #empty>
              <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
            </template>
          </BsDataTable>
        </BsBox>
      </BsPanel>
      <BsRecordActionDialog v-model:visible="paymentOpen" :title="copy.recordPayment" :dirty="paymentDirty" :pending="pendingAction" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="savePayment">
        <BsField v-slot="field" :label="copy.amount">
          <BsInput :id="field.id" v-model.number="paymentForm.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :max="purchase.payable" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.date">
          <BsInput :id="field.id" v-model="paymentForm.date" :aria-describedby="field.describedby" type="date" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.method">
          <BsSelect v-model="paymentForm.method" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.method" :options="[...(paymentMethods).map(method => ({ value: method, label: (methodLabel(method)), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsField v-slot="field" :label="copy.reference">
          <BsInput :id="field.id" v-model="paymentForm.reference" :aria-describedby="field.describedby" :maxlength="200"/>
        </BsField>
        <BsField v-slot="field" :label="copy.notes">
          <BsTextarea :id="field.id" v-model="paymentForm.notes" :aria-describedby="field.describedby" :maxlength="2000" :rows="2"/>
        </BsField>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="creditOpen" :title="copy.recordCredit" :dirty="creditDirty" :pending="pendingAction" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="saveCredit">
        <BsField v-slot="field" :label="copy.amount">
          <BsInput :id="field.id" v-model.number="creditForm.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :max="purchase.payable" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.date">
          <BsInput :id="field.id" v-model="creditForm.date" :aria-describedby="field.describedby" type="date" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.reason">
          <BsTextarea :id="field.id" v-model="creditForm.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="2"/>
        </BsField>
        <BsField v-slot="field" :label="copy.reference">
          <BsInput :id="field.id" v-model="creditForm.reference" :aria-describedby="field.describedby" :maxlength="200"/>
        </BsField>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="returnOpen" :title="copy.recordReturn" :dirty="returnDirty" :pending="pendingAction" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="saveReturn">
        <BsGrid v-for="item in purchase.items" :key="item.id" :columns="1">
          <BsBox>
            <BsText as="p" emphasis="semibold">{{ item.productName }}</BsText>
            <BsText as="p" size="xs" tone="muted">{{ copy.available }}: {{ item.availableToReturn }} · {{ copy.unitCost }}: {{ money(item.unitCost) }}</BsText>
          </BsBox>
          <BsField v-slot="field" :label="copy.quantity">
            <BsInput :id="field.id" v-model.number="returnForm.quantities[item.id]" :aria-describedby="field.describedby" type="number" :min="0" :max="item.availableToReturn" :step="0.001"/>
          </BsField>
        </BsGrid>
        <BsGrid :columns="2">
          <BsField v-slot="field" :label="copy.date">
            <BsInput :id="field.id" v-model="returnForm.date" :aria-describedby="field.describedby" type="date" required/>
          </BsField>
          <BsField v-slot="field" :label="copy.reference">
            <BsInput :id="field.id" v-model="returnForm.reference" :aria-describedby="field.describedby" :maxlength="200"/>
          </BsField>
          <BsField v-slot="field" :label="copy.reason">
            <BsTextarea :id="field.id" v-model="returnForm.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="2"/>
          </BsField>
        </BsGrid>
        <BsText as="p" size="lg" emphasis="semibold">{{ copy.total }}: {{ money(returnTotal) }}</BsText>
      </BsRecordActionDialog>
      <BsRecordActionDialog v-model:visible="reversalOpen" :title="copy.reversal" :dirty="reversalDirty" :pending="pendingAction" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="saveReversal">
        <BsField v-slot="field" :label="copy.amount">
          <BsInput :id="field.id" v-model.number="reversalForm.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :max="selectedPayment?.remainingEffective" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.date">
          <BsInput :id="field.id" v-model="reversalForm.date" :aria-describedby="field.describedby" type="date" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.reason">
          <BsTextarea :id="field.id" v-model="reversalForm.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="2"/>
        </BsField>
        <BsField v-slot="field" :label="copy.reference">
          <BsInput :id="field.id" v-model="reversalForm.reference" :aria-describedby="field.describedby" :maxlength="200"/>
        </BsField>
      </BsRecordActionDialog>
    </template>
  </BsStack>
</template>

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
  return message || copy.value.loadError
}
function effectiveAt(date: string) { return new Date(`${date}T12:00:00`).toISOString() }
async function finish(message: string) {
  paymentOpen.value = creditOpen.value = returnOpen.value = reversalOpen.value = false
  requestId.value = null
  await Promise.all([refresh(), refreshNuxtData('shop-data:purchases')])
  success.value = message
}

function openPayment() { if (!purchase.value) return; Object.assign(paymentForm, { amount: Number(purchase.value.payable), date: localToday(), method: 'cash', reference: '', notes: '' }); actionError.value = ''; success.value = ''; paymentOpen.value = true }
async function savePayment() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const amount = Number(paymentForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(purchase.value.payable) || !hasCentPrecision(amount)) { actionError.value = copy.value.invalidPayment; return }
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('record_supplier_payment', { p_request_id: requestId.value, p_shop_id: currentId.value, p_vendor_id: purchase.value.vendorId, p_amount: amount, p_paid_at: effectiveAt(paymentForm.date), p_method: paymentForm.method, p_reference: paymentForm.reference.trim() || null, p_notes: paymentForm.notes.trim() || null, p_allocations: [{ vendor_invoice_id: purchase.value.id, amount }] })
    if (error) throw error
    await finish(copy.value.paymentSaved)
  } catch (error) { actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openCredit() { if (!purchase.value) return; Object.assign(creditForm, { amount: Number(purchase.value.payable), date: localToday(), reason: '', reference: '' }); actionError.value = ''; success.value = ''; creditOpen.value = true }
async function saveCredit() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const amount = Number(creditForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(purchase.value.payable) || !hasCentPrecision(amount) || creditForm.reason.trim().length < 2) { actionError.value = copy.value.invalidCredit; return }
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('record_supplier_credit', { p_request_id: requestId.value, p_shop_id: currentId.value, p_vendor_id: purchase.value.vendorId, p_purchase_id: purchase.value.id, p_amount: amount, p_effective_at: effectiveAt(creditForm.date), p_reason: creditForm.reason.trim(), p_reference: creditForm.reference.trim() || null })
    if (error) throw error
    await finish(copy.value.creditSaved)
  } catch (error) { actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openReturn() { if (!purchase.value) return; Object.assign(returnForm, { date: localToday(), reason: '', reference: '', quantities: {} }); actionError.value = ''; success.value = ''; returnOpen.value = true }
const returnTotal = computed(() => purchase.value?.items.reduce((total, item) => total + Number(returnForm.quantities[item.id] || 0) * Number(item.unitCost), 0) ?? 0)
async function saveReturn() {
  if (!currentId.value || !purchase.value || pendingAction.value) return
  const items = purchase.value.items.flatMap(item => { const quantity = Number(returnForm.quantities[item.id] || 0); return quantity > 0 ? [{ vendor_invoice_item_id: item.id, quantity }] : [] })
  if (!items.length || returnForm.reason.trim().length < 2 || returnTotal.value > Number(purchase.value.payable) || items.some(entry => { const item = purchase.value!.items.find(value => value.id === entry.vendor_invoice_item_id)!; return entry.quantity > Number(item.availableToReturn) || Math.round(entry.quantity * 1000) !== entry.quantity * 1000 })) { actionError.value = copy.value.invalidReturn; return }
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('record_purchase_return', { p_request_id: requestId.value, p_shop_id: currentId.value, p_purchase_id: purchase.value.id, p_returned_at: effectiveAt(returnForm.date), p_reason: returnForm.reason.trim(), p_reference: returnForm.reference.trim() || null, p_items: items })
    if (error) throw error
    await finish(copy.value.returnSaved)
  } catch (error) { actionError.value = readableError(error) } finally { pendingAction.value = false }
}

function openReversal(event: PaymentEvent) { selectedPayment.value = event; Object.assign(reversalForm, { amount: Number(event.remainingEffective ?? 0), date: localToday(), reason: '', reference: '' }); actionError.value = ''; success.value = ''; reversalOpen.value = true }
async function saveReversal() {
  if (!currentId.value || !purchase.value || !selectedPayment.value || pendingAction.value) return
  const amount = Number(reversalForm.amount)
  if (!Number.isFinite(amount) || amount <= 0 || amount > Number(selectedPayment.value.remainingEffective ?? 0) || !hasCentPrecision(amount) || reversalForm.reason.trim().length < 2) { actionError.value = copy.value.invalidReversal; return }
  if (!await confirmation.ask(copy.value.confirmReversal)) return
  pendingAction.value = true; actionError.value = ''; requestId.value ??= crypto.randomUUID()
  try {
    const { error } = await shopRpc.rpc('reverse_supplier_payment', { p_request_id: requestId.value, p_shop_id: currentId.value, p_original_payment_id: selectedPayment.value.paymentId, p_effective_at: effectiveAt(reversalForm.date), p_reason: reversalForm.reason.trim(), p_reference: reversalForm.reference.trim() || null, p_allocations: [{ allocation_id: selectedPayment.value.allocationId, amount }] })
    if (error) throw error
    await finish(copy.value.reversalSaved)
  } catch (error) { actionError.value = readableError(error) } finally { pendingAction.value = false }
}
</script>

<template>
  <div class="space-y-6">
    <NuxtLink to="/purchases" class="inline-flex font-semibold text-[var(--bs-link)] underline-offset-4 hover:underline">{{ copy.back }}</NuxtLink>
    <p v-if="pending" class="rounded-2xl border border-border bg-card p-8 text-sm text-muted-foreground">{{ copy.loading }}</p>
    <div v-else-if="error" role="alert" class="rounded-2xl bg-[var(--bs-status-error-bg)] p-5 text-sm text-[var(--bs-status-error)]"><p>{{ copy.loadError }}</p><button class="mt-2 font-bold underline" @click="refresh()">{{ copy.retry }}</button></div>
    <p v-else-if="!purchase" class="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{{ copy.notFound }}</p>
    <template v-else>
      <header class="flex flex-wrap items-end justify-between gap-4"><div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ purchase.vendorNameSnapshot }} · {{ purchase.invoiceNumber || '—' }}</p></div><div v-if="purchase.status === 'posted' && Number(purchase.payable) > 0" class="flex flex-wrap gap-2"><button v-if="purchase.canRecordPayment" class="ls-btn ls-btn-primary" @click="openPayment">{{ copy.recordPayment }}</button><button v-if="purchase.canRecordCredit" class="ls-btn" @click="openCredit">{{ copy.recordCredit }}</button><button v-if="purchase.canReturnStock && purchase.items.some(item => Number(item.availableToReturn) > 0)" class="ls-btn" @click="openReturn">{{ copy.recordReturn }}</button></div></header>
      <p v-if="success" role="status" class="rounded-xl bg-[var(--bs-status-success-bg)] p-4 text-sm text-[var(--bs-status-success)]">{{ success }}</p>
      <p v-if="actionError && !paymentOpen && !creditOpen && !returnOpen && !reversalOpen" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-4 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>

      <section class="grid gap-4 rounded-2xl border border-border bg-card p-5 sm:grid-cols-2 lg:grid-cols-5"><div><p class="text-xs font-bold uppercase text-muted-foreground">{{ copy.supplier }}</p><p class="mt-1 font-bold">{{ purchase.vendorNameSnapshot }}</p></div><div><p class="text-xs font-bold uppercase text-muted-foreground">{{ copy.date }}</p><p class="mt-1">{{ displayDate(purchase.issuedAt) }}</p></div><div><p class="text-xs font-bold uppercase text-muted-foreground">{{ copy.total }}</p><p class="mt-1 font-bold">{{ money(purchase.totalAmount) }}</p></div><div><p class="text-xs font-bold uppercase text-muted-foreground">{{ copy.payable }}</p><p class="mt-1 text-xl font-extrabold">{{ money(purchase.payable) }}</p></div><div><p class="text-xs font-bold uppercase text-muted-foreground">{{ copy.status }}</p><p class="mt-1 font-bold">{{ settlementLabel(purchase.settlementState) }}</p></div></section>

      <section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ copy.lines }}</h2><div class="mt-4 overflow-x-auto"><BsDataTable :value="purchase.items" data-key="id" :row-class="() => 'border-t border-border'"><Column header-class="px-3 py-3 text-start" body-class="px-3 py-3 font-bold"><template #header>{{ copy.product }}</template><template #body="{ data: item }">{{ item.productName }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end"><template #header>{{ copy.quantity }}</template><template #body="{ data: item }">{{ item.quantity }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end"><template #header>{{ copy.available }}</template><template #body="{ data: item }">{{ item.availableToReturn }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end"><template #header>{{ copy.unitCost }}</template><template #body="{ data: item }">{{ money(item.unitCost) }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end font-bold"><template #header>{{ copy.total }}</template><template #body="{ data: item }">{{ money(item.totalCost) }}</template></Column></BsDataTable></div></section>

      <div class="grid gap-5 xl:grid-cols-2"><section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ copy.payments }}</h2><div class="mt-4 space-y-3"><p v-if="!purchase.paymentEvents.length" class="text-sm text-muted-foreground">{{ copy.empty }}</p><article v-for="event in purchase.paymentEvents" :key="event.id" class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"><div><p class="font-bold">{{ eventLabel(event) }} · {{ money(event.amount) }}</p><p class="text-xs text-muted-foreground">{{ displayDate(event.eventAt) }}<span v-if="event.method"> · {{ methodLabel(event.method) }}</span><span v-if="event.reference"> · {{ event.reference }}</span></p><p v-if="event.reason" class="mt-1 text-sm">{{ event.reason }}</p></div><button v-if="event.eventType === 'payment' && purchase.canReversePayment && Number(event.remainingEffective) > 0" class="ls-btn ls-btn-sm" @click="openReversal(event)">{{ copy.reverse }}</button></article></div></section><section class="rounded-2xl border border-border bg-card p-5"><h2 class="text-lg font-bold">{{ copy.credits }}</h2><div class="mt-4 space-y-3"><p v-if="!purchase.credits.length" class="text-sm text-muted-foreground">{{ copy.empty }}</p><article v-for="credit in purchase.credits" :key="credit.id" class="rounded-xl border border-border p-3"><p class="font-bold">{{ money(credit.amount) }} · {{ credit.purchaseReturnId ? copy.returns : copy.recordCredit }}</p><p class="text-xs text-muted-foreground">{{ displayDate(credit.effectiveAt) }}<span v-if="credit.reference"> · {{ credit.reference }}</span></p><p class="mt-1 text-sm">{{ credit.reason }}</p></article></div></section></div>

      <section class="rounded-2xl border border-border bg-card p-5"><div class="flex items-center justify-between gap-3"><h2 class="text-lg font-bold">{{ copy.inventory }}</h2><NuxtLink to="/inventory" class="font-bold text-[var(--bs-link)] underline">{{ copy.inventory }}</NuxtLink></div><div class="mt-4 overflow-x-auto"><BsDataTable :value="purchase.receiptMovements" data-key="id" :row-class="() => 'border-t border-border'"><Column header-class="px-3 py-3 text-start" body-class="px-3 py-3"><template #header>{{ copy.date }}</template><template #body="{ data: movement }">{{ displayDate(movement.createdAt) }}</template></Column><Column header-class="px-3 py-3 text-start" body-class="px-3 py-3"><template #header>{{ copy.product }}</template><template #body="{ data: movement }">{{ purchase.items.find(item => item.productId === movement.productId)?.productName || '—' }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end font-bold"><template #header>{{ copy.quantity }}</template><template #body="{ data: movement }">{{ movement.quantityChange }}</template></Column><Column header-class="px-3 py-3 text-end" body-class="px-3 py-3 text-end"><template #header>{{ copy.unitCost }}</template><template #body="{ data: movement }">{{ money(movement.unitCostSnapshot) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div></section>

      <BsDialog v-model:visible="paymentOpen" :title="copy.recordPayment" :dirty="true" :pending="pendingAction"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="savePayment"><p v-if="actionError" role="alert" class="sm:col-span-2 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p><label class="space-y-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="paymentForm.amount" class="ls-input" type="number" min="0.01" :max="purchase.payable" step="0.01" required></label><label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="paymentForm.date" class="ls-input" type="date" required></label><label class="space-y-2 text-sm font-bold">{{ copy.method }}<select v-model="paymentForm.method" class="ls-input"><option v-for="method in paymentMethods" :key="method" :value="method">{{ methodLabel(method) }}</option></select></label><label class="space-y-2 text-sm font-bold">{{ copy.reference }}<input v-model="paymentForm.reference" class="ls-input" maxlength="200"></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.notes }}<textarea v-model="paymentForm.notes" class="ls-input" maxlength="2000" rows="2" /></label><div class="flex gap-2 sm:col-span-2"><button class="ls-btn ls-btn-primary" :disabled="pendingAction">{{ pendingAction ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="pendingAction" @click="close">{{ copy.cancel }}</button></div></form></template></BsDialog>
      <BsDialog v-model:visible="creditOpen" :title="copy.recordCredit" :dirty="true" :pending="pendingAction"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveCredit"><p v-if="actionError" role="alert" class="sm:col-span-2 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p><label class="space-y-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="creditForm.amount" class="ls-input" type="number" min="0.01" :max="purchase.payable" step="0.01" required></label><label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="creditForm.date" class="ls-input" type="date" required></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.reason }}<textarea v-model="creditForm.reason" class="ls-input" minlength="2" maxlength="1000" required rows="2" /></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.reference }}<input v-model="creditForm.reference" class="ls-input" maxlength="200"></label><div class="flex gap-2 sm:col-span-2"><button class="ls-btn ls-btn-primary" :disabled="pendingAction">{{ pendingAction ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="pendingAction" @click="close">{{ copy.cancel }}</button></div></form></template></BsDialog>
      <BsDialog v-model:visible="returnOpen" :title="copy.recordReturn" :dirty="true" :pending="pendingAction"><template #default="{ close }"><form class="space-y-4" @submit.prevent="saveReturn"><p v-if="actionError" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p><div v-for="item in purchase.items" :key="item.id" class="grid items-end gap-3 rounded-xl border border-border p-3 sm:grid-cols-[1fr_10rem]"><div><p class="font-bold">{{ item.productName }}</p><p class="text-xs text-muted-foreground">{{ copy.available }}: {{ item.availableToReturn }} · {{ copy.unitCost }}: {{ money(item.unitCost) }}</p></div><label class="space-y-2 text-sm font-bold">{{ copy.quantity }}<input v-model.number="returnForm.quantities[item.id]" class="ls-input" type="number" min="0" :max="item.availableToReturn" step="0.001"></label></div><div class="grid gap-4 sm:grid-cols-2"><label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="returnForm.date" class="ls-input" type="date" required></label><label class="space-y-2 text-sm font-bold">{{ copy.reference }}<input v-model="returnForm.reference" class="ls-input" maxlength="200"></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.reason }}<textarea v-model="returnForm.reason" class="ls-input" minlength="2" maxlength="1000" required rows="2" /></label></div><p class="text-lg font-extrabold">{{ copy.total }}: {{ money(returnTotal) }}</p><div class="flex gap-2"><button class="ls-btn ls-btn-primary" :disabled="pendingAction">{{ pendingAction ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="pendingAction" @click="close">{{ copy.cancel }}</button></div></form></template></BsDialog>
      <BsDialog v-model:visible="reversalOpen" :title="copy.reversal" :dirty="true" :pending="pendingAction"><template #default="{ close }"><form class="grid gap-4 sm:grid-cols-2" @submit.prevent="saveReversal"><p v-if="actionError" role="alert" class="sm:col-span-2 rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p><label class="space-y-2 text-sm font-bold">{{ copy.amount }}<input v-model.number="reversalForm.amount" class="ls-input" type="number" min="0.01" :max="selectedPayment?.remainingEffective" step="0.01" required></label><label class="space-y-2 text-sm font-bold">{{ copy.date }}<input v-model="reversalForm.date" class="ls-input" type="date" required></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.reason }}<textarea v-model="reversalForm.reason" class="ls-input" minlength="2" maxlength="1000" required rows="2" /></label><label class="space-y-2 text-sm font-bold sm:col-span-2">{{ copy.reference }}<input v-model="reversalForm.reference" class="ls-input" maxlength="200"></label><div class="flex gap-2 sm:col-span-2"><button class="ls-btn ls-btn-primary" :disabled="pendingAction">{{ pendingAction ? copy.saving : copy.save }}</button><button type="button" class="ls-btn" :disabled="pendingAction" @click="close">{{ copy.cancel }}</button></div></form></template></BsDialog>
    </template>
  </div>
</template>

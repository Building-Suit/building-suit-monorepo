<script setup lang="ts">
import type { BsCommerceDocumentCopy, BsCommerceDocumentForm, BsCommerceCorrectionForm, BsCommerceDocumentView } from '@building-suit/ui/types/commerceDocumentPresentation'

import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { refreshShopQueries } = useShopInvalidation()

const { businessCurrency } = useShop()

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
const shopRpc = useShopClient<ShopRpcDatabase>().schema('public')
const confirmation = useConfirmation()
const captureScope = useShopTaskScope()
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

const { data: purchase, pending, error, refresh } = useShopQuery(
  () => `shop-data:purchase:${currentId.value ?? 'none'}:${purchaseId.value}`,
  async (): Promise<PurchaseDetail | null> => {
    if (!currentId.value || !purchaseId.value) return null
    const { data, error } = await shopRpc.rpc('get_purchase', { p_shop_id: currentId.value, p_purchase_id: purchaseId.value })
    if (error) throw error
    return data as PurchaseDetail | null
  }, { watch: [currentId, purchaseId], default: () => null },
)

watch([paymentForm, creditForm, returnForm, reversalForm], () => { if (!pendingAction.value) requestId.value = null }, { deep: true })

function money(value: number) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(Number(value)) }
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
  await Promise.all([refresh(), refreshShopQueries(key => key.startsWith('shop-data:purchases:'))])
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

const commerceDialogOpen = computed({ get: () => paymentOpen.value || creditOpen.value || returnOpen.value || reversalOpen.value, set: value => { if (!value) paymentOpen.value = creditOpen.value = returnOpen.value = reversalOpen.value = false } })
const unusedCorrectionOpen = ref(false)
const unusedCorrectionForm = ref<BsCommerceCorrectionForm>({ date: '', reference: '', reason: '' })
const commerceForm = computed<BsCommerceDocumentForm>({
  get: () => ({ amount: paymentOpen.value ? paymentForm.amount : creditOpen.value ? creditForm.amount : reversalForm.amount, date: paymentOpen.value ? paymentForm.date : creditOpen.value ? creditForm.date : returnOpen.value ? returnForm.date : reversalForm.date, method: paymentForm.method, reference: paymentOpen.value ? paymentForm.reference : creditOpen.value ? creditForm.reference : returnOpen.value ? returnForm.reference : reversalForm.reference, notes: paymentForm.notes, reason: creditOpen.value ? creditForm.reason : returnOpen.value ? returnForm.reason : reversalForm.reason, quantities: { ...returnForm.quantities } }),
  set: value => {
    if (paymentOpen.value) Object.assign(paymentForm, { amount: value.amount, date: value.date, method: paymentMethods.includes(value.method as PaymentMethod) ? value.method : paymentForm.method, reference: value.reference, notes: value.notes })
    else if (creditOpen.value) Object.assign(creditForm, { amount: value.amount, date: value.date, reason: value.reason, reference: value.reference })
    else if (returnOpen.value) Object.assign(returnForm, { date: value.date, reason: value.reason, reference: value.reference, quantities: { ...value.quantities } })
    else if (reversalOpen.value) Object.assign(reversalForm, { amount: value.amount, date: value.date, reason: value.reason, reference: value.reference })
  },
})
const commerceMethods = computed(() => paymentMethods.map(value => ({ value, label: methodLabel(value) })))
const commerceCopy = computed<BsCommerceDocumentCopy>(() => ({
  back: copy.value.back, loading: copy.value.loading, loadError: copy.value.loadError, retry: copy.value.retry, notFound: copy.value.notFound, party: copy.value.supplier, date: copy.value.date, created: copy.value.date, notes: copy.value.notes, total: copy.value.total, balance: copy.value.payable, discount: '', paid: '', due: '', settlement: copy.value.status,
  lines: copy.value.lines, item: copy.value.product, quantity: copy.value.quantity, price: copy.value.unitCost, available: copy.value.available, payments: copy.value.payments, credits: copy.value.credits, inventory: copy.value.inventory, empty: copy.value.empty, noInventory: copy.value.empty, noParty: copy.value.empty, details: copy.value.invoice, batch: '', open: '', recordPayment: copy.value.recordPayment, recordCredit: copy.value.recordCredit, recordReturn: copy.value.recordReturn, reverse: copy.value.reverse, refund: '', issue: '', issuing: '', edit: '', reprint: '', share: '', amount: copy.value.amount, method: copy.value.method, reference: copy.value.reference, reason: copy.value.reason, save: copy.value.save, cancel: copy.value.cancel, correction: '', correctionLoading: '', correctionError: '', refunded: '', restored: '', correct: '', correctionDialog: '', correctionSubmit: '',
}))
const commerceView = computed<BsCommerceDocumentView>(() => {
  const value = purchase.value
  const actionable = value?.status === 'posted' && Number(value.payable) > 0
  return {
    loading: pending.value, error: Boolean(error.value), found: Boolean(value), title: copy.value.title, subtitle: value?.invoiceNumber || '', status: '', actionError: actionError.value, success: success.value, notice: '',
    party: { name: value?.vendorNameSnapshot || '', to: '', phone: '', email: '', address: '' },
    detail: { date: value ? displayDate(value.issuedAt) : '', created: '', notes: value?.notes || '—', total: money(Number(value?.totalAmount || 0)), balance: money(Number(value?.payable || 0)), discount: '', paid: '', due: '', settlement: value ? settlementLabel(value.settlementState) : '' },
    showCreated: false, showDiscount: false, showNotes: false, showPaid: false, showDue: false, showAvailable: true, showPayments: true, showCredits: true, inventoryTable: true,
    canPayment: Boolean(actionable && value?.canRecordPayment), canCredit: Boolean(actionable && value?.canRecordCredit), canReturn: Boolean(actionable && value?.canReturnStock && value.items.some(item => Number(item.availableToReturn) > 0)), canIssue: false, issuing: false, editTo: '', receiptTo: '', canShare: false, sharing: false,
    lines: (value?.items || []).map(item => ({ id: item.id, name: item.productName, description: '', quantity: String(item.quantity), price: money(item.unitCost), total: money(item.totalCost), discount: '', available: String(item.availableToReturn), returnMaximum: Number(item.availableToReturn) })),
    events: (value?.paymentEvents || []).map(event => ({ id: event.id, title: `${eventLabel(event)} · ${money(event.amount)}`, description: [displayDate(event.eventAt), event.method ? methodLabel(event.method) : '', event.reference].filter(Boolean).join(' · '), reason: event.reason || '', canReverse: Boolean(event.eventType === 'payment' && value?.canReversePayment && Number(event.remainingEffective) > 0), canRefund: false })),
    credits: (value?.credits || []).map(credit => ({ id: credit.id, title: `${money(credit.amount)} · ${credit.purchaseReturnId ? copy.value.returns : copy.value.recordCredit}`, description: [displayDate(credit.effectiveAt), credit.reference].filter(Boolean).join(' · '), reason: credit.reason, canReverse: false, canRefund: false })),
    movements: (value?.receiptMovements || []).map(movement => ({ id: movement.id, date: displayDate(movement.createdAt), name: value?.items.find(item => item.productId === movement.productId)?.productName || '—', quantity: String(movement.quantityChange), cost: money(movement.unitCostSnapshot), batch: '', to: '' })),
    correction: { visible: false, loading: false, error: false, canCorrect: false, title: '', description: '', reason: '', refunded: '', restored: '', notice: '', fullOnly: '' },
    dialog: { title: paymentOpen.value ? copy.value.recordPayment : creditOpen.value ? copy.value.recordCredit : returnOpen.value ? copy.value.recordReturn : copy.value.reversal, dirty: paymentOpen.value ? paymentDirty.value : creditOpen.value ? creditDirty.value : returnOpen.value ? returnDirty.value : reversalDirty.value, pending: pendingAction.value, maximum: reversalOpen.value ? selectedPayment.value?.remainingEffective : value?.payable, showAmount: !returnOpen.value, showMethod: paymentOpen.value, showReference: true, showNotes: paymentOpen.value, showReason: !paymentOpen.value, showQuantities: returnOpen.value, total: money(returnTotal.value) },
    correctionDialog: { dirty: false, pending: false, warning: '' },
  }
})
function reverseCommerceEvent(id: string) { const event = purchase.value?.paymentEvents.find(event => event.id === id); if (event) openReversal(event) }
function submitCommerce() { if (paymentOpen.value) return savePayment(); if (creditOpen.value) return saveCredit(); if (returnOpen.value) return saveReturn(); if (reversalOpen.value) return saveReversal() }
</script>

<template>
  <BsCommerceDocumentPage v-model:form="commerceForm" v-model:correction-form="unusedCorrectionForm" v-model:dialog-open="commerceDialogOpen" v-model:correction-open="unusedCorrectionOpen" :copy="commerceCopy" :view="commerceView" back-to="/purchases" inventory-to="/inventory" :methods="commerceMethods" :constraints="{ referenceLength: 200, notesLength: 2000, reasonMinimum: 2, reasonMaximum: 1000, amountMinimum: 0.01, amountStep: 0.01, quantityStep: 0.001 }" @retry="refresh()" @payment="openPayment" @credit="openCredit" @return="openReturn" @reverse="reverseCommerceEvent" @submit="submitCommerce"/>
</template>

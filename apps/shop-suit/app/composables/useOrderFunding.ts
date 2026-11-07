import { normalizeDecimalText } from '@building-suit/ux/decimalText'
import type { Ref } from 'vue'
import type { BsOrderFundingForm, BsOrderFundingView } from '@building-suit/ui/types/tradeOrderPresentation'
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { OrderDepositAction, OrderFundingContext, OrderPaymentMethod } from '~/types/tradeOrders'

function readContext(value: OrderFundingContext | null): OrderFundingContext {
 const d = value, decimal = (value: unknown) => typeof value === 'string' && /^-?[0-9]+(?:\.[0-9]+)?$/.test(value)
  if (!d || !Array.isArray(d.items) || !Array.isArray(d.history) || !Array.isArray(d.invoices) || typeof d.currency !== 'string'
   || ![d.depositsNet,d.unapplied,d.depositCapacity].every(decimal)
   || d.items.some(row => ![row.amount,row.available,row.applied].every(decimal)) || d.history.some(row => !decimal(row.amount)) || d.invoices.some(row => !decimal(row.outstanding))) throw new Error('INVALID_ORDER_FUNDING_RESPONSE')
  return d
}

export function useOrderFunding(orderId: Ref<string | null>, refreshOrder: () => Promise<unknown>) {
 const rpc = useShopClient<ShopRpcDatabase>().schema('public'), user = useSupabaseUser()
 const { currentId, currentLocationId } = useShop(), { locale, t } = useI18n(), captureScope = useShopTaskScope()
 const ar = computed(() => locale.value === 'ar'), page = ref(1), historyPage = ref(1), open = ref(false), saving = ref(false), commandError = ref('')
 const action = ref<OrderDepositAction>('receive'), revision = ref(0), sourceSummary = ref('')
 const localNow = () => { const at = new Date(); return new Date(at.getTime() - at.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
 const blank = (): BsOrderFundingForm => ({ allocationId: '', invoiceId: '', amount: '', at: localNow(), method: 'cash', reference: '', reason: '' })
 const form = ref(blank()), frozen = ref<ShopRpcDatabase['public']['Functions']['trade_order_deposit']['Args'] | null>(null)
 const { dirty } = useRecordAction(() => form.value, open), locked = computed(() => saving.value || !!frozen.value)
 const invoiceChoices = ref<OrderFundingContext['invoices']>([]), invoicePage = ref(1), invoiceTotal = ref(0), invoiceSearch = ref(''), invoicePending = ref(false), invoiceFailed = ref(false)
 let invoiceGeneration = 0
 const { data, pending, error, refresh } = useShopQuery(() => `shop-data:order-funding:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${orderId.value}:${page.value}:${historyPage.value}`, async () => {
  if (!currentId.value || !currentLocationId.value || !orderId.value) return null
  const result = await rpc.rpc('trade_order_funding_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_page: page.value, p_history_page: historyPage.value })
  if (result.error) throw result.error
  return readContext(result.data)
 }, { default: () => null })
 const money = (value: string) => formatPresentationMoney(value, { currency: data.value?.currency || 'EGP', locale: ar.value ? 'ar-EG' : 'en-EG', unit: 'major', numberingSystem: ar.value ? 'arab' : 'latn' })
 const date = (value: string) => new Date(value).toLocaleString(locale.value)
 const labels = computed(() => ar.value ? { receive: 'تسجيل عربون', apply: 'تخصيص عربون لفاتورة', refund: 'تسجيل رد عربون', reverse: 'تصحيح عربون مسجل بالخطأ' } : { receive: 'Record deposit', apply: 'Apply deposit to invoice', refund: 'Record deposit refund', reverse: 'Correct mistaken deposit' })
 const failure = (cause: unknown) => {
  const message = String((cause as Error)?.message || '')
  if (/CONTEXT_CHANGED/.test(message)) return ar.value ? 'تغير الأمر. حدّث البيانات ثم أغلق النموذج وافتحه من جديد.' : 'The order changed. Refresh the data, then close and reopen this form.'
  if (/PERIOD.*CLOSED|CLOSED.*PERIOD/.test(message)) return ar.value ? 'الفترة المالية مغلقة. اختر تاريخًا في فترة مفتوحة.' : 'The financial period is closed. Choose a date in an open period.'
  if (/ADVANCE_AMOUNT_UNAVAILABLE|EXCEEDS_AGREEMENT|INVOICE_NOT_ELIGIBLE/.test(message)) return ar.value ? 'تغير الرصيد المتاح أو الفاتورة. راجع المدفوعات والمبلغ المستحق.' : 'The available balance or invoice changed. Review payments and the amount due.'
  return ar.value ? 'تعذر تحميل الدفعة أو تسجيلها. راجع الصلاحيات والبيانات وحاول مجددًا.' : 'Could not load or record this payment. Check access and details, then retry.'
 }
 async function loadInvoices(append = false) {
  const valid = captureScope(), generation = ++invoiceGeneration
  if (!currentId.value || !currentLocationId.value || !orderId.value) return
  invoicePending.value = true; invoiceFailed.value = false
  try {
   const result = await rpc.rpc('trade_order_funding_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_invoice_page: invoicePage.value, p_invoice_search: invoiceSearch.value.trim() || null })
   if (!valid() || generation !== invoiceGeneration) return
   if (result.error) throw result.error
   const d = readContext(result.data)
   invoiceChoices.value = append ? [...invoiceChoices.value, ...d.invoices] : d.invoices; invoiceTotal.value = d.invoiceTotal
  } catch { if (valid() && generation === invoiceGeneration) invoiceFailed.value = true }
  finally { if (valid() && generation === invoiceGeneration) invoicePending.value = false }
 }
 function searchInvoices(value: string) { invoiceSearch.value = value; invoicePage.value = 1; void loadInvoices() }
 function moreInvoices() { if (invoicePending.value) return; invoicePage.value++; void loadInvoices(true) }
 watch([currentId, currentLocationId, () => user.value?.id, orderId], () => { invoiceGeneration++; invoiceChoices.value = []; invoiceTotal.value = 0; invoicePending.value = false; invoiceFailed.value = false; invoiceSearch.value = ''; invoicePage.value = 1; page.value = 1; historyPage.value = 1; open.value = false; frozen.value = null; saving.value = false; commandError.value = ''; sourceSummary.value = ''; form.value = blank() }, { flush: 'sync' })
 onScopeDispose(() => { invoiceGeneration++ })
 function edit(next: OrderDepositAction, allocationId = '') {
  const d = data.value, row = d?.items.find(item => item.id === allocationId)
  if (locked.value || pending.value || error.value || !d) return
  if (next === 'receive' ? !d.canReceive || !['open','partially_fulfilled'].includes(d.status) : !row || row.available === '0' || (next === 'refund' ? !d.canRefund : next === 'reverse' ? !d.canReverse : !d.canReceive)) return
  action.value = next; revision.value = d.revision; commandError.value = ''; sourceSummary.value = row ? `${date(row.paid_at)} · ${money(row.amount)} · ${row.reference || ''}` : ''
  form.value = { ...blank(), allocationId, amount: '' }; open.value = true
  if (next === 'apply') { invoicePage.value = 1; invoiceSearch.value = ''; invoiceChoices.value = []; void loadInvoices() }
 }
 async function submit() {
  if (!currentId.value || !currentLocationId.value || !orderId.value || saving.value) return
  const valid = captureScope()
  if (!frozen.value) {
   const amount = normalizeDecimalText(form.value.amount), at = new Date(form.value.at), methods = ['cash','bank_transfer','card','wallet','cheque','other'], needsMethod = ['receive','refund'].includes(action.value)
   if (!/^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/.test(amount) || !/[1-9]/.test(amount) || !Number.isFinite(at.getTime()) || form.value.reason.trim().length < 3 || (needsMethod && !methods.includes(form.value.method)) || (action.value === 'apply' && !form.value.invoiceId)) {
    commandError.value = ar.value ? 'أدخل مبلغًا موجبًا بمنزلتين عشريتين كحد أقصى وتاريخًا وسببًا وفاتورة عند التخصيص.' : 'Enter a positive amount with at most two decimal places, a date, a reason and an invoice when applying funds.'; return
   }
   frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_revision: revision.value, p_action: action.value, p_amount: amount, p_at: at.toISOString(), p_method: needsMethod ? form.value.method as OrderPaymentMethod : null, p_allocation_id: action.value === 'receive' ? null : form.value.allocationId, p_invoice_id: action.value === 'apply' ? form.value.invoiceId : null, p_reference: form.value.reference.trim() || null, p_reason: form.value.reason.trim() }
  }
  saving.value = true; commandError.value = ''; let confirmed = false
  try {
   const result = await rpc.rpc('trade_order_deposit', frozen.value)
   if (!valid()) return
   if (result.error) { if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code) && !result.error.code.startsWith('08')) frozen.value = null; throw result.error }
   if (!result.data) throw new Error('UNCONFIRMED_RESULT')
   frozen.value = null; confirmed = true; await Promise.all([refresh(), refreshOrder()])
  } catch (cause) { if (valid() && !confirmed) commandError.value = frozen.value ? ar.value ? 'لم تتأكد النتيجة. أعد المحاولة قبل تغيير القيم أو تسجيل دفعة أخرى.' : 'The result is unconfirmed. Retry before changing values or recording another payment.' : failure(cause) }
  finally { if (valid()) { saving.value = false; if (confirmed) open.value = false } }
 }
 const view = computed<BsOrderFundingView>(() => {
  const d = data.value
  return { title: ar.value ? 'العربون والمدفوعات' : 'Deposits and payments', explanation: ar.value ? 'يظهر العربون في حساب العميل. تخصيصه لفاتورة لا يسجل تحصيلًا جديدًا. تُعدّل المبالغ التي خُصصت بالفعل من الفاتورة المرتبطة.' : 'Deposits appear in the customer account. Applying a deposit to an invoice records no new collection. Adjust amounts already applied from their linked invoice.', loading: pending.value, denied: /PERMISSION|AUTH_REQUIRED/.test(error.value?.message || ''), error: error.value ? failure(error.value) : '', retry: ar.value ? 'تحديث المدفوعات' : 'Refresh payments', locked: locked.value, receive: labels.value.receive, apply: labels.value.apply, refund: labels.value.refund, reverse: labels.value.reverse, canReceive: !pending.value && !error.value && !!d?.canReceive && ['open','partially_fulfilled'].includes(d.status), amount: ar.value ? 'المبلغ' : 'Amount', available: ar.value ? 'غير المخصص' : 'Unapplied', applied: ar.value ? 'المخصص للفواتير' : 'Applied to invoices', method: ar.value ? 'طريقة الدفع' : 'Payment method', reference: ar.value ? 'المرجع' : 'Reference', date: ar.value ? 'تاريخ العملية' : 'Transaction date', reason: ar.value ? 'سبب العملية' : 'Reason', actor: ar.value ? 'المسؤول' : 'Responsible person', actions: ar.value ? 'الإجراءات' : 'Actions', invoice: ar.value ? 'الفاتورة' : 'Invoice', historyTitle: ar.value ? 'سجل التخصيص والاسترداد' : 'Allocation and refund history', close: ar.value ? 'إلغاء' : 'Cancel', summaries: d ? [{ label: ar.value ? 'صافي العربون' : 'Net deposits', value: money(d.depositsNet) }, { label: ar.value ? 'عربون غير مخصص' : 'Unapplied deposits', value: money(d.unapplied) }, { label: ar.value ? 'الحد المتبقي للعربون' : 'Remaining deposit capacity', value: money(d.depositCapacity) }] : [], rows: (d?.items || []).map(row => ({ id: row.id, date: date(row.paid_at), amount: money(row.amount), available: money(row.available), applied: money(row.applied), method: t(`payments.methods.${row.method}`), reference: row.reference || '', canApply: !pending.value && !error.value && !!d?.canReceive && row.available !== '0', canRefund: !pending.value && !error.value && !!d?.canRefund && row.available !== '0', canReverse: !pending.value && !error.value && !!d?.canReverse && row.available !== '0' })), total: d?.total || 0, events: (d?.history || []).map(row => ({ id: row.id, action: row.kind === 'apply' ? labels.value.apply : row.kind === 'refund' ? labels.value.refund : labels.value.reverse, amount: money(row.amount), date: date(row.effective_at), reason: row.reason, actor: row.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), invoiceTo: row.invoice_id ? `/sales/${encodeURIComponent(row.invoice_id)}` : '' })), eventCount: d?.historyTotal || 0, invoicePicker: { options: invoiceChoices.value.map(row => ({ id: row.id, name: `${row.invoice_number} · ${money(row.outstanding)}` })), loading: invoicePending.value, error: invoiceFailed.value ? (ar.value ? 'تعذر تحميل الفواتير المستحقة.' : 'Could not load outstanding invoices.') : null, hasMore: invoiceChoices.value.length < invoiceTotal.value, more: ar.value ? 'تحميل المزيد' : 'Load more', retry: ar.value ? 'إعادة المحاولة' : 'Retry' }, methodOptions: ['cash','bank_transfer','card','wallet','cheque','other'].map(value => ({ value, label: t(`payments.methods.${value}`) })), editor: { title: labels.value[action.value], dirty: dirty.value, pending: saving.value, error: commandError.value, summary: sourceSummary.value, explanation: action.value === 'reverse' ? ar.value ? 'صحح المبلغ المسجل بالخطأ. لا يسجل هذا الإجراء رد أموال للعميل.' : 'Correct an amount recorded by mistake. This action does not record money returned to the customer.' : action.value === 'refund' ? ar.value ? 'سجل المبلغ الذي أُعيد فعليًا إلى العميل. يبقى الإيصال الأصلي محفوظًا.' : 'Record money actually returned to the customer. The original receipt remains in history.' : ar.value ? 'راجع الإيصالات الحالية قبل تسجيل تحصيل آخر.' : 'Review existing receipts before recording another collection.', needsMethod: ['receive','refund'].includes(action.value), needsInvoice: action.value === 'apply' } }
 })
 return { page, historyPage, open, form, locked, view, edit, submit, refresh, searchInvoices, moreInvoices, retryInvoices: () => loadInvoices(invoicePage.value > 1) }
}

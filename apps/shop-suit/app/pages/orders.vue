<script setup lang="ts">
import type { BsTradeOrderCopy, BsTradeOrderForm, BsTradeOrderRow, BsTradeOrderView, BsOrderQuotationPicker } from '@building-suit/ui/types/tradeOrderPresentation'
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { OrderQuotationChoice, TradeOrderContext, TradeOrderStatus } from '~/types/tradeOrders'
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId } = useShop()
const user = useSupabaseUser(), route = useRoute()
const { locale } = useI18n()
const ar = computed(() => locale.value === 'ar')
const search = ref(''), term = ref(''), page = ref(1), historyPage = ref(1), orderId = ref<string | null>(null)
const editorOpen = ref(false), detailOpen = ref(false), saving = ref(false), editorError = ref('')
const form = ref<BsTradeOrderForm>({ quotationId: '', reason: '' })
const { dirty } = useRecordAction(() => form.value, editorOpen)
const captureScope = useShopTaskScope()
const frozen = ref<ShopRpcDatabase['public']['Functions']['create_trade_order']['Args'] | null>(null)
const choiceSearch = ref(''), choicePage = ref(1), choiceItems = ref<OrderQuotationChoice[]>([]), choiceTotal = ref(0), choicesPending = ref(false), choicesFailed = ref(false)
let choiceGeneration = 0
const empty = (): TradeOrderContext => ({ items: [], total: 0, page: 1, pageSize: 20, detail: null, quotation: null, canManage: false })
useDebouncedChange(search, value => { term.value = value.trim(); page.value = 1 }, 250)
const { data, pending, error, refresh } = useShopQuery(() => `shop-data:orders:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${term.value}:${page.value}`, async () => {
 if (!currentId.value || !currentLocationId.value) return empty()
 const r = await rpc.rpc('trade_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: term.value || null, p_page: page.value })
 if (r.error) throw r.error
 return r.data ?? empty()
}, { default: empty })
const { data: detailData, pending: detailPending, error: detailError, refresh: refreshDetail } = useShopQuery(() => `shop-data:order-detail:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${orderId.value}:${historyPage.value}`, async () => {
 if (!currentId.value || !currentLocationId.value || !orderId.value) return empty()
 const r = await rpc.rpc('trade_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_history_page: historyPage.value })
 if (r.error) throw r.error
 return r.data ?? empty()
}, { default: empty })
const { page: reservationPage, historyPage: reservationHistoryPage, open: reservationOpen, form: reservationForm, locked: reservationLocked, view: reservationView, edit: editReservation, submit: submitReservation, refresh: refreshReservations } = useOrderReservations(orderId, refreshAfterReservation)
const { page: fundingPage, historyPage: fundingHistoryPage, open: fundingOpen, form: fundingForm, locked: fundingLocked, view: fundingView, edit: editFunding, submit: submitFunding, refresh: refreshFunding, searchInvoices, moreInvoices, retryInvoices } = useOrderFunding(orderId, refreshAfterFunding)
const { page: deliveryPage, open: deliveryOpen, form: deliveryForm, locked: deliveryLocked, view: deliveryView, edit: editDelivery, submit: submitDelivery, refresh: refreshDeliveries } = useOrderDelivery(orderId, refreshAfterDelivery)
const operationsLocked = computed(() => reservationLocked.value || fundingLocked.value || deliveryLocked.value)
async function refreshAfterReservation() { await Promise.all([refresh(), refreshDetail(), refreshFunding(), refreshDeliveries()]) }
async function refreshAfterFunding() { await Promise.all([refresh(), refreshDetail(), refreshReservations(), refreshDeliveries()]) }
async function refreshAfterDelivery() { await Promise.all([refresh(), refreshDetail(), refreshReservations(), refreshFunding()]) }
const { data: previewData, pending: previewPending, error: previewError, refresh: refreshPreview } = useShopQuery(() => `shop-data:order-quote:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${form.value.quotationId}`, async () => {
 if (!currentId.value || !currentLocationId.value || !form.value.quotationId) return empty()
 const r = await rpc.rpc('trade_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_quotation_id: form.value.quotationId })
 if (r.error) throw r.error
 return r.data ?? empty()
}, { default: empty })
async function loadChoices(append = false) {
 const valid = captureScope(), generation = ++choiceGeneration
 if (!currentId.value || !currentLocationId.value) return
 choicesPending.value = true; choicesFailed.value = false
 try { const r = await rpc.rpc('trade_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_kind: 'quotations', p_search: choiceSearch.value.trim() || null, p_page: choicePage.value }); if (!valid() || generation !== choiceGeneration) return; if (r.error || !r.data) throw r.error; const rows = r.data.items.filter((row): row is OrderQuotationChoice => 'name' in row); choiceItems.value = append ? [...choiceItems.value, ...rows] : rows; choiceTotal.value = r.data.total }
 catch { if (valid() && generation === choiceGeneration) choicesFailed.value = true }
 finally { if (valid() && generation === choiceGeneration) choicesPending.value = false }
}
function queryChoices(value: string) { choiceSearch.value = value; choicePage.value = 1; void loadChoices() }
function moreChoices() { if (choicesPending.value) return; choicePage.value++; void loadChoices(true) }
watch([currentId, currentLocationId, () => user.value?.id], () => { choiceGeneration++; choiceItems.value = []; choiceTotal.value = 0; choicesPending.value = false; choicesFailed.value = false; choiceSearch.value = ''; choicePage.value = 1; editorOpen.value = false; detailOpen.value = false; orderId.value = null; frozen.value = null; saving.value = false; form.value = { quotationId: '', reason: '' }; editorError.value = '' }, { flush: 'sync' })
onScopeDispose(() => { choiceGeneration++ })
const copy = computed<BsTradeOrderCopy>(() => ar.value ? {
 title: 'أوامر العملاء', subtitle: 'أدر الأوامر المتفق عليها وحجوزات المخزون والعربون والتسليم الجزئي.', add: 'أمر من عرض مقبول', search: 'رقم الأمر أو مرجع المشروع', number: 'رقم الأمر', customer: 'العميل', project: 'مرجع المشروع', status: 'الحالة', total: 'الإجمالي المتفق عليه', date: 'التاريخ', actions: 'الإجراءات', open: 'فتح', quotation: 'العرض المقبول', reason: 'سبب التحويل', convert: 'إنشاء الأمر', cancel: 'إلغاء', retry: 'إعادة المحاولة', empty: 'لا توجد أوامر مطابقة.', noShop: 'اختر متجرًا وفرعًا أولًا.', close: 'إغلاق', lines: 'البنود المتفق عليها', quantity: 'الكمية', price: 'السعر المتفق عليه', history: 'سجل الأمر', actor: 'المسؤول', event: 'الإجراء', source: 'إصدار عرض الأسعار', agreement: 'إنشاء الأمر يحفظ الاتفاق ولا يحجز مخزونًا أو يسجل دفعة. تبقى الفواتير والمدفوعات وحركات المخزون في سجلاتها.', existing: 'فتح الأمر الموجود'
} : {
 title: 'Customer orders', subtitle: 'Manage agreed orders, stock reservations, deposits and partial collections.', add: 'Order from accepted quotation', search: 'Order number or project reference', number: 'Order number', customer: 'Customer', project: 'Project reference', status: 'Status', total: 'Agreed total', date: 'Date', actions: 'Actions', open: 'Open', quotation: 'Accepted quotation', reason: 'Reason for conversion', convert: 'Create order', cancel: 'Cancel', retry: 'Retry', empty: 'No matching orders.', noShop: 'Select a shop and location first.', close: 'Close', lines: 'Agreed items', quantity: 'Quantity', price: 'Agreed price', history: 'Order history', actor: 'Responsible person', event: 'Action', source: 'Quotation version', agreement: 'Creating an order preserves the agreement and reserves no stock or payment. Invoices, payments and stock movements remain in their own histories.', existing: 'Open existing order'
})
const eventLabel = (action: string) => ({ convert: copy.value.convert, reserve: reservationView.value.reserve, release: reservationView.value.release, expire: reservationView.value.expire, cancel: reservationView.value.cancelOrder, fulfill: deliveryView.value.collect, deposit_receive: fundingView.value.receive, deposit_apply: fundingView.value.apply, deposit_refund: fundingView.value.refund, deposit_reverse: fundingView.value.reverse } as Record<string, string>)[action] || (ar.value ? 'تحديث الأمر' : 'Order update')
const money = (amount: string | number, currency: string) => formatPresentationMoney(amount, { currency, locale: ar.value ? 'ar-EG' : 'en-EG', unit: 'major', numberingSystem: ar.value ? 'arab' : 'latn' })
const date = (value: string) => new Date(value).toLocaleString(locale.value)
const statusLabels = computed<Record<TradeOrderStatus, string>>(() => ar.value ? { open: 'مفتوح', partially_fulfilled: 'تم توريد جزء', fulfilled: 'تم التوريد', cancelled: 'ملغى' } : { open: 'Open', partially_fulfilled: 'Partially fulfilled', fulfilled: 'Fulfilled', cancelled: 'Cancelled' })
const detail = computed(() => detailData.value?.detail ?? null), preview = computed(() => previewData.value?.quotation ?? null)
const rows = computed<BsTradeOrderRow[]>(() => (data.value?.items ?? []).filter(row => 'order_number' in row).map(row => ({ id: row.id, number: row.order_number, customer: row.customer_name, project: row.project_reference || '', status: statusLabels.value[row.status], total: money(row.total_amount, row.currency), date: date(row.created_at) })))
const quotationPicker = computed<BsOrderQuotationPicker>(() => {
 const options = choiceItems.value.map(row => ({ id: row.id, name: `${row.name}${row.project_reference ? ` · ${row.project_reference}` : ''}` }))
 if (preview.value && !options.some(row => row.id === preview.value!.id)) options.unshift({ id: preview.value.id, name: preview.value.number })
 return { options, loading: choicesPending.value, error: choicesFailed.value ? (ar.value ? 'تعذر تحميل العروض المقبولة.' : 'Could not load accepted quotations.') : null, hasMore: choiceItems.value.length < choiceTotal.value, more: ar.value ? 'تحميل المزيد' : 'Load more', retry: copy.value.retry }
})
function failure(cause: unknown) { const message = String((cause as Error)?.message || ''); return /CONTEXT_CHANGED|CURRENCY_CHANGED|REQUIRES_ACCEPTED/.test(message) ? ar.value ? 'تغير العرض أو وحدته أو عملته. راجع الاتفاق الحالي قبل إنشاء الأمر.' : 'The quotation, unit or currency changed. Review the current agreement before creating an order.' : ar.value ? 'تعذر تحميل الأمر أو تنفيذه. راجع الصلاحيات وحاول مرة أخرى.' : 'Could not load or complete the order. Check access and retry.' }
function open(id: string) { if (frozen.value || saving.value || operationsLocked.value) return; orderId.value = id; historyPage.value = 1; editorOpen.value = false; detailOpen.value = true }
function create(quotationId = '') { if (!data.value?.canManage || frozen.value || saving.value || operationsLocked.value) return; editorError.value = ''; form.value = { quotationId, reason: '' }; editorOpen.value = true; choicePage.value = 1; choiceSearch.value = ''; void loadChoices() }
async function submit() {
 if (!currentId.value || !currentLocationId.value || saving.value || previewPending.value) return
 const valid = captureScope()
 if (!frozen.value) {
  if (!preview.value || previewError.value || preview.value.id !== form.value.quotationId || preview.value.status !== 'accepted' || form.value.reason.trim().length < 3) { editorError.value = ar.value ? 'اختر عرضًا مقبولًا وأدخل سبب التحويل.' : 'Select an accepted quotation and enter the conversion reason.'; return }
  frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_quotation_id: preview.value.id, p_revision: preview.value.revision, p_reason: form.value.reason.trim() }
 }
 saving.value = true; editorError.value = ''
 try { const r = await rpc.rpc('create_trade_order', frozen.value); if (!valid()) return; if (r.error) { if (r.error.code && /^[0-9A-Z]{5}$/.test(r.error.code) && !r.error.code.startsWith('08')) frozen.value = null; throw r.error } if (!r.data) throw new Error('UNCONFIRMED_RESULT'); frozen.value = null; editorOpen.value = false; orderId.value = r.data.id; historyPage.value = 1; detailOpen.value = true; await Promise.all([refresh(), refreshDetail()]); void loadChoices() }
 catch (cause) { if (valid()) editorError.value = frozen.value ? ar.value ? 'لم يتأكد التحويل. أعد المحاولة بالطلب نفسه قبل تعديل القيم.' : 'Conversion is unconfirmed. Retry the same request before changing values.' : failure(cause) }
 finally { if (valid()) saving.value = false }
}
const view = computed<BsTradeOrderView>(() => {
 const d = detail.value, s = d?.record.agreed_snapshot, p = preview.value
 return { available: !!currentId.value && !!currentLocationId.value, loading: pending.value, error: error.value ? failure(error.value) : '', total: data.value?.total || 0, pageSize: 20, canCreate: !!data.value?.canManage, locked: saving.value || !!frozen.value || operationsLocked.value, reservation: { ...reservationView.value, locked: operationsLocked.value }, funding: { ...fundingView.value, locked: operationsLocked.value }, delivery: { ...deliveryView.value, locked: operationsLocked.value }, editor: { dirty: dirty.value, pending: saving.value || previewPending.value, locked: !!frozen.value, previewFailed: !!previewError.value, error: editorError.value || (previewError.value ? failure(previewError.value) : ''), summary: p ? `${p.number} · ${copy.value.source} ${p.version} · ${p.customerName} · ${p.projectReference || ''} · ${money(p.total,p.currency)}` : '', existingOrderTo: p?.orderId ? `/orders?order=${encodeURIComponent(p.orderId)}` : '' }, detail: { loading: detailPending.value, error: detailError.value ? failure(detailError.value) : '', title: d?.record.order_number || '', subtitle: s ? `${s.customerName} · ${s.projectReference || ''} · ${s.quotationNumber} / ${s.version}` : '', status: d ? statusLabels.value[d.record.status] : '', lines: (s?.lines || []).map((line,index) => ({ id: String(index), name: line.name, quantity: line.measurement ? `${line.measurement.enteredQuantity} ${line.measurement.packageName || (ar.value ? line.measurement.unitNameAr : line.measurement.unitNameEn)} (${line.measurement.baseQuantity} ${line.measurement.baseUnitCode})` : line.quantity, price: `${line.measurement?.enteredUnitPrice || line.unitPrice} ${s!.currency}`, total: money(line.total,s!.currency) })), totals: s ? [{ label: ar.value ? 'الخصم' : 'Discount', value: money(s.orderDiscount,s.currency) }, { label: ar.value ? 'الصافي' : 'Net', value: money(s.net,s.currency) }, { label: ar.value ? 'الضرائب' : 'Taxes', value: money(s.tax,s.currency) }, { label: copy.value.total, value: money(s.total,s.currency) }, { label: ar.value ? 'ملاحظات الاتفاق' : 'Agreement notes', value: s.notes || '' }] : [], events: (d?.events || []).map(e => ({ id: e.id, action: eventLabel(e.action), reason: e.reason, actor: e.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), date: date(e.created_at) })), eventCount: d?.eventCount || 0 } }
})
const queryId = (value: unknown) => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value) ? value : ''
watch([() => route.query.quotation, () => route.query.order, currentId, currentLocationId, () => data.value?.canManage], () => { if (!currentId.value || !currentLocationId.value || frozen.value) return; const order = queryId(route.query.order), quote = queryId(route.query.quotation); if (order) open(order); else if (quote) create(quote) }, { immediate: true })
</script>
<template>
 <BsTradeOrdersPage v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:editor-open="editorOpen" v-model:detail-open="detailOpen" v-model:form="form" v-model:reservation-open="reservationOpen" v-model:reservation-form="reservationForm" v-model:reservation-page="reservationPage" v-model:reservation-history-page="reservationHistoryPage" v-model:funding-open="fundingOpen" v-model:funding-form="fundingForm" v-model:funding-page="fundingPage" v-model:funding-history-page="fundingHistoryPage" v-model:delivery-open="deliveryOpen" v-model:delivery-form="deliveryForm" v-model:delivery-page="deliveryPage" :copy="copy" :view="view" :rows="rows" :quotation-picker="quotationPicker" @funding-action="editFunding" @funding-submit="submitFunding" @funding-retry="refreshFunding()" @invoice-search="searchInvoices" @invoice-more="moreInvoices" @invoice-retry="retryInvoices" @collect="editDelivery" @delivery-submit="submitDelivery" @delivery-retry="refreshDeliveries()" @reservation-action="editReservation" @reservation-submit="submitReservation" @reservation-retry="refreshReservations()" @retry="refresh()" @retry-detail="refreshDetail()" @add="create()" @open="open" @submit="submit" @retry-preview="refreshPreview()" @quotation-search="queryChoices" @quotation-more="moreChoices" @quotation-retry="loadChoices(choicePage > 1)" />
</template>

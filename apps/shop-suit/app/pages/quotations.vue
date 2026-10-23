<script setup lang="ts">
import type { BsQuotationCopy, BsQuotationForm, BsQuotationLineView, BsQuotationPicker, BsQuotationRow, BsQuotationView } from '@building-suit/ui/types/tradeQuotationPresentation'
import { renderReportDocument } from '@building-suit/ui/utils/reportDocument'
import { openPrintSession } from '@building-suit/ux'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { QuotationAction, QuotationContext, QuotationSnapshot, QuotationStatus, QuotationValues } from '~/types/tradeQuotations'
import type { ProductMeasurementOptions, SaleLineInput } from '~/types/measurement'
import { measurementUnits } from '~/utils/measurement'
import { tradePricePresentation } from '~/utils/tradePricing'
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId, current, businessCurrency } = useShop()
const businessMode = computed(() => current.value?.business_mode || 'mixed')
const user = useSupabaseUser()
const { locale } = useI18n()
const ar = computed(() => locale.value === 'ar')
const search = ref(''), term = ref(''), page = ref(1), historyPage = ref(1), detailId = ref<string | null>(null)
const editorOpen = ref(false), detailOpen = ref(false), saving = ref(false), editorError = ref(''), actionError = ref(''), reason = ref('')
const displayVersion = ref<QuotationSnapshot | null>(null)
const saveAction = ref<'save' | 'revise'>('save')
const frozen = ref<ShopRpcDatabase['public']['Functions']['trade_quotation_command']['Args'] | null>(null)
const localDate = (value: string) => { const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
const blank = (): BsQuotationForm => ({ customerId: '', validUntil: localDate(new Date(Date.now() + 7 * 86400000).toISOString()), projectReference: '', notes: '', orderDiscount: '0', reason: '', lines: [] })
const form = ref(blank())
const { dirty } = useRecordAction(() => form.value, editorOpen)
const captureScope = useShopTaskScope()
const productPicker = reactive(usePurchaseEntityPicker('product')), servicePicker = reactive(usePurchaseEntityPicker('service')), customerPicker = reactive(usePurchaseEntityPicker('customer'))
const pickers = { product: productPicker, service: servicePicker, customer: customerPicker }
const measurements = ref<Record<string, ProductMeasurementOptions>>({}), measurementPending = ref<Record<string, boolean>>({})
let generation = 0
const empty = (): QuotationContext => ({ items: [], total: 0, page: 1, pageSize: 20, detail: null, canManage: false, canIssue: false })
useDebouncedChange(search, value => { term.value = value.trim(); page.value = 1 }, 250)
const { data, pending, error, refresh } = useShopQuery(() => `shop-data:quotations:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${term.value}:${page.value}`, async () => {
 if (!currentId.value || !currentLocationId.value) return empty()
 const result = await rpc.rpc('trade_quotation_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: term.value || null, p_page: page.value })
 if (result.error) throw result.error
 return result.data ?? empty()
}, { default: empty })
const { data: detailData, pending: detailPending, error: detailError, refresh: refreshDetail } = useShopQuery(() => `shop-data:quotation-detail:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${detailId.value}:${historyPage.value}`, async () => {
 if (!currentId.value || !currentLocationId.value || !detailId.value) return empty()
 const result = await rpc.rpc('trade_quotation_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_quotation_id: detailId.value, p_history_page: historyPage.value })
 if (result.error) throw result.error
 return result.data ?? empty()
}, { default: empty })
const { data: canOverride } = useShopQuery(() => `shop-data:quotation-approval:${currentId.value}:${user.value?.id}`, async () => {
 if (!currentId.value) return false
 const r = await rpc.rpc('shop_permission_access', { p_shop_id: currentId.value, p_permission_keys: ['products.manage'] })
 if (r.error) throw r.error
 return r.data?.['products.manage'] === true
}, { default: () => false })
const detail = computed(() => detailData.value?.detail ?? null)
const snapshot = computed(() => displayVersion.value ?? detail.value?.snapshot ?? null)
watch([currentId, currentLocationId, () => user.value?.id], () => { generation++; editorOpen.value = false; detailOpen.value = false; detailId.value = null; frozen.value = null; saving.value = false; measurements.value = {}; measurementPending.value = {}; form.value = blank(); reason.value = ''; actionError.value = ''; displayVersion.value = null }, { flush: 'sync' })
const labels = computed<Record<QuotationStatus, string>>(() => ar.value ? { draft: 'مسودة', issued: 'صادر', accepted: 'مقبول', rejected: 'مرفوض', expired: 'منتهي الصلاحية', cancelled: 'ملغى' } : { draft: 'Draft', issued: 'Issued', accepted: 'Accepted', rejected: 'Rejected', expired: 'Expired', cancelled: 'Cancelled' })
const copy = computed<BsQuotationCopy>(() => ar.value ? {
 title: 'عروض الأسعار', subtitle: 'احفظ المسودة لمراجعة أسعار الخادم والضرائب قبل الإصدار. العرض ليس فاتورة ولا يحجز المخزون.', add: 'عرض جديد', search: 'رقم العرض أو مرجع المشروع', number: 'رقم العرض', customer: 'العميل', project: 'مرجع المشروع', status: 'الحالة', version: 'الإصدار', validity: 'صالح حتى', total: 'الإجمالي', actions: 'الإجراءات', open: 'فتح', edit: 'تعديل المسودة', revise: 'إعداد إصدار جديد', print: 'طباعة / PDF', empty: 'لا توجد عروض مطابقة.', retry: 'إعادة المحاولة', noShop: 'اختر متجرًا وفرعًا أولًا.', save: 'حفظ للمراجعة', cancel: 'إلغاء', notes: 'ملاحظات', discount: 'خصم إجمالي بالعملة', reason: 'سبب الإجراء', lines: 'البنود', addProduct: 'إضافة منتج', addService: 'إضافة خدمة', product: 'المنتج', service: 'الخدمة', quantity: 'الكمية', unit: 'الوحدة أو العبوة', overridePrice: 'السعر المعتمد', overrideReason: 'سبب تعديل السعر', remove: 'إزالة البند', price: 'سعر الوحدة', history: 'الإصدارات المحفوظة', events: 'سجل الحالات', actor: 'المسؤول', date: 'التاريخ', previous: 'السابق', next: 'التالي', close: 'إغلاق', currentVersion: 'عرض الإصدار الحالي'
} : {
 title: 'Quotations', subtitle: 'Save a draft to review server prices and taxes before issue. A quotation is not an invoice and reserves no stock.', add: 'New quotation', search: 'Quotation number or project reference', number: 'Quotation number', customer: 'Customer', project: 'Project reference', status: 'Status', version: 'Version', validity: 'Valid until', total: 'Total', actions: 'Actions', open: 'Open', edit: 'Edit draft', revise: 'Prepare new version', print: 'Print / PDF', empty: 'No matching quotations.', retry: 'Retry', noShop: 'Select a shop and location first.', save: 'Save for review', cancel: 'Cancel', notes: 'Notes', discount: 'Order discount in currency', reason: 'Reason for action', lines: 'Items', addProduct: 'Add product', addService: 'Add service', product: 'Product', service: 'Service', quantity: 'Quantity', unit: 'Unit or package', overridePrice: 'Approved price', overrideReason: 'Price adjustment reason', remove: 'Remove item', price: 'Unit price', history: 'Saved versions', events: 'Status history', actor: 'Responsible person', date: 'Date', previous: 'Previous', next: 'Next', close: 'Close', currentVersion: 'Show current version'
})
const money = (value: string | number, currency = snapshot.value?.currency || businessCurrency.value) => new Intl.NumberFormat(ar.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency }).format(Number(value))
const unitName = (code: string) => { const u = measurementUnits.find(unit => unit.code === code); return u ? ar.value ? u.nameAr : u.nameEn : code }
const date = (value: string) => new Date(value).toLocaleString(locale.value)
const rows = computed<BsQuotationRow[]>(() => (data.value?.items ?? []).map(row => ({ id: row.id, number: row.quotation_number, customer: row.customer_name || '', project: row.project_reference || '', status: labels.value[row.effective_status], version: String(row.version), validity: date(row.valid_until), total: money(row.total_amount, row.currency) })))
function picker(kind: keyof typeof pickers, selected?: { id: string; name: string }): BsQuotationPicker { const p = pickers[kind]; return { options: p.options(selected), loading: p.pending, error: p.error, hasMore: p.hasMore, more: p.copy.more, retry: p.copy.retry } }
const customerChoices = computed(() => picker('customer', detail.value ? { id: detail.value.record.customer_id, name: detail.value.snapshot.customerName } : undefined))
function unitOptions(productId: string) { const m = measurements.value[productId]; return m ? [...(m.status === 'legacy' ? ['ea'] : m.saleUnits).map(code => ({ value: `unit:${code}`, label: unitName(code) })), ...m.packages.filter(p => p.canSell).map(p => ({ value: `package:${p.id}:${p.version}`, label: `${p.name} (${p.baseQuantity} ${unitName(m.baseUnitCode)})` }))] : [] }
const lineViews = computed<BsQuotationLineView[]>(() => form.value.lines.map(line => ({ key: line.key, picker: picker(line.itemType === 'service' ? 'service' : 'product', line.sourceId ? { id: line.sourceId, name: line.name } : undefined), units: unitOptions(line.sourceId), loading: !!measurementPending.value[line.sourceId], sourceLabel: line.itemType === 'service' ? copy.value.service : copy.value.product, approval: line.itemType === 'product' ? tradePricePresentation(line, undefined, !!canOverride.value, ar.value, businessCurrency.value) : undefined })))
async function loadMeasurement(id: string) {
 if (!currentId.value || !id || measurements.value[id] || measurementPending.value[id]) return
 const valid = captureScope(), token = generation; measurementPending.value = { ...measurementPending.value, [id]: true }
 try { const r = await rpc.rpc('product_measurement_options', { p_shop_id: currentId.value, p_product_id: id }); if (!valid() || token !== generation) return; if (r.error || !r.data) throw r.error; measurements.value = { ...measurements.value, [id]: r.data } }
 catch { if (valid() && token === generation) editorError.value = ar.value ? 'تعذر تحميل وحدات المنتج. أعد فتح المسودة.' : 'Could not load product units. Reopen the draft.' }
 finally { if (valid() && token === generation) measurementPending.value = { ...measurementPending.value, [id]: false } }
}
function addLine(kind: 'product' | 'service') { if (frozen.value || saving.value || form.value.lines.length >= 100) return; form.value = { ...form.value, lines: [...form.value.lines, { key: crypto.randomUUID(), itemType: kind, sourceId: '', name: '', quantity: '1', unit: '', overridePrice: '', overrideReason: '' }] } }
async function source(key: string, id: string) {
 const line = form.value.lines.find(l => l.key === key); if (!line || frozen.value || saving.value) return
 const p = line.itemType === 'service' ? servicePicker : productPicker
 form.value = { ...form.value, lines: form.value.lines.map(l => l.key === key ? { ...l, sourceId: id, name: p.items.find(item => item.id === id)?.name || '', unit: '', overridePrice: '', overrideReason: '' } : l) }
 if (line.itemType === 'product') { await loadMeasurement(id); if (form.value.lines.some(l => l.key === key && l.sourceId === id)) form.value = { ...form.value, lines: form.value.lines.map(l => l.key === key ? { ...l, unit: unitOptions(id)[0]?.value || '' } : l) } }
}
watch(() => form.value.customerId, (value, previous) => { if (value !== previous && editorOpen.value && !frozen.value) form.value = { ...form.value, lines: form.value.lines.map(line => ({ ...line, overridePrice: '', overrideReason: '' })) } }, { flush: 'sync' })
watch(() => form.value.lines.map(line => `${line.key}:${line.unit}`), (values, previous) => { if (!editorOpen.value || frozen.value) return; const changed = new Set(values.filter((v, index) => previous[index] && previous[index] !== v).map(v => v.split(':')[0])); if (changed.size) form.value = { ...form.value, lines: form.value.lines.map(line => changed.has(line.key) ? { ...line, overridePrice: '', overrideReason: '' } : line) } }, { flush: 'sync' })
function open(id: string) { if (frozen.value || saving.value) return; detailId.value = id; historyPage.value = 1; displayVersion.value = null; reason.value = ''; actionError.value = ''; detailOpen.value = true }
function create() { if (!data.value?.canManage || frozen.value) return; form.value = blank(); editorError.value = ''; saveAction.value = 'save'; detailId.value = null; detailOpen.value = false; editorOpen.value = true; addLine(businessMode.value === 'service' ? 'service' : 'product') }
async function edit(revise = false) {
 const d = detail.value; if (!d || frozen.value || saving.value) return
 const valid = captureScope()
 const s = d.snapshot; editorError.value = ''; saveAction.value = revise ? 'revise' : 'save'
 form.value = { customerId: s.customerId, validUntil: localDate(revise ? new Date(Date.now() + 7 * 86400000).toISOString() : s.validUntil), projectReference: s.projectReference || '', notes: s.notes || '', orderDiscount: String(s.orderDiscount), reason: '', lines: s.lines.map(line => ({ key: crypto.randomUUID(), itemType: line.input.item_type, sourceId: line.input.source_id, name: line.name, quantity: String(line.input.quantity), unit: line.input.package_id ? `package:${line.input.package_id}:${line.input.package_version}` : `unit:${line.input.unit_code || 'ea'}`, overridePrice: line.input.override_price || '', overrideReason: line.input.override_reason || '' })) }
 await Promise.all(form.value.lines.filter(line => line.itemType === 'product').map(line => loadMeasurement(line.sourceId)))
 if (valid() && detail.value?.record.id === d.record.id) editorOpen.value = true
}
function inputs(): SaleLineInput[] { return form.value.lines.map(line => {
 const m = measurements.value[line.sourceId], [kind, code, version] = line.unit.split(':')
 return { item_type: line.itemType as 'product' | 'service', source_id: line.sourceId, quantity: line.quantity, ...(line.itemType === 'product' ? { measurement_revision: m?.revision, ...(kind === 'package' ? { package_id: code, package_version: Number(version) } : { unit_code: code || 'ea' }), ...(line.overridePrice !== '' ? { override_price: line.overridePrice, override_reason: line.overrideReason } : {}) } : {}) }
}) }
function failure(cause: unknown) { const message = String((cause as Error)?.message || ''); return message.includes('CONTEXT_CHANGED') || message.includes('EXPIRED_OR_CHANGED') ? ar.value ? 'تغير العرض أو انتهت صلاحيته. أعد تحميله قبل المتابعة.' : 'The quotation changed or expired. Reload it before continuing.' : ar.value ? 'تعذر حفظ الإجراء. راجع الصلاحيات والقيم.' : 'Could not save the action. Review permissions and values.' }
async function command(action: QuotationAction, values: QuotationValues | Record<string, never>, commandReason: string) {
 if (!currentId.value || !currentLocationId.value || saving.value) return
 const valid = captureScope()
 frozen.value ??= { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_action: action, p_quotation_id: detailId.value, p_revision: detail.value?.record.id === detailId.value ? detail.value.record.revision : 0, p_payload: values, p_reason: commandReason.trim() }
 saving.value = true; editorError.value = ''; actionError.value = ''
 try { const r = await rpc.rpc('trade_quotation_command', frozen.value); if (!valid()) return; if (r.error) { if (r.error.code && /^[0-9A-Z]{5}$/.test(r.error.code) && !r.error.code.startsWith('08')) frozen.value = null; throw r.error } if (!r.data) throw new Error('UNCONFIRMED_RESULT'); frozen.value = null; editorOpen.value = false; detailId.value = r.data.id; historyPage.value = 1; displayVersion.value = null; reason.value = ''; detailOpen.value = true; await Promise.all([refresh(), refreshDetail()]) }
 catch (cause) { if (valid()) { const message = frozen.value ? ar.value ? 'لم يتأكد الحفظ. أعد المحاولة بالطلب نفسه قبل تعديل القيم.' : 'Save is unconfirmed. Retry the same request before changing values.' : failure(cause); editorError.value = message; actionError.value = message } }
 finally { if (valid()) saving.value = false }
}
async function submit() {
 if (frozen.value) { await command(frozen.value.p_action, frozen.value.p_payload, frozen.value.p_reason); return }
 const f = form.value
 if (!f.customerId || !f.validUntil || Number.isNaN(new Date(f.validUntil).getTime()) || f.reason.trim().length < 3 || !/^\d{1,12}(\.\d{1,2})?$/.test(f.orderDiscount) || !f.lines.length || f.lines.some(line => !line.sourceId || !/^\d{1,12}(\.\d{1,6})?$/.test(line.quantity) || Number(line.quantity) <= 0 || line.itemType === 'product' && (!line.unit || !measurements.value[line.sourceId]))) { editorError.value = ar.value ? 'راجع العميل والصلاحية والبنود والسبب.' : 'Review customer, validity, items and reason.'; return }
 await command(saveAction.value, { customerId: f.customerId, validUntil: new Date(f.validUntil).toISOString(), projectReference: f.projectReference, notes: f.notes, orderDiscount: f.orderDiscount, lines: inputs() }, f.reason)
}
async function action(id: string) { if (frozen.value) { await command(frozen.value.p_action, frozen.value.p_payload, frozen.value.p_reason); return } if (reason.value.trim().length < 3) { actionError.value = ar.value ? 'أدخل سبب الإجراء.' : 'Enter the reason for this action.'; return } if (['issue','accept','reject','expire','cancel'].includes(id)) await command(id as QuotationAction, {}, reason.value) }
const detailLines = computed(() => (snapshot.value?.lines ?? []).map((line, index) => ({ id: String(index), name: line.name, quantity: line.measurement ? `${line.measurement.enteredQuantity} ${line.measurement.packageName || (ar.value ? line.measurement.unitNameAr : line.measurement.unitNameEn)} (${line.measurement.baseQuantity} ${unitName(line.measurement.baseUnitCode)})` : line.quantity, price: line.measurement ? `${line.measurement.enteredUnitPrice} ${snapshot.value?.currency}` : `${line.unitPrice} ${snapshot.value?.currency}`, total: money(line.total) })))
const view = computed<BsQuotationView>(() => {
 const d = detail.value, s = snapshot.value, currentVersion = !displayVersion.value || displayVersion.value.version === d?.record.version, status = d?.record.effective_status
 const actions: { id: string; label: string }[] = []
 if (currentVersion && d) { if (status === 'draft' && detailData.value?.canIssue) actions.push({ id: 'issue', label: ar.value ? 'إصدار العرض' : 'Issue quotation' }); if (status === 'issued') { if (detailData.value?.canIssue) actions.push({ id: 'accept', label: ar.value ? 'تسجيل قبول العميل' : 'Record customer acceptance' }); if (detailData.value?.canManage) actions.push({ id: 'reject', label: ar.value ? 'تسجيل رفض العميل' : 'Record customer rejection' }) } if (['draft','issued','accepted'].includes(status || '') && detailData.value?.canManage) actions.push({ id: 'cancel', label: ar.value ? 'إلغاء العرض' : 'Cancel quotation' }) }
 return { locked: !!frozen.value || saving.value, available: !!currentId.value && !!currentLocationId.value, loading: pending.value, error: error.value ? failure(error.value) : '', total: data.value?.total || 0, pageSize: 20, canCreate: !!data.value?.canManage, editor: { canProducts: businessMode.value !== 'service', canServices: businessMode.value !== 'product', title: copy.value.title, dirty: dirty.value, pending: saving.value || Object.values(measurementPending.value).some(Boolean), locked: !!frozen.value, error: editorError.value }, detail: { locked: !!frozen.value, actionError: actionError.value, loading: detailPending.value, error: detailError.value ? failure(detailError.value) : '', title: s ? `${s.quotationNumber} · ${copy.value.version} ${s.version}` : copy.value.title, subtitle: s ? `${s.customerName} · ${s.projectReference || ''} · ${copy.value.validity}: ${date(s.validUntil)}` : '', status: !currentVersion ? (ar.value ? 'إصدار سابق؛ راجع الإصدار الحالي قبل القبول أو التوريد.' : 'Historical version; review the current version before acceptance or supply.') : status ? labels.value[status] : '', notice: ar.value ? 'السجل المحفوظ لا يتغير مع الكتالوج. تعديل عرض صادر يتطلب إصدارًا جديدًا؛ لا يمكن قبول إصدار منتهي أو مستبدل.' : 'Saved history does not follow catalog changes. An issued offer needs an explicit new version; an expired or superseded version cannot be accepted.', pending: saving.value, reason: reason.value, canEdit: currentVersion && status === 'draft' && !!detailData.value?.canManage && !frozen.value, canRevise: currentVersion && ['issued','rejected','expired'].includes(status || '') && !!detailData.value?.canManage && !frozen.value, actions: frozen.value && !editorOpen.value ? [{ id: 'retry', label: copy.value.retry }] : actions, lines: detailLines.value, totals: s ? [{ label: copy.value.discount, value: money(s.orderDiscount) }, { label: ar.value ? 'الصافي' : 'Net', value: money(s.net) }, { label: ar.value ? 'الضرائب' : 'Taxes', value: money(s.tax) }, { label: copy.value.total, value: money(s.total) }, { label: copy.value.notes, value: s.notes || '' }] : [], history: (d?.versions || []).map(v => ({ id: String(v.version), version: String(v.version), status: '', reason: v.reason, actor: v.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), date: date(v.created_at), total: money(v.snapshot.total, v.snapshot.currency) })), events: (d?.events || []).map(e => ({ id: String(e.revision), version: String(e.version), status: labels.value[e.status as QuotationStatus] || e.status, reason: e.reason, actor: e.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), date: date(e.created_at), total: '' })), versionCount: d?.versionCount || 0, eventCount: d?.eventCount || 0 } }
})
function print() { const s = snapshot.value; if (!s) return; const markup = renderReportDocument([copy.value.lines, copy.value.quantity, copy.value.price, copy.value.total], detailLines.value.map(line => [line.name, line.quantity, line.price, line.total]), new Set([1,2,3]), { title: `${s.quotationNumber} · ${copy.value.version} ${s.version}`, organization: current.value?.name || '', currency: s.currency, generatedAt: date(new Date().toISOString()), direction: ar.value ? 'rtl' : 'ltr', labels: { organization: ar.value ? 'المتجر' : 'Shop', currency: ar.value ? 'العملة' : 'Currency', generatedAt: ar.value ? 'تاريخ الطباعة' : 'Printed at', warning: copy.value.status }, filters: [{ label: copy.value.customer, value: s.customerName }, { label: copy.value.project, value: s.projectReference || '' }, { label: copy.value.validity, value: date(s.validUntil) }, ...view.value.detail.totals], warning: view.value.detail.status }); const session = openPrintSession(markup); if (session) session.print(markup); else actionError.value = ar.value ? 'اسمح بفتح نافذة الطباعة وأعد المحاولة.' : 'Allow the print window and retry.' }
function historyVersion(id: string) { displayVersion.value = detail.value?.versions.find(v => String(v.version) === id)?.snapshot || null }
</script>
<template>
 <BsTradeQuotationsPage v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:editor-open="editorOpen" v-model:detail-open="detailOpen" v-model:form="form" v-model:reason="reason" :copy="copy" :view="view" :rows="rows" :customer-picker="customerChoices" :line-views="lineViews" @retry="refresh()" @retry-detail="refreshDetail()" @add="create" @open="open" @edit="edit()" @revise="edit(true)" @submit="submit" @action="action" @print="print" @version="historyVersion" @current-version="displayVersion = null" @add-line="addLine" @remove-line="key => { form = { ...form, lines: form.lines.filter(line => line.key !== key) } }" @source="source" @picker-search="(kind, query) => { if (kind in pickers) pickers[kind as keyof typeof pickers].query(query) }" @picker-more="kind => { if (kind in pickers) pickers[kind as keyof typeof pickers].more() }" @picker-retry="kind => { if (kind in pickers) pickers[kind as keyof typeof pickers].retry() }" />
</template>

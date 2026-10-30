import { normalizeDecimalText, openPrintSession } from '@building-suit/ux'
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import { renderReportDocument } from '@building-suit/ui/utils/reportDocument'
import type { BsSupplierOrderForm, BsSupplierOrderOperationForm, BsSupplierOrderPicker, BsSupplierOrderLineView, BsSupplierOrderRow, BsSupplierOrderView } from '@building-suit/ui/types/supplierOrderPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { SupplierOrderContext, SupplierOrderLine, SupplierOrderStatus, SupplierOrderValues } from '~/types/supplierOrders'
import type { ProductMeasurementOptions } from '~/types/measurement'
import { measurementUnits } from '~/utils/measurement'
import { supplierOrderCopy } from '~/utils/supplierOrderCopy'

type Functions = ShopRpcDatabase['public']['Functions']
type Command = { kind: 'order'; args: Functions['supplier_order_command']['Args'] } | { kind: 'receive'; args: Functions['receive_supplier_order']['Args'] }
const statuses: SupplierOrderStatus[] = ['draft','issued','partially_received','received','cancelled']
function readContext(value: SupplierOrderContext | null): SupplierOrderContext {
 const exact = (v: unknown) => typeof v === 'string' && /^[0-9]+(?:\.[0-9]+)?$/.test(v)
 if (!value || !Array.isArray(value.items) || typeof value.canManage !== 'boolean' || !Number.isSafeInteger(value.total)
  || value.items.some(row => !exact(row.estimated_total)) || (value.detail && (!value.detail.record || !exact(value.detail.record.estimated_total)
   || !Array.isArray(value.detail.lines) || !Array.isArray(value.detail.receipts) || !Array.isArray(value.detail.history)
   || value.detail.lines.some(line => ![line.quantity,line.entered_quantity,line.unit_cost,line.estimated_total,line.received_entered_quantity,line.remaining_entered_quantity].every(exact))
   || value.detail.receipts.some(receipt => !exact(receipt.total))))) throw new Error('INVALID_SUPPLIER_ORDER_RESPONSE')
 return value
}
export function useSupplierOrders() {
 const rpc = useShopClient<ShopRpcDatabase>().schema('public'), user = useSupabaseUser(), route = useRoute()
 const { currentId, currentLocationId, current, businessCurrency } = useShop(), { locale } = useI18n(), captureScope = useShopTaskScope()
 const ar = computed(() => locale.value === 'ar'), copy = computed(() => supplierOrderCopy(ar.value))
 const search = ref(''), term = ref(''), status = ref(''), page = ref(1), historyPage = ref(1), receiptPage = ref(1), selectedId = ref<string | null>(null)
 const detailOpen = ref(false), editorOpen = ref(false), operationOpen = ref(false), saving = ref(false), frozen = ref<Command | null>(null)
 const editorError = ref(''), operationError = ref(''), actionError = ref(''), editorContext = ref<{ id: string | null; revision: number }>({ id: null, revision: 0 })
 const operationContext = ref<{ id: string; revision: number; action: 'issue' | 'cancel' | 'receive'; summary: string } | null>(null)
 const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
 const blank = (): BsSupplierOrderForm => ({ vendorId: '', expectedOn: '', notes: '', reason: '', lines: [] })
 const blankOperation = (): BsSupplierOrderOperationForm => ({ reason: '', receivedOn: localToday(), invoiceNumber: '', lines: [] })
 const form = ref(blank()), operation = ref(blankOperation()), locked = computed(() => saving.value || !!frozen.value)
 const { dirty: editorDirty } = useRecordAction(() => form.value, editorOpen), { dirty: operationDirty } = useRecordAction(() => operation.value, operationOpen)
 const productPicker = reactive(usePurchaseEntityPicker('product')), supplierPicker = reactive(usePurchaseEntityPicker('supplier'))
 const pickers = { product: productPicker, supplier: supplierPicker }
 const measurements = ref<Record<string, ProductMeasurementOptions>>({}), measurementPending = ref<Record<string, boolean>>({})
 let generation = 0
 const empty = (): SupplierOrderContext => ({ items: [], total: 0, page: 1, pageSize: 20, detail: null, canManage: false })
 useDebouncedChange(search, value => { term.value = value.trim(); page.value = 1 }, 250)
 watch(status, () => { page.value = 1 })
 const { data, pending, error, refresh } = useShopQuery(() => `shop-data:supplier-orders:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${term.value}:${status.value}:${page.value}`, async () => {
  if (!currentId.value || !currentLocationId.value) return empty()
  const r = await rpc.rpc('supplier_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_search: term.value || null, p_status: (status.value || null) as SupplierOrderStatus | null, p_page: page.value })
  if (r.error) throw r.error
  return readContext(r.data)
 }, { default: empty })
 const { data: detailData, pending: detailPending, error: detailError, refresh: refreshDetail } = useShopQuery(() => `shop-data:supplier-order:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${selectedId.value}:${historyPage.value}:${receiptPage.value}`, async () => {
  if (!currentId.value || !currentLocationId.value || !selectedId.value) return empty()
  const r = await rpc.rpc('supplier_order_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: selectedId.value, p_history_page: historyPage.value, p_receipt_page: receiptPage.value })
  if (r.error) throw r.error
  return readContext(r.data)
 }, { default: empty })
 const detail = computed(() => detailData.value?.detail || null)
 const labels = computed<Record<SupplierOrderStatus,string>>(() => ar.value ? { draft: 'مسودة', issued: 'صادر', partially_received: 'مستلم جزئيًا', received: 'مستلم بالكامل', cancelled: 'ملغى' } : { draft: 'Draft', issued: 'Ordered', partially_received: 'Partly received', received: 'Fully received', cancelled: 'Cancelled' })
 const notice = computed(() => ar.value ? 'لا ينشئ أمر الشراء مخزونًا أو مبلغًا مستحقًا. تُسجّل الكميات المقبولة فقط في فواتير المورد والمخزون. تبقى المرتجعات مرتبطة بفواتير الاستلام ولا تعيد فتح الكمية المطلوبة تلقائيًا.' : 'An order creates no stock or amount payable. Only accepted quantities are posted to supplier invoices and stock. Returns stay linked to receiving invoices and do not automatically reopen the ordered quantity.')
 const receiptNotice = computed(() => ar.value ? 'أدخل الكمية المستلمة بوحدة الشراء المتفق عليها. لا تُقسّم العبوات الكاملة. لكل استلام فاتورته؛ تبقى الأسعار والعبوات المحفوظة كما صدرت في الأمر. إذا لم تدخل باركودًا للبكرات فسيُنشئ النظام معرفات لها.' : 'Enter the accepted quantity in the agreed purchase unit. Keep complete packages whole. Each receipt posts its own invoice at the retained order cost and package version. Source barcodes are generated when you leave reel barcodes empty.')
 const unitName = (code: string) => { const u = measurementUnits.find(unit => unit.code === code); return u ? ar.value ? u.nameAr : u.nameEn : code }
 const originalUnit = (line: SupplierOrderLine) => line.measurement_snapshot?.packageName || unitName(line.measurement_snapshot?.enteredUnitCode || 'ea')
 const money = (amount: string, currency: string) => formatPresentationMoney(amount, { currency, locale: ar.value ? 'ar-EG' : 'en-EG', numberingSystem: ar.value ? 'arab' : 'latn', unit: 'major' })
 const date = (value: string) => new Date(value).toLocaleString(locale.value)
 const day = (value: string | null) => value ? new Date(value+'T12:00:00').toLocaleDateString(locale.value) : '—'
 function failure(cause: unknown) {
  const text = String((cause as Error)?.message || '')
  if (/CONTEXT_CHANGED|MEASUREMENT_CHANGED|CURRENCY_CHANGED|PACKAGE_CONTEXT/.test(text)) return ar.value ? 'تغير الأمر أو وحدته أو العملة. حدّث البيانات ثم أغلق النموذج وافتحه من جديد.' : 'The order, unit or currency changed. Refresh the data, then close and reopen this form.'
  if (/EXCEEDS_ORDER|WHOLE_PACKAGE|MEASUREMENT|REEL|BARCODE/.test(text)) return ar.value ? 'راجع المتبقي ووحدة الشراء والعبوات وباركود مصادر البكرات. لم يُسجّل استلام جزئي من الطلب المرفوض.' : 'Review the remaining quantity, purchase unit, whole packages and source barcodes. The rejected request posted no partial receipt.'
  if (/PERIOD.*CLOSED|CLOSED.*PERIOD/.test(text)) return ar.value ? 'الفترة المالية مغلقة. اختر تاريخ استلام في فترة مفتوحة.' : 'The accounting period is closed. Choose a receipt date in an open period.'
  return ar.value ? 'تعذر تحميل أمر الشراء أو تسجيل الإجراء. راجع الصلاحيات والبيانات وحاول مجددًا.' : 'Could not load the purchase order or record this action. Check access and details, then retry.'
 }
 function picker(kind: keyof typeof pickers, selected?: { id: string; name: string }): BsSupplierOrderPicker { const p = pickers[kind]; return { options: p.options(selected), loading: p.pending, error: p.error, hasMore: p.hasMore, more: p.copy.more, retry: p.copy.retry } }
 const supplierChoices = computed(() => picker('supplier', detail.value && form.value.vendorId === detail.value.record.vendor_id ? { id: detail.value.record.vendor_id, name: detail.value.record.vendor_name } : undefined))
 function units(id: string) {
  const m = measurements.value[id]
  if (!m || m.status === 'prepared') return []
  if (m.status === 'legacy') return [{ value: 'legacy', label: unitName('ea') }]
  const dimension = measurementUnits.find(u => u.code === m.baseUnitCode)?.dimension
  return [...measurementUnits.filter(u => u.isActive && u.dimension === dimension && u.factor !== null).map(u => ({ value: `unit:${u.code}`, label: unitName(u.code) })), ...m.packages.filter(p => p.canPurchase).map(p => ({ value: `package:${p.id}:${p.version}`, label: `${p.name} (${p.baseQuantity} ${unitName(m.baseUnitCode)})` }))]
 }
 const lineViews = computed<BsSupplierOrderLineView[]>(() => form.value.lines.map(line => ({ loading: !!measurementPending.value[line.productId], units: units(line.productId), picker: picker('product', line.productId ? { id: line.productId, name: line.name } : undefined) })))
 async function loadMeasurement(id: string) {
  if (!currentId.value || !id || measurements.value[id] || measurementPending.value[id]) return
  const valid = captureScope(), token = generation; measurementPending.value = { ...measurementPending.value, [id]: true }
  try {
   const r = await rpc.rpc('product_measurement_options', { p_shop_id: currentId.value, p_product_id: id })
   if (!valid() || token !== generation) return
   if (r.error) throw r.error
   const m = r.data
   if (!m || !['legacy','active','prepared'].includes(m.status) || !Array.isArray(m.packages) || !Array.isArray(m.saleUnits) || !Number.isSafeInteger(m.revision)) throw new Error('INVALID_MEASUREMENT_OPTIONS')
   measurements.value = { ...measurements.value, [id]: m }
   if (m.status === 'prepared') editorError.value = ar.value ? 'أكمل إعداد وحدة مخزون هذا المنتج قبل طلبه.' : 'Complete this product’s stock-unit setup before ordering it.'
  } catch { if (valid() && token === generation) editorError.value = ar.value ? 'تعذر تحميل وحدات المنتج. أعد فتح المسودة وحاول مجددًا.' : 'Could not load product units. Reopen the draft and retry.' }
  finally { if (valid() && token === generation) measurementPending.value = { ...measurementPending.value, [id]: false } }
 }
 function addLine() { if (!locked.value && form.value.lines.length < 100) form.value = { ...form.value, lines: [...form.value.lines, { key: crypto.randomUUID(), productId: '', name: '', quantity: '1', cost: '', unit: '' }] } }
 async function source(key: string, id: string) {
  if (locked.value) return
  const valid = captureScope(), token = generation
  form.value = { ...form.value, lines: form.value.lines.map(line => line.key === key ? { ...line, productId: id, name: productPicker.items.find(p => p.id === id)?.name || '', quantity: '1', cost: '', unit: '' } : line) }
  await loadMeasurement(id)
  if (!valid() || token !== generation) return
  const m = measurements.value[id], pack = m?.packages.find(p => p.canPurchase && p.defaultPurchase)
  const unit = m?.status === 'legacy' ? 'legacy' : pack ? `package:${pack.id}:${pack.version}` : m?.status === 'active' ? `unit:${m.baseUnitCode}` : ''
  form.value = { ...form.value, lines: form.value.lines.map(line => line.key === key && line.productId === id && !line.unit ? { ...line, unit } : line) }
 }
 function open(id: string) { if (locked.value) return; selectedId.value = id; historyPage.value = 1; receiptPage.value = 1; actionError.value = ''; detailOpen.value = true }
 function create() {
  if (locked.value || !data.value?.canManage || error.value) return
  generation++; measurements.value = {}; measurementPending.value = {}; editorContext.value = { id: null, revision: 0 }; editorError.value = ''; form.value = blank(); addLine(); editorOpen.value = true
 }
 async function edit() {
  const d = detail.value
  if (locked.value || detailPending.value || detailError.value || !d?.canEdit) return
  generation++; measurements.value = {}; measurementPending.value = {}; editorContext.value = { id: d.record.id, revision: d.record.revision }; editorError.value = ''
  form.value = { vendorId: d.record.vendor_id, expectedOn: d.record.expected_on || '', notes: d.record.notes || '', reason: '', lines: d.lines.map(line => ({ key: crypto.randomUUID(), productId: line.product_id, name: line.product_name, quantity: String(line.original_input.quantity), cost: String(line.original_input.unit_cost), unit: line.original_input.package_id ? `package:${line.original_input.package_id}:${line.original_input.package_version}` : line.measurement_snapshot ? `unit:${line.original_input.unit_code}` : 'legacy' })) }
  editorOpen.value = true
  await Promise.all(form.value.lines.map(line => loadMeasurement(line.productId)))
 }
 function operate(action: 'issue' | 'cancel' | 'receive') {
  const d = detail.value
  if (locked.value || detailPending.value || detailError.value || !d || !(action === 'issue' ? d.canIssue : action === 'cancel' ? d.canCancel : d.canReceive)) return
  operationContext.value = { id: d.record.id, revision: d.record.revision, action, summary: `${d.record.order_number} · ${d.record.vendor_name} · ${money(d.record.estimated_total,d.record.currency)}` }
  operation.value = { ...blankOperation(), lines: action === 'receive' ? d.lines.filter(line => line.remaining_entered_quantity !== '0').map(line => ({ id: line.id, name: line.product_name, unit: originalUnit(line), remaining: line.remaining_entered_quantity, quantity: '', reelTracked: !!line.measurement_snapshot?.reelTracking, barcodes: '' })) : [] }
  operationError.value = ''; operationOpen.value = true
 }
 async function run(command: Command) {
  if (saving.value) return
  const valid = captureScope(); frozen.value ??= command
  const input = frozen.value; saving.value = true; editorError.value = ''; operationError.value = ''; actionError.value = ''; let confirmed = false
  try {
   const r = input.kind === 'order' ? await rpc.rpc('supplier_order_command', input.args) : await rpc.rpc('receive_supplier_order', input.args)
   if (!valid()) return
   if (r.error) { if (r.error.code && (/^[0-9A-Z]{5}$/.test(r.error.code) && !r.error.code.startsWith('08') || r.error.code === 'PGRST202')) frozen.value = null; throw r.error }
   if (!r.data || typeof r.data.id !== 'string' || !Number.isSafeInteger(r.data.revision) || !statuses.includes(r.data.status) || input.args.p_order_id && r.data.id !== input.args.p_order_id) throw new Error('UNCONFIRMED_RESULT')
   frozen.value = null; confirmed = true; selectedId.value = r.data.id; historyPage.value = 1; receiptPage.value = 1; detailOpen.value = true
   await nextTick()
   if (valid()) await Promise.all([refresh(), refreshDetail()])
  } catch (cause) {
   if (valid() && !confirmed) {
    const message = frozen.value ? ar.value ? 'لم تتأكد النتيجة. أعد محاولة الإجراء نفسه قبل تسجيل إجراء آخر.' : 'The result is unconfirmed. Retry the same action before recording another.' : failure(cause)
    editorError.value = message; operationError.value = message
    if (/CONTEXT_CHANGED/.test(String((cause as Error)?.message || ''))) void refreshDetail()
   }
  } finally { if (valid()) { saving.value = false; if (confirmed) { editorOpen.value = false; operationOpen.value = false } } }
 }
 async function submit() {
  if (frozen.value) { await run(frozen.value); return }
  if (!currentId.value || !currentLocationId.value || saving.value) return
  try {
   if (!form.value.vendorId || form.value.reason.trim().length < 3 || form.value.notes.length > 1000 || !form.value.lines.length || new Set(form.value.lines.map(line => line.productId)).size !== form.value.lines.length) throw new Error('INVALID_INPUT')
   if (form.value.expectedOn && !/^\d{4}-\d{2}-\d{2}$/.test(form.value.expectedOn)) throw new Error('INVALID_INPUT')
   const lines: SupplierOrderValues['lines'] = form.value.lines.map(line => {
    const m = measurements.value[line.productId], quantity = normalizeDecimalText(line.quantity), cost = normalizeDecimalText(line.cost), [kind,code,version] = line.unit.split(':')
    if (!m || measurementPending.value[line.productId] || !/^[0-9]{1,7}(?:\.[0-9]{1,6})?$/.test(quantity) || !/[1-9]/.test(quantity) || !/^[0-9]{1,9}(?:\.[0-9]{1,6})?$/.test(cost) || !units(line.productId).some(option => option.value === line.unit)) throw new Error('INVALID_INPUT')
    return { product_id: line.productId, quantity, unit_cost: cost, ...(m.status === 'legacy' ? {} : { measurement_revision: m.revision, ...(kind === 'package' ? { package_id: code, package_version: Number(version) } : { unit_code: code }) }) }
   })
   await run({ kind: 'order', args: { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_action: 'save', p_order_id: editorContext.value.id, p_revision: editorContext.value.revision, p_values: { vendorId: form.value.vendorId, expectedOn: form.value.expectedOn || null, notes: form.value.notes.trim(), lines }, p_reason: form.value.reason.trim() } })
  } catch { editorError.value = ar.value ? 'اختر المورد والمنتجات ووحدات الشراء، وأدخل كميات وتكاليف دقيقة وسبب الحفظ.' : 'Choose a supplier, products and purchase units, then enter exact quantities, costs and a save reason.' }
 }
 async function submitOperation() {
  if (frozen.value) { await run(frozen.value); return }
  const context = operationContext.value
  if (!context || !currentId.value || !currentLocationId.value || saving.value) return
  if (operation.value.reason.trim().length < 3) { operationError.value = ar.value ? 'أدخل سبب الإجراء.' : 'Enter a reason for this action.'; return }
  const base = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: context.id, p_revision: context.revision, p_reason: operation.value.reason.trim() }
  if (context.action !== 'receive') { await run({ kind: 'order', args: { ...base, p_action: context.action, p_values: {} } }); return }
  const lines = operation.value.lines.map(line => ({ ...line, quantity: normalizeDecimalText(line.quantity), identities: line.barcodes.split(/\r?\n/).map(value => value.trim()).filter(Boolean) }))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operation.value.receivedOn) || operation.value.invoiceNumber.length > 120 || lines.some(line => line.identities.length && (!line.quantity || !/[1-9]/.test(line.quantity))) || !lines.some(line => /[1-9]/.test(line.quantity))
   || lines.some(line => line.quantity && (!/^[0-9]{1,7}(?:\.[0-9]{1,6})?$/.test(line.quantity) || !/[1-9]/.test(line.quantity)) || line.identities.length > 1000 || line.identities.some(id => id.length > 80) || new Set(line.identities).size !== line.identities.length)) {
   operationError.value = ar.value ? 'أدخل كميات مستلمة دقيقة وتاريخًا صالحًا وباركودًا مستقلًا لكل بكرة عند إدخاله.' : 'Enter exact received quantities, a valid date and a distinct barcode for each reel when provided.'; return
  }
  await run({ kind: 'receive', args: { ...base, p_received_on: operation.value.receivedOn, p_invoice_number: operation.value.invoiceNumber.trim() || null, p_items: lines.filter(line => line.quantity !== '').map(line => ({ lineId: line.id, quantity: line.quantity, ...(line.identities.length ? { reel_barcodes: line.identities } : {}) })) } })
 }
 watch([currentId,currentLocationId,() => user.value?.id], () => { generation++; selectedId.value = null; detailOpen.value = false; editorOpen.value = false; operationOpen.value = false; frozen.value = null; saving.value = false; form.value = blank(); operation.value = blankOperation(); editorError.value = ''; operationError.value = ''; actionError.value = ''; measurements.value = {}; measurementPending.value = {}; page.value = 1; historyPage.value = 1; receiptPage.value = 1; search.value = ''; term.value = ''; status.value = '' }, { flush: 'sync' })
 watch(detailOpen, value => { if (!value && !editorOpen.value && !operationOpen.value && !locked.value) selectedId.value = null })
 watch(() => route.query.order, value => { if (typeof value === 'string' && !locked.value) open(value) }, { immediate: true })
 onScopeDispose(() => { generation++ })
 const rows = computed<BsSupplierOrderRow[]>(() => (data.value?.items || []).map(row => ({ id: row.id, number: row.order_number, vendor: row.vendor_name, status: labels.value[row.status], expected: day(row.expected_on), total: money(row.estimated_total,row.currency), date: date(row.created_at) })))
 const detailLines = computed(() => (detail.value?.lines || []).map(line => ({ id: line.id, name: line.product_name, quantity: `${line.entered_quantity} ${originalUnit(line)}`, cost: `${line.original_input.unit_cost} ${detail.value?.record.currency || ''} / ${originalUnit(line)}`, total: money(line.estimated_total,detail.value?.record.currency || 'EGP'), received: `${line.received_entered_quantity} ${originalUnit(line)}`, remaining: `${line.remaining_entered_quantity} ${originalUnit(line)}` })))
 const view = computed<BsSupplierOrderView>(() => {
  const d = detail.value, active = !!d && !detailPending.value && !detailError.value
  const actionLabel = (action: string) => ({ save: copy.value.save, issue: copy.value.issue, receive: copy.value.receive, cancel: copy.value.cancelOrder } as Record<string,string>)[action] || copy.value.actions
  return { available: !!currentId.value && !!currentLocationId.value, loading: pending.value, error: error.value ? failure(error.value) : '', canCreate: !pending.value && !error.value && !!data.value?.canManage, locked: locked.value, total: data.value?.total || 0, statusOptions: [{ value: '', label: copy.value.all }, ...statuses.map(value => ({ value, label: labels.value[value] }))],
   detail: { title: d?.record.order_number || '', loading: detailPending.value, error: detailError.value ? failure(detailError.value) : '', actionError: actionError.value, status: d ? labels.value[d.record.status] : '', notice: notice.value, fields: d ? [{ label: copy.value.vendor, value: d.record.vendor_name }, { label: copy.value.expected, value: day(d.record.expected_on) }, { label: copy.value.total, value: money(d.record.estimated_total,d.record.currency) }, { label: copy.value.notes, value: d.record.notes || '—' }] : [], canEdit: active && !!d?.canEdit, canIssue: active && !!d?.canIssue, canReceive: active && !!d?.canReceive, canCancel: active && !!d?.canCancel, canPrint: active, lines: detailLines.value,
    receipts: (d?.receipts || []).map(row => ({ id: row.id, invoice: row.invoice_number, to: `/purchases/${encodeURIComponent(row.invoice_id)}`, total: money(row.total,d?.record.currency || 'EGP'), date: date(row.issued_at), reason: row.reason, actor: row.actor_name || (ar.value ? 'عضو الفريق' : 'Team member') })), receiptTotal: d?.receiptTotal || 0,
    events: (d?.history || []).map(row => ({ id: row.id, action: actionLabel(row.action), reason: row.reason, actor: row.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), date: date(row.created_at) })), historyTotal: d?.historyTotal || 0 },
   editor: { title: editorContext.value.id ? copy.value.edit : copy.value.add, dirty: editorDirty.value, pending: saving.value, error: editorError.value, notice: `${businessCurrency.value} · ${notice.value}` },
   operation: { title: operationContext.value?.action === 'receive' ? copy.value.receive : operationContext.value?.action === 'cancel' ? copy.value.cancelOrder : copy.value.issue, dirty: operationDirty.value, pending: saving.value, error: operationError.value, isReceipt: operationContext.value?.action === 'receive', summary: operationContext.value?.summary || '', notice: operationContext.value?.action === 'receive' ? receiptNotice.value : notice.value } }
 })
 function print() {
  const d = detail.value
  if (!d || detailPending.value || detailError.value || locked.value) return
  const markup = renderReportDocument([copy.value.product,copy.value.quantity,copy.value.cost,copy.value.total,copy.value.received,copy.value.remaining],detailLines.value.map(line => [line.name,line.quantity,line.cost,line.total,line.received,line.remaining]),new Set([1,2,3,4,5]), { title: d.record.order_number, organization: current.value?.name || '', currency: d.record.currency, generatedAt: date(new Date().toISOString()), direction: ar.value ? 'rtl' : 'ltr', labels: { organization: ar.value ? 'المتجر' : 'Shop', currency: ar.value ? 'العملة' : 'Currency', generatedAt: ar.value ? 'تاريخ الطباعة' : 'Printed at', warning: copy.value.status }, filters: view.value.detail.fields, warning: `${labels.value[d.record.status]} · ${notice.value}` })
  const session = openPrintSession(markup)
  if (session) session.print(markup); else actionError.value = ar.value ? 'اسمح بنافذة الطباعة وحاول مجددًا.' : 'Allow the print window and retry.'
 }
 return { search,status,page,historyPage,receiptPage,editorOpen,detailOpen,operationOpen,form,operation,copy,view,rows,supplierChoices,lineViews,refresh,refreshDetail,create,open,edit,operate,submit,submitOperation,print,addLine,source,pickers,removeLine: (key: string) => { if (!locked.value) form.value = { ...form.value, lines: form.value.lines.filter(line => line.key !== key) } } }
}

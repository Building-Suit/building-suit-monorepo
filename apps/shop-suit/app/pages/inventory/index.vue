<script setup lang="ts">
import type { BsInventoryAdjustmentForm, BsInventoryCountForm, BsInventoryView, BsInventoryStockRow, BsInventoryMovementRow, BsInventoryCountRow } from '@building-suit/ui/types/inventoryPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { businessCurrency } = useShop()

defineOptions({ name: 'InventoryIndexPage' })
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type Access = { can_view: boolean; can_manage: boolean; inventory_enabled: boolean }
type StockRow = { product_id: string; name: string; sku: string | null; sale_price: number; is_active: boolean; reorder_threshold: number; quantity_on_hand: number; inventory_value: number; is_low_stock: boolean }
type StockPayload = { items: StockRow[]; total_valuation: number; low_stock_count: number }
type Movement = { id: string; event_at: string; quantity_change: number; value_change: number | null; source_type: string; reference: string; reason: string | null; actor_name: string | null }
type StockCount = { id: string; expected_quantity: number; counted_quantity: number; variance_quantity: number; reason: string; reference: string; counted_at: string; actor_name: string | null }
type Page<T> = { items: T[]; total: number }

const confirmation = useConfirmation()
const { success } = useToasts()
const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, loading: shopLoading } = useShop()
const ar = computed(() => locale.value === 'ar')
const lowOnly = ref(false)
const actionError = ref('')

const mode = ref<'receive' | 'writeoff'>('receive')
const productId = ref('')
const quantity = ref(1)
const unitCost = ref(0)
const reason = ref('')
const requestId = ref<string | null>(null)
const { visible: adjustmentOpen, pending: adjustmentPending, dirty: adjustmentDirty } = useRecordAction(() => ({ mode: mode.value, productId: productId.value, quantity: quantity.value, unitCost: unitCost.value, reason: reason.value }))

const countOpen = ref(false)
const countPending = ref(false)
const countProductId = ref('')
const countedQuantity = ref(0)
const countedAt = ref(localDateTime())
const countReason = ref('')
const countReference = ref('')
const countUnitCost = ref(0)
const countRequestId = ref<string | null>(null)

const thresholdOpen = ref(false)
const thresholdPending = ref(false)
const thresholdProductId = ref('')
const thresholdValue = ref(0)
const historyProductId = ref('')
const historyPage = ref(1)
const countsPage = ref(1)
const historyPageSize = 20
const { dirty: countDirty } = useRecordAction(() => ({ product: countProductId.value, quantity: countedQuantity.value, date: countedAt.value, reason: countReason.value, reference: countReference.value, cost: countUnitCost.value }), countOpen)
const { dirty: thresholdDirty } = useRecordAction(() => thresholdValue.value, thresholdOpen)
watch(historyProductId, () => { historyPage.value = 1; countsPage.value = 1 })
watch(currentId, () => { adjustmentOpen.value = false; countOpen.value = false; thresholdOpen.value = false; historyProductId.value = ''; actionError.value = '' })

const text = computed(() => ar.value ? {
  loading: 'جارٍ التحميل…', title: 'المخزون', subtitle: 'الجرد الفعلي، وتنبيهات إعادة الطلب، وسجل تصحيحات FIFO.', noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', dashboard: 'لوحة التحكم',
  denied: 'ليست لديك صلاحية عرض المخزون.', plan: 'تعديلات المخزون تتطلب اشتراكًا نشطًا يتيح إدارة المخزون.', loadError: 'تعذّر تحميل المخزون.', retry: 'إعادة المحاولة', all: 'كل المخزون', lowOnly: 'منخفض المخزون',
  totalValue: 'إجمالي قيمة المخزون', lowCount: 'منتجات منخفضة', product: 'المنتج', onHand: 'المتاح', threshold: 'حد إعادة الطلب', value: 'القيمة', actions: 'الإجراءات', low: 'منخفض', archived: 'مؤرشف',
  receive: 'استلام يدوي', writeoff: 'شطب', count: 'تسجيل جرد', history: 'السجل', setThreshold: 'تعديل الحد', noProducts: 'لا توجد منتجات مطابقة.', products: 'المنتجات', quantity: 'الكمية', unitCost: 'تكلفة الوحدة',
  reason: 'السبب', reference: 'المرجع', countedAt: 'وقت الجرد', expected: 'المتوقع', counted: 'المعدود', variance: 'الفرق', positiveCost: 'تكلفة وحدة الفرق الموجب', save: 'حفظ', saving: 'جاري الحفظ...', close: 'إغلاق',
  movements: 'حركات المخزون', counts: 'سجل الجرد', date: 'التاريخ', source: 'المصدر', actor: 'المنفذ', emptyHistory: 'لا يوجد سجل بعد.', archivedHint: 'يبقى المنتج المؤرشف ظاهرًا لحفظ المخزون والقيمة والسجل.',
  invalidAdjustment: 'أدخل كمية صحيحة حتى منزلتين وتكلفة غير سالبة وسببًا للشطب.', invalidCount: 'أدخل الكمية والسبب والمرجع؛ والفرق الموجب يحتاج تكلفة.', invalidThreshold: 'أدخل حدًا غير سالب حتى منزلتين.',
  insufficient: 'الكمية المطلوبة أكبر من المخزون.', conflict: 'استُخدم رقم الطلب ببيانات مختلفة.', confirmWriteoff: 'سيؤدي هذا الشطب إلى تقليل الكمية وقيمة المخزون وفق FIFO. تأكيد؟', confirmReceive: 'سيزيد هذا الاستلام اليدوي كمية المخزون وقيمته بتكلفة الوحدة المُدخلة. تأكيد؟', saved: 'تم حفظ تغيير المخزون.', confirmCount: 'سيتم تعديل المخزون بالفرق المعروض وتسجيل قيد جرد دائم. تأكيد؟',
  sources: { physical_count: 'جرد فعلي', manual_receipt: 'استلام يدوي', manual_writeoff: 'شطب يدوي', purchase_return: 'مرتجع شراء', sale: 'بيع', purchase_receipt: 'استلام شراء', adjustment: 'تصحيح', in: 'إضافة', out: 'صرف' },
} : {
  loading: 'Loading…', title: 'Inventory', subtitle: 'Physical counts, reorder alerts, and traceable FIFO corrections.', noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  denied: 'You do not have permission to view inventory.', plan: 'Inventory changes require an active subscription with inventory access.', loadError: 'Could not load inventory.', retry: 'Retry', all: 'All inventory', lowOnly: 'Low stock',
  totalValue: 'Inventory valuation', lowCount: 'Low-stock products', product: 'Product', onHand: 'On hand', threshold: 'Reorder threshold', value: 'Value', actions: 'Actions', low: 'Low stock', archived: 'Archived',
  receive: 'Manual receipt', writeoff: 'Write off', count: 'Record count', history: 'History', setThreshold: 'Set threshold', noProducts: 'No matching products.', products: 'Products', quantity: 'Quantity', unitCost: 'Unit cost',
  reason: 'Reason', reference: 'Reference', countedAt: 'Counted at', expected: 'Expected', counted: 'Counted', variance: 'Variance', positiveCost: 'Positive variance unit cost', save: 'Save', saving: 'Saving...', close: 'Close',
  movements: 'Inventory movements', counts: 'Count history', date: 'Date', source: 'Source', actor: 'Actor', emptyHistory: 'No history yet.', archivedHint: 'Archived products remain visible to preserve stock, valuation, and history.',
  invalidAdjustment: 'Enter a valid quantity with up to two decimals, nonnegative cost, and a write-off reason.', invalidCount: 'Enter the count, reason, and reference; a positive variance needs unit cost.', invalidThreshold: 'Enter a nonnegative threshold with up to two decimals.',
  insufficient: 'The requested quantity exceeds stock.', conflict: 'The request key was used with different data.', confirmWriteoff: 'This write-off reduces stock quantity and FIFO value. Confirm?', confirmReceive: 'This manual receipt increases stock quantity and inventory value at the entered unit cost. Confirm?', saved: 'Inventory change saved.', confirmCount: 'Stock will change by the displayed variance and a permanent count record will be created. Confirm?',
  sources: { physical_count: 'Physical count', manual_receipt: 'Manual receipt', manual_writeoff: 'Manual write-off', purchase_return: 'Purchase return', sale: 'Sale', purchase_receipt: 'Purchase receipt', adjustment: 'Correction', in: 'Stock in', out: 'Stock out' },
})

const { data: access, pending: accessPending, error: accessError, refresh: refreshAccess } = await useAsyncData('shop-data:inventory-access', async () => {
  if (!currentId.value) return null
  const { data, error } = await rpc.rpc('inventory_access', { p_shop_id: currentId.value })
  if (error) throw error
  return (data?.[0] ?? null) as Access | null
}, { watch: [currentId], default: () => null })

const { data: stock, pending, error, refresh } = useAsyncData('shop-data:inventory-overview', async () => {
  if (!currentId.value || !access.value?.can_view) return emptyStock()
  const result = await rpc.rpc('list_inventory', { p_shop_id: currentId.value, p_low_stock_only: lowOnly.value })
  if (result.error) throw result.error
  return (result.data ?? emptyStock()) as StockPayload
}, { watch: [currentId, lowOnly, access], default: emptyStock })

const { data: movements, pending: historyPending, error: historyError, refresh: refreshHistory } = useAsyncData(() => `shop-data:inventory-history:${currentId.value ?? 'none'}:${historyProductId.value}:${historyPage.value}`, async () => {
  if (!currentId.value || !historyProductId.value) return emptyPage<Movement>()
  const result = await rpc.rpc('list_inventory_history', { p_shop_id: currentId.value, p_product_id: historyProductId.value, p_page: historyPage.value, p_page_size: historyPageSize })
  if (result.error) throw result.error
  return (result.data ?? emptyPage<Movement>()) as Page<Movement>
}, { watch: [currentId, historyProductId, historyPage], default: () => emptyPage<Movement>() })

const { data: counts, pending: countsPending, error: countsError, refresh: refreshCounts } = useAsyncData(() => `shop-data:stock-count-history:${currentId.value ?? 'none'}:${historyProductId.value}:${countsPage.value}`, async () => {
  if (!currentId.value || !historyProductId.value) return emptyPage<StockCount>()
  const result = await rpc.rpc('list_stock_counts', { p_shop_id: currentId.value, p_product_id: historyProductId.value, p_page: countsPage.value, p_page_size: historyPageSize })
  if (result.error) throw result.error
  return (result.data ?? emptyPage<StockCount>()) as Page<StockCount>
}, { watch: [currentId, historyProductId, countsPage], default: () => emptyPage<StockCount>() })

const activeStock = computed(() => stock.value.items.filter(row => row.is_active))
const countProduct = computed(() => stock.value.items.find(row => row.product_id === countProductId.value) ?? null)
const historyProduct = computed(() => stock.value.items.find(row => row.product_id === historyProductId.value) ?? null)
const variance = computed(() => Number(countedQuantity.value) - Number(countProduct.value?.quantity_on_hand ?? 0))

watch([mode, productId, quantity, unitCost, reason, currentId], () => { requestId.value = null; actionError.value = '' })
watch([countProductId, countedQuantity, countedAt, countReason, countReference, countUnitCost, currentId], () => { countRequestId.value = null; actionError.value = '' })
watch(activeStock, rows => { if (!rows.some(row => row.product_id === productId.value)) productId.value = rows[0]?.product_id ?? '' }, { immediate: true })

function emptyStock(): StockPayload { return { items: [], total_valuation: 0, low_stock_count: 0 } }
function emptyPage<T>(): Page<T> { return { items: [], total: 0 } }
function localDateTime() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16) }
function validNumber(value: number, minimum = 0) { const number = Number(value); return Number.isFinite(number) && number >= minimum && number <= 1000000 && Math.abs(Math.round(number * 100) - number * 100) < 0.000001 }
function readableError(message?: string) { if (message === 'INSUFFICIENT_STOCK') return text.value.insufficient; if (message === 'STOCK_REQUEST_CONFLICT' || message === 'STOCK_COUNT_REQUEST_CONFLICT') return text.value.conflict; if (message === 'INVENTORY_NOT_IN_PLAN') return text.value.plan; return text.value.loadError }
function money(value: number) { return new Intl.NumberFormat(ar.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(Number(value)) }
function date(value: string) { return new Intl.DateTimeFormat(ar.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) }
function source(value: string) { return text.value.sources[value as keyof typeof text.value.sources] ?? value }
function openAdjustment(next: 'receive' | 'writeoff') { mode.value = next; productId.value = activeStock.value[0]?.product_id ?? ''; actionError.value = ''; adjustmentOpen.value = true }
function openCount(row: StockRow) { countProductId.value = row.product_id; countedQuantity.value = Number(row.quantity_on_hand); countedAt.value = localDateTime(); countReason.value = ''; countReference.value = ''; countUnitCost.value = 0; actionError.value = ''; countOpen.value = true }
function openThreshold(row: StockRow) { thresholdProductId.value = row.product_id; thresholdValue.value = Number(row.reorder_threshold); actionError.value = ''; thresholdOpen.value = true }
async function refreshAll() { await refresh(); if (historyProductId.value) await Promise.all([refreshHistory(), refreshCounts()]) }

async function saveAdjustment() {
  if (!currentId.value || !access.value?.can_manage || !access.value.inventory_enabled || adjustmentPending.value) return
  const amount = Number(quantity.value); const cost = Number(unitCost.value)
  if (!productId.value || !validNumber(amount, 0.01) || (mode.value === 'receive' && (!Number.isFinite(cost) || cost < 0)) || (mode.value === 'writeoff' && reason.value.trim().length < 3)) { actionError.value = text.value.invalidAdjustment; return }
  if (!await confirmation.ask(mode.value === 'writeoff' ? text.value.confirmWriteoff : text.value.confirmReceive)) return
  requestId.value ||= crypto.randomUUID(); actionError.value = ''; adjustmentPending.value = true
  try {
    const result = await rpc.rpc('adjust_stock', { p_request_id: requestId.value, p_shop_id: currentId.value, p_product_id: productId.value, p_quantity_change: mode.value === 'receive' ? amount : -amount, p_unit_cost: mode.value === 'receive' ? cost : null, p_note: reason.value.trim() || null })
    if (result.error) throw result.error
    requestId.value = null; quantity.value = 1; unitCost.value = 0; reason.value = ''; adjustmentOpen.value = false; await refreshAll(); success(text.value.saved)
  } catch (error) { actionError.value = readableError(error instanceof Error ? error.message : undefined) } finally { adjustmentPending.value = false }
}

async function saveCount() {
  if (!currentId.value || !countProduct.value || !access.value?.can_manage || !access.value.inventory_enabled || countPending.value) return
  const amount = Number(countedQuantity.value); const cost = Number(countUnitCost.value)
  if (!validNumber(amount) || countReason.value.trim().length < 3 || !countReference.value.trim() || Number.isNaN(new Date(countedAt.value).getTime()) || (variance.value > 0 && (!Number.isFinite(cost) || cost < 0))) { actionError.value = text.value.invalidCount; return }
  if (!await confirmation.ask(text.value.confirmCount)) return
  countRequestId.value ||= crypto.randomUUID(); actionError.value = ''; countPending.value = true
  try {
    const result = await rpc.rpc('record_stock_count', { p_request_id: countRequestId.value, p_shop_id: currentId.value, p_product_id: countProduct.value.product_id, p_counted_quantity: amount, p_counted_at: new Date(countedAt.value).toISOString(), p_reason: countReason.value.trim(), p_reference: countReference.value.trim(), p_positive_variance_unit_cost: variance.value > 0 ? cost : null })
    if (result.error) throw result.error
    countRequestId.value = null; countOpen.value = false; await refreshAll(); success(text.value.saved)
  } catch (error) { actionError.value = readableError(error instanceof Error ? error.message : undefined) } finally { countPending.value = false }
}

async function saveThreshold() {
  if (!currentId.value || !thresholdProductId.value || !access.value?.can_manage || !access.value.inventory_enabled || thresholdPending.value) return
  const value = Number(thresholdValue.value); if (!validNumber(value)) { actionError.value = text.value.invalidThreshold; return }
  actionError.value = ''; thresholdPending.value = true
  try { const result = await rpc.rpc('set_reorder_threshold', { p_shop_id: currentId.value, p_product_id: thresholdProductId.value, p_threshold: value }); if (result.error) throw result.error; thresholdOpen.value = false; await refreshAll(); success(text.value.saved) }
  catch (error) { actionError.value = readableError(error instanceof Error ? error.message : undefined) } finally { thresholdPending.value = false }
}

useShopRealtime('inventory', () => adjustmentDirty.value || countDirty.value || thresholdDirty.value)

const inventoryAdjustmentForm = computed<BsInventoryAdjustmentForm>({ get: () => ({ productId: productId.value, quantity: quantity.value, unitCost: unitCost.value, reason: reason.value }), set: value => { productId.value = value.productId; quantity.value = value.quantity; unitCost.value = value.unitCost; reason.value = value.reason } })
const inventoryCountForm = computed<BsInventoryCountForm>({ get: () => ({ quantity: countedQuantity.value, date: countedAt.value, unitCost: countUnitCost.value, reference: countReference.value, reason: countReason.value }), set: value => { countedQuantity.value = value.quantity; countedAt.value = value.date; countUnitCost.value = value.unitCost; countReference.value = value.reference; countReason.value = value.reason } })
const inventoryView = computed<BsInventoryView>(() => ({ available: !!current.value, loadingContext: shopLoading.value, accessError: !!accessError.value, accessLoading: accessPending.value, canView: !!access.value?.can_view, planNotice: !!access.value?.can_manage && !access.value.inventory_enabled, canAdjust: !!access.value?.can_manage && !!access.value.inventory_enabled && !!activeStock.value.length, valuation: money(stock.value.total_valuation), lowCount: String(stock.value.low_stock_count), loading: pending.value, error: error.value ? text.value.loadError : '', actionError: actionError.value, historyName: historyProduct.value?.name ?? '', historyError: !!historyError.value || !!countsError.value, movementsLoading: historyPending.value, movementsTotal: movements.value.total, countsLoading: countsPending.value, countsTotal: counts.value.total, historyPageSize, adjustmentTitle: mode.value === 'receive' ? text.value.receive : text.value.writeoff, receive: mode.value === 'receive', countProduct: countProduct.value?.name ?? '', countExpected: String(Number(countProduct.value?.quantity_on_hand ?? 0)), countVariance: String(variance.value), positiveVariance: variance.value > 0 }))
const inventoryRows = computed<BsInventoryStockRow[]>(() => stock.value.items.map(row => ({ id: row.product_id, name: row.name, sku: row.sku ?? '', archived: !row.is_active, quantity: String(Number(row.quantity_on_hand)), threshold: String(Number(row.reorder_threshold)), value: money(row.inventory_value), low: row.is_low_stock, canCount: !!access.value?.can_manage && !!access.value.inventory_enabled, canThreshold: row.is_active && !!access.value?.can_manage && !!access.value.inventory_enabled })))
const movementRows = computed<BsInventoryMovementRow[]>(() => movements.value.items.map(event => ({ id: event.id, date: date(event.event_at), source: source(event.source_type), reference: event.reference, reason: event.reason ?? '', quantity: String(Number(event.quantity_change)), value: event.value_change == null ? '—' : money(event.value_change), actor: event.actor_name || '—' })))
const countRows = computed<BsInventoryCountRow[]>(() => counts.value.items.map(event => ({ id: event.id, date: date(event.counted_at), reference: event.reference, reason: event.reason, expected: String(Number(event.expected_quantity)), counted: String(Number(event.counted_quantity)), variance: String(Number(event.variance_quantity)) })))
const inventoryProductOptions = computed(() => activeStock.value.map(row => ({ id: row.product_id, name: row.name })))
function countById(id: string) { const row = stock.value.items.find(item => item.product_id === id); if (row) openCount(row) }
function thresholdById(id: string) { const row = stock.value.items.find(item => item.product_id === id); if (row) openThreshold(row) }
async function retryInventoryHistory() { await Promise.all([refreshHistory(), refreshCounts()]) }
</script>

<template>
  <BsInventoryManagementPage v-model:adjustment-form="inventoryAdjustmentForm" v-model:count-form="inventoryCountForm" v-model:threshold-value="thresholdValue" v-model:low-only="lowOnly" v-model:adjustment-open="adjustmentOpen" v-model:count-open="countOpen" v-model:threshold-open="thresholdOpen" v-model:history-product-id="historyProductId" v-model:history-page="historyPage" v-model:counts-page="countsPage" :text="text" :view="inventoryView" :rows="inventoryRows" :movement-rows="movementRows" :count-rows="countRows" :product-options="inventoryProductOptions" :adjustment-editor="{ dirty: adjustmentDirty, pending: adjustmentPending }" :count-editor="{ dirty: countDirty, pending: countPending }" :threshold-editor="{ dirty: thresholdDirty, pending: thresholdPending }" @retry-access="refreshAccess" @retry="refresh" @retry-history="retryInventoryHistory" @save-adjustment="saveAdjustment" @save-count="saveCount" @save-threshold="saveThreshold" @count="countById" @threshold="thresholdById" @adjust="openAdjustment" />
</template>

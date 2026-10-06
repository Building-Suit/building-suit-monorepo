<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

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
  denied: 'ليست لديك صلاحية عرض المخزون.', plan: 'تعديلات المخزون تتطلب خطة Pro نشطة.', loadError: 'تعذّر تحميل المخزون.', retry: 'إعادة المحاولة', all: 'كل المخزون', lowOnly: 'منخفض المخزون',
  totalValue: 'إجمالي قيمة المخزون', lowCount: 'منتجات منخفضة', product: 'المنتج', onHand: 'المتاح', threshold: 'حد إعادة الطلب', value: 'القيمة', actions: 'الإجراءات', low: 'منخفض', archived: 'مؤرشف',
  receive: 'استلام يدوي', writeoff: 'شطب', count: 'تسجيل جرد', history: 'السجل', setThreshold: 'تعديل الحد', noProducts: 'لا توجد منتجات مطابقة.', products: 'المنتجات', quantity: 'الكمية', unitCost: 'تكلفة الوحدة',
  reason: 'السبب', reference: 'المرجع', countedAt: 'وقت الجرد', expected: 'المتوقع', counted: 'المعدود', variance: 'الفرق', positiveCost: 'تكلفة وحدة الفرق الموجب', save: 'حفظ', saving: 'جاري الحفظ...', close: 'إغلاق',
  movements: 'حركات المخزون', counts: 'سجل الجرد', date: 'التاريخ', source: 'المصدر', actor: 'المنفذ', emptyHistory: 'لا يوجد سجل بعد.', archivedHint: 'يبقى المنتج المؤرشف ظاهرًا لحفظ المخزون والقيمة والسجل.',
  invalidAdjustment: 'أدخل كمية صحيحة حتى منزلتين وتكلفة غير سالبة وسببًا للشطب.', invalidCount: 'أدخل الكمية والسبب والمرجع؛ والفرق الموجب يحتاج تكلفة.', invalidThreshold: 'أدخل حدًا غير سالب حتى منزلتين.',
  insufficient: 'الكمية المطلوبة أكبر من المخزون.', conflict: 'استُخدم رقم الطلب ببيانات مختلفة.', confirmWriteoff: 'سيؤدي هذا الشطب إلى تقليل الكمية وقيمة المخزون وفق FIFO. تأكيد؟', confirmReceive: 'سيزيد هذا الاستلام اليدوي كمية المخزون وقيمته بتكلفة الوحدة المُدخلة. تأكيد؟', saved: 'تم حفظ تغيير المخزون.', confirmCount: 'سيتم تعديل المخزون بالفرق المعروض وتسجيل قيد جرد دائم. تأكيد؟',
  sources: { physical_count: 'جرد فعلي', manual_receipt: 'استلام يدوي', manual_writeoff: 'شطب يدوي', purchase_return: 'مرتجع شراء', sale: 'بيع', purchase_receipt: 'استلام شراء', adjustment: 'تصحيح', in: 'إضافة', out: 'صرف' },
} : {
  loading: 'Loading…', title: 'Inventory', subtitle: 'Physical counts, reorder alerts, and traceable FIFO corrections.', noShop: 'Create a shop from the dashboard first.', dashboard: 'Dashboard',
  denied: 'You do not have permission to view inventory.', plan: 'Inventory changes require an active Pro plan.', loadError: 'Could not load inventory.', retry: 'Retry', all: 'All inventory', lowOnly: 'Low stock',
  totalValue: 'Inventory valuation', lowCount: 'Low-stock products', product: 'Product', onHand: 'On hand', threshold: 'Reorder threshold', value: 'Value', actions: 'Actions', low: 'Low stock', archived: 'Archived',
  receive: 'Manual receipt', writeoff: 'Write off', count: 'Record count', history: 'History', setThreshold: 'Set threshold', noProducts: 'No matching products.', products: 'Products', quantity: 'Quantity', unitCost: 'Unit cost',
  reason: 'Reason', reference: 'Reference', countedAt: 'Counted at', expected: 'Expected', counted: 'Counted', variance: 'Variance', positiveCost: 'Positive variance unit cost', save: 'Save', saving: 'Saving...', close: 'Close',
  movements: 'Inventory movements', counts: 'Count history', date: 'Date', source: 'Source', actor: 'Actor', emptyHistory: 'No history yet.', archivedHint: 'Archived products remain visible to preserve stock, valuation, and history.',
  invalidAdjustment: 'Enter a valid quantity with up to two decimals, nonnegative cost, and a write-off reason.', invalidCount: 'Enter the count, reason, and reference; a positive variance needs unit cost.', invalidThreshold: 'Enter a nonnegative threshold with up to two decimals.',
  insufficient: 'The requested quantity exceeds stock.', conflict: 'The request key was used with different data.', confirmWriteoff: 'This write-off reduces stock quantity and FIFO value. Confirm?', confirmReceive: 'This manual receipt increases stock quantity and inventory value at the entered unit cost. Confirm?', saved: 'Inventory change saved.', confirmCount: 'Stock will change by the displayed variance and a permanent count record will be created. Confirm?',
  sources: { physical_count: 'Physical count', manual_receipt: 'Manual receipt', manual_writeoff: 'Manual write-off', purchase_return: 'Purchase return', sale: 'Sale', purchase_receipt: 'Purchase receipt', adjustment: 'Correction', in: 'Stock in', out: 'Stock out' },
})

const { data: access, pending: accessPending, error: accessError, refresh: refreshAccess } = useAsyncData('shop-data:inventory-access', async () => {
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
function money(value: number) { return new Intl.NumberFormat(ar.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value)) }
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
</script>

<template>
  <BsStack>
    <BsBox as="header">
      <BsHeading :level="1">{{ text.title }}</BsHeading>
      <BsText as="p" size="sm" tone="muted">{{ text.subtitle }}</BsText>
    </BsBox>
    <BsPanel v-if="!current && !shopLoading" padding="md">
      <BsText as="p">{{ text.noShop }}</BsText>
      <BsLink to="/dashboard">{{ text.dashboard }}</BsLink>
    </BsPanel>
    <template v-else-if="current">
      <BsText v-if="accessError" role="alert" as="p" size="sm" tone="danger">{{ text.denied }} <BsButton variant="link" @click="refreshAccess()">{{ text.retry }}</BsButton>
      </BsText>
      <BsText v-else-if="accessPending" role="status" as="p">{{ text.loading }}</BsText>
      <BsText v-else-if="!access?.can_view" role="alert" as="p">{{ text.denied }}</BsText>
      <template v-else>
        <BsText v-if="access?.can_manage && !access.inventory_enabled" as="p" size="sm" tone="warning">{{ text.plan }}</BsText>
        <BsGrid :columns="2">
          <BsPanel padding="md">
            <BsText as="p" size="sm" tone="muted">{{ text.totalValue }}</BsText>
            <BsText as="p" size="lg" emphasis="semibold">{{ money(stock.total_valuation) }}</BsText>
          </BsPanel>
          <BsPanel padding="md">
            <BsText as="p" size="sm" tone="muted">{{ text.lowCount }}</BsText>
            <BsText as="p" size="lg" emphasis="semibold">{{ stock.low_stock_count }}</BsText>
          </BsPanel>
        </BsGrid>
        <BsInline justify="between">
          <BsInline>
            <BsButton variant="chip" :aria-pressed="!lowOnly" @click="lowOnly = false">{{ text.all }}</BsButton>
            <BsButton variant="chip" :aria-pressed="lowOnly" @click="lowOnly = true">{{ text.lowOnly }}</BsButton>
          </BsInline>
          <BsInline v-if="access?.can_manage && access.inventory_enabled && activeStock.length">
            <BsButton @click="openAdjustment('receive')">{{ text.receive }}</BsButton>
            <BsButton @click="openAdjustment('writeoff')">{{ text.writeoff }}</BsButton>
          </BsInline>
        </BsInline>
        <BsPanel padding="md">
          <BsDataTable :value="stock.items" paginator :rows="20" data-key="product_id" :loading="pending" :error="error ? text.loadError : null" :label="text.title" :columns="[{ key: 'column0', header: (text.product) }, { key: 'column1', header: (text.onHand), align: 'end' }, { key: 'column2', header: (text.threshold), align: 'end' }, { key: 'column3', header: (text.value), align: 'end' }, { key: 'column4', header: (text.actions), align: 'end' }]" @retry="refresh()">
            <template #cell-column0="{ row: row }">
              <BsText as="p" emphasis="semibold">{{ row.name }} <BsText v-if="!row.is_active" as="span" size="xs" tone="muted">({{ text.archived }})</BsText>
              </BsText>
              <BsText v-if="row.sku" as="p" size="xs" tone="muted">{{ row.sku }}</BsText>
            </template>
            <template #cell-column1="{ row: row }">
              <BsText as="span">{{ Number(row.quantity_on_hand) }}</BsText>
              <BsText v-if="row.is_low_stock" as="span" size="xs">{{ text.low }}</BsText>
            </template>
            <template #cell-column2="{ row: row }">{{ Number(row.reorder_threshold) }}</template>
            <template #cell-column3="{ row: row }">{{ money(row.inventory_value) }}</template>
            <template #cell-column4="{ row: row }">
              <BsText as="span">
                <BsButton variant="link" @click="historyProductId = row.product_id">{{ text.history }}</BsButton>
                <BsButton v-if="access?.can_manage && access.inventory_enabled" variant="link" @click="openCount(row)">{{ text.count }}</BsButton>
                <BsButton v-if="row.is_active && access?.can_manage && access.inventory_enabled" variant="link" @click="openThreshold(row)">{{ text.setThreshold }}</BsButton>
              </BsText>
            </template>
            <template #empty>
              <BsBox padding="md">
                <BsText as="p">{{ text.noProducts }}</BsText>
                <BsLink to="/products">{{ text.products }}</BsLink>
              </BsBox>
            </template>
          </BsDataTable>
        </BsPanel>
        <BsText as="p" size="xs" tone="muted">{{ text.archivedHint }}</BsText>
        <BsPanel v-if="historyProduct" padding="md">
          <BsInline justify="between">
            <BsBox>
              <BsHeading :level="2">{{ historyProduct.name }}</BsHeading>
              <BsText as="p" size="sm" tone="muted">{{ text.history }}</BsText>
            </BsBox>
            <BsButton @click="historyProductId = ''">{{ text.close }}</BsButton>
          </BsInline>
          <BsText v-if="historyError || countsError" role="alert" as="p" size="sm">{{ text.loadError }} <BsButton variant="link" @click="refreshHistory(); refreshCounts()">{{ text.retry }}</BsButton>
          </BsText>
          <BsBox scroll="x">
            <BsHeading :level="3">{{ text.movements }}</BsHeading>
            <BsDataTable :value="movements.items" :label="text.movements" lazy paginator :rows="historyPageSize" :first="(historyPage - 1) * historyPageSize" :total-records="movements.total" :loading="historyPending" data-key="id" :columns="[{ key: 'column0', header: (text.date) }, { key: 'column1', header: (text.source) }, { key: 'column2', header: (text.quantity), align: 'end' }, { key: 'column3', header: (text.value), align: 'end' }, { key: 'column4', header: (text.actor) }]" @page="historyPage = $event.page + 1">
              <template #cell-column0="{ row: event }">{{ date(event.event_at) }}</template>
              <template #cell-column1="{ row: event }">
                <BsText as="p" emphasis="semibold">{{ source(event.source_type) }}</BsText>
                <BsText as="p" size="xs" tone="muted">{{ event.reference }}<template v-if="event.reason"> · {{ event.reason }}</template>
                </BsText>
              </template>
              <template #cell-column2="{ row: event }">{{ Number(event.quantity_change) }}</template>
              <template #cell-column3="{ row: event }">{{ event.value_change == null ? '—' : money(event.value_change) }}</template>
              <template #cell-column4="{ row: event }">{{ event.actor_name || '—' }}</template>
              <template #empty>
                <BsText as="p" size="sm" tone="muted">{{ text.emptyHistory }}</BsText>
              </template>
            </BsDataTable>
          </BsBox>
          <BsBox scroll="x">
            <BsHeading :level="3">{{ text.counts }}</BsHeading>
            <BsDataTable :value="counts.items" :label="text.counts" :loading="countsPending" lazy paginator :rows="historyPageSize" :first="(countsPage - 1) * historyPageSize" :total-records="counts.total" data-key="id" :columns="[{ key: 'column0', header: (text.date) }, { key: 'column1', header: (text.reference) }, { key: 'column2', header: (text.expected), align: 'end' }, { key: 'column3', header: (text.counted), align: 'end' }, { key: 'column4', header: (text.variance), align: 'end' }]" @page="countsPage = $event.page + 1">
              <template #cell-column0="{ row: event }">{{ date(event.counted_at) }}</template>
              <template #cell-column1="{ row: event }">
                <BsText as="p" emphasis="semibold">{{ event.reference }}</BsText>
                <BsText as="p" size="xs" tone="muted">{{ event.reason }}</BsText>
              </template>
              <template #cell-column2="{ row: event }">{{ Number(event.expected_quantity) }}</template>
              <template #cell-column3="{ row: event }">{{ Number(event.counted_quantity) }}</template>
              <template #cell-column4="{ row: event }">{{ Number(event.variance_quantity) }}</template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
    </template>
    <BsRecordActionDialog v-model:visible="adjustmentOpen" :title="mode === 'receive' ? text.receive : text.writeoff" :dirty="adjustmentDirty" :pending="adjustmentPending" :error="actionError" :submit-label="text.save" @submit="saveAdjustment">
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="text.product">
          <BsSelect v-model="productId" :input-id="field.id" :aria-describedby="field.describedby" :label="text.product" :options="activeStock" option-label="name" option-value="product_id" filter virtual :aria-required="true" :disabled="adjustmentPending"/>
        </BsField>
        <BsField v-slot="field" :label="text.quantity">
          <BsInput :id="field.id" v-model.number="quantity" :aria-describedby="field.describedby" type="number" :min="0.01" :max="1000000" :step="0.01" required/>
        </BsField>
        <BsField v-if="mode === 'receive'" v-slot="field" :label="text.unitCost">
          <BsInput :id="field.id" v-model.number="unitCost" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="text.reason">
          <BsInput :id="field.id" v-model="reason" :aria-describedby="field.describedby" :maxlength="500" :required="mode === 'writeoff'"/>
        </BsField>
      </BsGrid>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="countOpen" :title="text.count" :dirty="countDirty" :pending="countPending" :error="actionError" :submit-label="text.save" @submit="saveCount">
      <BsBox>
        <BsText as="p" emphasis="semibold">{{ countProduct?.name }}</BsText>
        <BsText as="p" tone="muted">{{ text.expected }}: {{ Number(countProduct?.quantity_on_hand ?? 0) }} · {{ text.variance }}: {{ variance }}</BsText>
      </BsBox>
      <BsGrid :columns="2">
        <BsField v-slot="field" :label="text.counted">
          <BsInput :id="field.id" v-model.number="countedQuantity" :aria-describedby="field.describedby" type="number" :min="0" :max="1000000" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="text.countedAt">
          <BsInput :id="field.id" v-model="countedAt" :aria-describedby="field.describedby" type="datetime-local" required/>
        </BsField>
        <BsField v-if="variance > 0" v-slot="field" :label="text.positiveCost">
          <BsInput :id="field.id" v-model.number="countUnitCost" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required/>
        </BsField>
        <BsField v-slot="field" :label="text.reference">
          <BsInput :id="field.id" v-model="countReference" :aria-describedby="field.describedby" :maxlength="200" required/>
        </BsField>
        <BsField v-slot="field" :label="text.reason">
          <BsTextarea :id="field.id" v-model="countReason" :aria-describedby="field.describedby" :minlength="3" :maxlength="500" :rows="2" required/>
        </BsField>
      </BsGrid>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="thresholdOpen" :title="text.setThreshold" :dirty="thresholdDirty" :pending="thresholdPending" :error="actionError" :submit-label="text.save" @submit="saveThreshold">
      <BsField v-slot="field" :label="text.threshold">
        <BsInput :id="field.id" v-model.number="thresholdValue" :aria-describedby="field.describedby" type="number" :min="0" :max="1000000" :step="0.01" required/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>

<script setup lang="ts">
import type { BsPhysicalStockCopy, BsPhysicalStockView, BsPhysicalStockForm, BsPhysicalStockRow } from '@building-suit/ui/types/physicalInventoryPresentation'
import type { InventoryReel, InventoryReelContext } from '~/types/electrical'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { measurementUnits } from '~/utils/measurement'
import { downloadCsv, encodeCsv } from '~/utils/catalogImport'
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId, businessCurrency } = useShop()
const { locale } = useI18n()
const ar = computed(() => locale.value === 'ar')
const route = useRoute()
const captureScope = useShopTaskScope()
const productId = ref(typeof route.query.product === 'string' ? route.query.product : '')
const search = ref('')
const debouncedSearch = ref('')
const page = ref(1)
const historyPage = ref(1)
const historyId = ref('')
const historyName = ref('')
const exporting = ref(false)
const actionError = ref('')
const selected = ref<InventoryReel | null>(null)
const operation = ref<'count' | 'classify' | 'archive'>('count')
const localNow = () => { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
const blank = (): BsPhysicalStockForm => ({ quantity: '0', countedAt: localNow(), reference: '', classification: 'sellable', price: '', position: '', reason: '' })
const form = ref<BsPhysicalStockForm>(blank())
const { visible: editorOpen, pending: saving, dirty } = useRecordAction(() => form.value)
type Command = ShopRpcDatabase['public']['Functions']['update_inventory_reel']['Args']
const frozen = ref<Command | null>(null)
const productPicker = reactive(usePurchaseEntityPicker('product'))
const selectedProduct = ref<{ id: string; name: string }>()
watch(productId, id => { page.value = 1; selectedProduct.value = productPicker.items.find(item => item.id === id) ?? selectedProduct.value })
useDebouncedChange(search, value => { debouncedSearch.value = value.trim(); page.value = 1 }, 250)
watch([currentId,currentLocationId], () => { exporting.value = false; selectedProduct.value = undefined; productId.value = ''; historyId.value = ''; historyName.value = ''; editorOpen.value = false; frozen.value = null; selected.value = null; saving.value = false; actionError.value = '' }, { flush: 'sync' })
const empty = (): InventoryReelContext => ({ items: [], total: 0, page: 1, pageSize: 20, canManage: false, canCount: false, canSetPrices: false, canViewCosts: false, summary: { reelCount: 0 }, history: [], historyTotal: 0 })
const { data, pending, error, refresh } = useShopQuery(() => `shop-data:physical-reels:${currentId.value}:${currentLocationId.value}:${productId.value}:${debouncedSearch.value}:${page.value}:${historyId.value}:${historyPage.value}`, async () => {
 if (!currentId.value || !currentLocationId.value) return empty()
 const result = await rpc.rpc('inventory_reel_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_product_id: productId.value || null, p_search: debouncedSearch.value || null, p_page: page.value, p_page_size: 20, p_reel_id: historyId.value || null, p_history_page: historyPage.value })
 if (result.error) throw result.error
 return result.data ?? empty()
}, { default: empty })
const words = computed(() => ar.value ? {
 title: 'البكرات والقطع', subtitle: 'أطوال البكرات الفعلية، والقطع المتصل، وبواقي الكابلات وسجلها.', dashboard: 'لوحة التحكم', noShop: 'اختر متجرًا وفرعًا أولًا.', inventory: 'المخزون', purchases: 'المشتريات', product: 'المنتج', allProducts: 'كل المنتجات', search: 'ابحث بالمنتج أو الباركود أو موضع التخزين', barcode: 'باركود البكرة', original: 'الطول الأصلي', remaining: 'المتبقي', reserved: 'المحجوز', status: 'الحالة', classification: 'التصنيف', position: 'موضع التخزين', value: 'قيمة المخزون', history: 'السجل', count: 'جرد البكرة', classify: 'تصنيف وتخزين', archive: 'أرشفة الفارغة', actions: 'الإجراءات', empty: 'لا توجد بكرات مطابقة. استلم منتجًا مفعّلًا لتتبع البكرات من المشتريات.', retry: 'إعادة المحاولة', quantity: 'الطول المعدود', countedAt: 'وقت الجرد', reference: 'مرجع الجرد', reason: 'السبب', price: 'سعر وحدة الباقي', save: 'حفظ', cancel: 'إلغاء', date: 'التاريخ', kind: 'الحركة', actor: 'المنفذ', export: 'تصدير CSV', historyEmpty: 'لا توجد حركات.', loadError: 'تعذر تحميل البكرات أو ليست لديك صلاحية الوصول لهذا الفرع.', changed: 'تغيرت البكرة. أغلق النموذج وافتحه بعد تحديث السجل.', invalid: 'راجع الكمية والمواصفات والسبب.', failed: 'تعذر تسجيل العملية.', uncertain: 'لم يتأكد حفظ العملية. أعد المحاولة بالبيانات نفسها قبل تسجيل تغيير آخر.', reelCount: 'عدد البكرات', available: 'الطول المتاح', continuous: 'أكبر قطعة متصلة', priceDenied: 'تعديل سعر الباقي يحتاج صلاحية إدارة المنتجات.', scrap: 'سيُزال الطول المتبقي من المخزون وقيمته.', countNotice: 'سيستبدل هذا الجرد الطول المتبقي المعروض بالكمية المعدودة مع حفظ فرق الجرد.', archived: 'مؤرشف', sealed: 'غير مفتوحة', open: 'مفتوحة', emptyState: 'فارغة', damaged: 'تالف', sellable: 'صالح للبيع', discounted: 'باقٍ مخفّض', scrapState: 'خردة', supplier_return: 'مرتجع للمورد', purchase_void: 'إلغاء شراء', receipt: 'استلام', cut: 'قطع', sealed_sale: 'بيع بكرة كاملة', return: 'مرتجع', classificationEvent: 'تصنيف',
} : {
 title: 'Reels & cuts', subtitle: 'Physical reel lengths, continuous cuts, cable remnants and their history.', dashboard: 'Dashboard', noShop: 'Choose a shop and location first.', inventory: 'Inventory', purchases: 'Purchases', product: 'Product', allProducts: 'All products', search: 'Search product, barcode or storage position', barcode: 'Reel barcode', original: 'Original length', remaining: 'Remaining', reserved: 'Reserved', status: 'Status', classification: 'Classification', position: 'Storage position', value: 'Stock value', history: 'History', count: 'Count reel', classify: 'Classify & store', archive: 'Archive empty reel', actions: 'Actions', empty: 'No matching reels. Receive a product with reel tracking enabled through Purchases.', retry: 'Retry', quantity: 'Counted length', countedAt: 'Counted at', reference: 'Count reference', reason: 'Reason', price: 'Remnant unit price', save: 'Save', cancel: 'Cancel', date: 'Date', kind: 'Movement', actor: 'Actor', export: 'Export CSV', historyEmpty: 'No movements.', loadError: 'Could not load reels, or access to this location is unavailable.', changed: 'The reel changed. Close and reopen the form after refreshing its history.', invalid: 'Review the quantity, settings and reason.', failed: 'Could not record the operation.', uncertain: 'The outcome is not confirmed. Retry with the same details before recording another change.', reelCount: 'Reel count', available: 'Available length', continuous: 'Largest continuous piece', priceDenied: 'Changing a remnant price requires product-management permission.', scrap: 'The remaining length and its value will be removed from stock.', countNotice: 'This count replaces the displayed remaining length with the counted quantity and records the variance.', archived: 'Archived', sealed: 'Sealed', open: 'Open', emptyState: 'Empty', damaged: 'Damaged', sellable: 'Sellable', discounted: 'Discounted remnant', scrapState: 'Scrap', supplier_return: 'Supplier return', purchase_void: 'Purchase void', receipt: 'Receipt', cut: 'Cut', sealed_sale: 'Full reel sale', return: 'Return', classificationEvent: 'Classification',
})
const unitLabel = (code: string) => { const unit = measurementUnits.find(unit => unit.code === code); return (ar.value ? unit?.nameAr : unit?.nameEn) || code }
const quantity = (value: string, unit: string) => `${value} ${unitLabel(unit)}`
const money = (value: number | null) => value == null ? '—' : new Intl.NumberFormat(locale.value, { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 12 }).format(value)
const date = (value: string) => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
function state(value: string) { return ({ empty: words.value.emptyState, scrap: words.value.scrapState, classification: words.value.classificationEvent } as Record<string,string>)[value] || words.value[value as keyof typeof words.value] || value }
function describe(cause: { message?: string } | null) { const message = cause?.message ?? ''; if (message.includes('CONTEXT_CHANGED')) return words.value.changed; if (message.includes('PERMISSION') || message.includes('SUBSCRIPTION') || message.includes('INVENTORY_NOT_IN_PLAN')) return words.value.loadError; return words.value.failed }
function open(id: string, action: 'count'|'classify'|'archive') {
 if (frozen.value) { editorOpen.value = true; return }
 const reel = data.value.items.find(item => item.id === id)
 if (!reel || saving.value || action === 'count' && !data.value.canCount || action !== 'count' && !data.value.canManage) return
 selected.value = reel; operation.value = action; form.value = { ...blank(), quantity: reel.remainingLength, classification: reel.classification, price: reel.remnantPrice == null ? '' : String(reel.remnantPrice), position: reel.storagePosition ?? '' }; actionError.value = ''; editorOpen.value = true
}
async function save() {
 if (!currentId.value || !currentLocationId.value || !selected.value || saving.value) return
 if (!frozen.value) {
  if (form.value.reason.trim().length < 3 || operation.value === 'count' && (!/^\d{1,12}(\.\d{1,6})?$/.test(form.value.quantity) || !form.value.reference.trim() || Number.isNaN(new Date(form.value.countedAt).getTime()))) { actionError.value = words.value.invalid; return }
  const values: Record<string,string|null> = operation.value === 'count' ? { quantity: form.value.quantity, countedAt: new Date(form.value.countedAt).toISOString(), reference: form.value.reference.trim() } : operation.value === 'classify' ? { classification: form.value.classification, price: form.value.classification === 'discounted' ? form.value.price : null, storagePosition: form.value.position.trim() || null } : {}
  frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_reel_id: selected.value.id, p_revision: selected.value.revision, p_action: operation.value, p_values: values, p_reason: form.value.reason.trim() }
 }
 const valid = captureScope(); saving.value = true; actionError.value = ''
 try {
  const result = await rpc.rpc('update_inventory_reel', frozen.value)
  if (!valid()) return
  if (result.error) {
   if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code) && !result.error.code.startsWith('08')) { frozen.value = null; actionError.value = describe(result.error) }
   else actionError.value = words.value.uncertain
   return
  }
  frozen.value = null; editorOpen.value = false; await refresh()
 } catch { if (valid()) actionError.value = words.value.uncertain }
 finally { if (valid()) saving.value = false }
}
function history(id: string) { historyId.value = id; historyName.value = data.value.items.find(item => item.id === id)?.barcode ?? id; historyPage.value = 1 }
async function exportRows() {
 if (!currentId.value || !currentLocationId.value || exporting.value) return
 const valid = captureScope(); const args = { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_product_id: productId.value || null, p_search: debouncedSearch.value || null }
 const all: InventoryReel[] = []; exporting.value = true
 try {
  for (let next = 1; ; next++) {
   const result = await rpc.rpc('inventory_reel_context', { ...args, p_page: next, p_page_size: 100 })
   if (!valid()) return
   if (result.error) throw result.error
   all.push(...result.data.items)
   if (all.length >= result.data.total) break
  }
  downloadCsv('reels.csv', encodeCsv(['product','barcode','unit','original','remaining','reserved','status','classification','storage_position',...(data.value.canViewCosts ? ['value'] : [])], all.map(reel => ({ product: reel.name, barcode: reel.barcode, unit: reel.unit, original: reel.originalLength, remaining: reel.remainingLength, reserved: reel.reservedLength, status: reel.status, classification: reel.classification, storage_position: reel.storagePosition, ...(data.value.canViewCosts ? { value: reel.value } : {}) }))))
 } catch { if (valid()) actionError.value = words.value.failed }
 finally { if (valid()) exporting.value = false }
}
const pickerView = computed(() => ({ options: productPicker.options(selectedProduct.value), loading: productPicker.pending, error: productPicker.error, hasMore: productPicker.hasMore, more: productPicker.copy.more, retry: productPicker.copy.retry }))
const rowViews = computed<BsPhysicalStockRow[]>(() => data.value.items.map(reel => ({ id: reel.id, name: reel.name, barcode: reel.barcode, original: quantity(reel.originalLength,reel.unit), remaining: quantity(reel.remainingLength,reel.unit), reserved: quantity(reel.reservedLength,reel.unit), status: state(reel.status), classification: state(reel.classification), position: reel.storagePosition ?? '—', value: money(reel.value), canCount: data.value.canCount && reel.status !== 'archived', canManage: data.value.canManage && reel.status !== 'archived', canArchive: data.value.canManage && Number(reel.remainingLength) === 0 && reel.status !== 'archived' })))
const eventViews = computed(() => data.value.history.map(event => ({ id: event.id, date: date(event.createdAt), kind: state(event.kind), quantity: event.quantityChange, value: money(event.valueChange), reason: event.reason, actor: event.actorName ?? '—' })))
const classifications = computed(() => ['sellable','discounted','damaged','scrap'].map(value => ({ value, label: state(value), disabled: value === 'discounted' && !data.value.canSetPrices && selected.value?.classification !== 'discounted' })))
const view = computed<BsPhysicalStockView>(() => ({ available: Boolean(currentId.value && currentLocationId.value), loading: pending.value, error: error.value ? words.value.loadError : actionError.value && !editorOpen.value ? actionError.value : '', canViewCosts: data.value.canViewCosts, total: data.value.total, pageSize: 20, exporting: exporting.value, summary: [{ id: 'count', label: words.value.reelCount, value: String(data.value.summary.reelCount) }, ...(data.value.summary.available != null ? [{ id: 'available', label: words.value.available, value: quantity(data.value.summary.available,data.value.summary.baseUnitCode ?? '') }, { id: 'continuous', label: words.value.continuous, value: quantity(data.value.summary.largestContinuous ?? '0',data.value.summary.baseUnitCode ?? '') }] : [])], historyName: historyName.value, historyLoading: pending.value, historyError: error.value ? words.value.loadError : '', historyTotal: data.value.historyTotal, editor: { count: operation.value === 'count', archive: operation.value === 'archive', title: operation.value === 'count' ? words.value.count : operation.value === 'archive' ? words.value.archive : words.value.classify, name: selected.value ? `${selected.value.name} · ${selected.value.barcode}` : '', unit: unitLabel(selected.value?.unit ?? ''), dirty: dirty.value, pending: saving.value, locked: Boolean(frozen.value), error: actionError.value, canPrice: data.value.canSetPrices, consequence: operation.value === 'count' ? words.value.countNotice : form.value.classification === 'scrap' ? words.value.scrap : '' } }))
const copy = computed<BsPhysicalStockCopy>(() => words.value)
useShopRealtime('inventory', () => dirty.value || Boolean(frozen.value))
</script>
<template>
 <BsPhysicalStockPage v-model:product-id="productId" v-model:search="search" v-model:page="page" v-model:history-page="historyPage" v-model:editor-open="editorOpen" v-model:form="form" :copy="copy" :view="view" :rows="rowViews" :events="eventViews" :product-picker="pickerView" :classifications="classifications" @retry="refresh()" @export="exportRows" @history="history" @count="open($event,'count')" @classify="open($event,'classify')" @archive="open($event,'archive')" @submit="save" @product-search="productPicker.query" @product-more="productPicker.more" @product-retry="productPicker.retry" />
</template>

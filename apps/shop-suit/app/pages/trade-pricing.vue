<script setup lang="ts">
import type { BsTradePricingCopy, BsTradePricingForm, BsTradePricingRow, BsTradePicker, BsTradePricingView } from '@building-suit/ui/types/tradePricingPresentation'
import type { CustomerGroup, TradePriceRule, TradePricingContext } from '~/types/tradePricing'
import type { ProductMeasurementOptions } from '~/types/measurement'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import { measurementUnits } from '~/utils/measurement'
definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const { currentId, currentLocationId, businessCurrency } = useShop()
const user = useSupabaseUser()
const { locale } = useI18n()
const ar = computed(() => locale.value === 'ar')
const kind = ref('group')
const search = ref('')
const term = ref('')
const page = ref(1)
const operation = ref<'group' | 'assignment' | 'price'>('price')
const selected = ref<CustomerGroup | TradePriceRule | null>(null)
const nowLocal = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) }
const localDate = (value: string | null) => value ? (() => { const d = new Date(value); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0,16) })() : ''
const blank = (): BsTradePricingForm => ({ name: '', active: true, productId: '', customerId: '', groupId: '', unit: '', minimum: '1', price: '', startsAt: nowLocal(), endsAt: '', priority: '0', reason: '' })
const form = ref(blank())
const { visible: editorOpen, pending: saving, dirty } = useRecordAction(() => form.value)
const captureScope = useShopTaskScope()
const editorError = ref('')
const assignmentRevision = ref(0)
const assignmentLoading = ref(false)
let assignmentGeneration = 0
const frozen = ref<ShopRpcDatabase['public']['Functions']['save_trade_configuration']['Args'] | null>(null)
const productPicker = reactive(usePurchaseEntityPicker('product'))
const customerPicker = reactive(usePurchaseEntityPicker('customer'))
const groupPicker = reactive(usePurchaseEntityPicker('group'))
const pickers = { product: productPicker, customer: customerPicker, group: groupPicker }
useDebouncedChange(search, value => { term.value = value.trim(); page.value = 1 }, 250)
watch(kind, () => { page.value = 1; search.value = ''; term.value = '' })
const empty = (): TradePricingContext => ({ items: [], total: 0, page: 1, pageSize: 20, groups: [], assignment: null, canManageGroups: false, canManagePrices: false })
const queryKind = computed(() => kind.value === 'group' || kind.value === 'history' ? kind.value : 'price')
const { data, pending, error, refresh } = useShopQuery(() => `shop-data:trade-pricing:${user.value?.id}:${currentId.value}:${queryKind.value}:${term.value}:${page.value}`, async () => {
 if (!currentId.value) return empty()
 const r = await rpc.rpc('trade_pricing_context', { p_shop_id: currentId.value, p_kind: queryKind.value, p_search: term.value || null, p_page: page.value })
 if (r.error) throw r.error
 return r.data ?? empty()
}, { default: empty })
const { data: measurement, pending: measurementLoading } = useShopQuery(() => `shop-data:trade-product:${user.value?.id}:${currentId.value}:${form.value.productId}`, async (): Promise<ProductMeasurementOptions | null> => {
 if (!currentId.value || !form.value.productId || operation.value !== 'price') return null
 const r = await rpc.rpc('product_measurement_options', { p_shop_id: currentId.value, p_product_id: form.value.productId })
 if (r.error) throw r.error
 return r.data
}, { default: () => null })
const unitLabel = (code: string) => { const u = measurementUnits.find(unit => unit.code === code); return u ? (ar.value ? u.nameAr : u.nameEn) : code }
const units = computed(() => {
 const m = measurement.value
 if (!m) return []
 const list = (m.status === 'legacy' ? ['ea'] : m.saleUnits).map(code => ({ value: `unit:${code}`, label: unitLabel(code) }))
 for (const p of m.packages.filter(pack => pack.canSell)) list.push({ value: `package:${p.id}:${p.version}`, label: `${p.name} (${p.baseQuantity} ${unitLabel(m.baseUnitCode)})` })
 if (selected.value && 'package_id' in selected.value && form.value.unit && !list.some(option => option.value === form.value.unit)) list.push({ value: form.value.unit, label: ar.value ? 'تعريف الوحدة أو العبوة السابق؛ اختر تعريفًا ساريًا' : 'Previous unit or package; choose a current definition' })
 return list
})
watch(units, options => { if (!frozen.value && options.length && !options.some(option => option.value === form.value.unit)) form.value.unit = options[0]!.value })
watch(() => form.value.customerId, async customer => {
 if (operation.value !== 'assignment' || frozen.value) return
 const generation = ++assignmentGeneration
 const valid = captureScope()
 editorError.value = ''; assignmentRevision.value = 0; assignmentLoading.value = !!customer; form.value.groupId = ''
 if (!customer || !currentId.value) return
 try {
  const r = await rpc.rpc('trade_pricing_context', { p_shop_id: currentId.value, p_kind: 'group', p_customer_id: customer })
  if (!valid() || generation !== assignmentGeneration) return
  if (r.error) throw r.error
  assignmentRevision.value = r.data?.assignment?.revision ?? 0; form.value.groupId = r.data?.assignment?.group_id ?? ''
 } catch { if (valid() && generation === assignmentGeneration) editorError.value = ar.value ? 'تعذر تحميل مجموعة العميل؛ أعد فتح النموذج.' : 'Could not load the customer group; reopen the form.' }
 finally { if (valid() && generation === assignmentGeneration) assignmentLoading.value = false }
})
watch([currentId, currentLocationId, () => user.value?.id], () => { assignmentGeneration++; editorOpen.value = false; frozen.value = null; saving.value = false; selected.value = null; form.value = blank(); editorError.value = ''; assignmentLoading.value = false }, { flush: 'sync' })
const copy = computed<BsTradePricingCopy>(() => ar.value ? {
 title: 'مجموعات العملاء وأسعار التعاقد', subtitle: 'أسعار معتمدة من الخادم، بسجل مراجعات دون تغيير أرصدة العملاء.', groups: 'المجموعات', prices: 'قواعد الأسعار', history: 'السجل', add: 'إضافة', assign: 'تعيين مجموعة عميل', name: 'الاسم', scope: 'النطاق', quantity: 'الحد الأدنى', price: 'السعر', validity: 'السريان', status: 'الحالة', revision: 'المراجعة', actions: 'الإجراءات', edit: 'تعديل', search: 'ابحث بالاسم أو المنتج', empty: 'لا توجد سجلات مطابقة.', retry: 'إعادة المحاولة', noShop: 'اختر متجرًا أولًا.', customers: 'العملاء', products: 'المنتجات', product: 'المنتج', customer: 'العميل', group: 'المجموعة', noCustomer: 'كل العملاء', noGroup: 'بدون مجموعة', unit: 'وحدة السعر أو العبوة', minimum: 'الحد الأدنى بوحدة المخزون', startsAt: 'بداية السريان', endsAt: 'نهاية السريان (اختياري)', priority: 'الأولوية داخل النطاق (٠–١٠٠٠)', active: 'نشط', reason: 'سبب التغيير', save: 'حفظ', cancel: 'إلغاء', rulePolicy: 'الأولوية: سعر الباقي المحدد، ثم تعاقد العميل، ثم مجموعته، ثم الكمية، ثم العبوة والكتالوج. لا تُجمع أسعار التعاقد مع خصومات الباقات. تتغير المسودات حتى الإصدار؛ يُحفظ السعر الصادر.', assignmentPolicy: 'التعيين يؤثر على الأسعار المستقبلية، ولا يغيّر الأرصدة أو المستندات الصادرة.', uncertain: 'لم يتأكد الحفظ. أعد المحاولة بالطلب نفسه قبل تعديل القيم.'
} : {
 title: 'Customer groups & trade pricing', subtitle: 'Server-authorized prices and revision history without changing customer balances.', groups: 'Groups', prices: 'Price rules', history: 'History', add: 'Add', assign: 'Assign customer group', name: 'Name', scope: 'Scope', quantity: 'Minimum quantity', price: 'Price', validity: 'Validity', status: 'Status', revision: 'Revision', actions: 'Actions', edit: 'Edit', search: 'Search name or product', empty: 'No matching records.', retry: 'Retry', noShop: 'Select a shop first.', customers: 'Customers', products: 'Products', product: 'Product', customer: 'Customer', group: 'Group', noCustomer: 'All customers', noGroup: 'No group', unit: 'Price unit or package', minimum: 'Minimum stock quantity', startsAt: 'Effective from', endsAt: 'Expires at (optional)', priority: 'Priority within scope (0–1000)', active: 'Active', reason: 'Reason for change', save: 'Save', cancel: 'Cancel', rulePolicy: 'Precedence: selected remnant, customer contract, group, quantity break, package, then catalog. Trade prices and bundle discounts do not stack. Drafts reprice until issue; issued prices are frozen.', assignmentPolicy: 'Assignments affect future prices and preserve balances and issued documents.', uncertain: 'Save is unconfirmed. Retry the same request before changing its values.'
})
const rows = computed<BsTradePricingRow[]>(() => (data.value?.items ?? []).map(record => {
 if ('product_id' in record) return { id: record.id, name: record.product_name, scope: record.customer_name || record.group_name || (ar.value ? 'حسب الكمية' : 'Quantity break'), quantity: `${record.minimum_quantity} ${unitLabel(record.stock_unit_code || record.unit_code || 'ea')}`, price: `${record.unit_price} ${record.currency_code || businessCurrency.value} / ${record.package_name || unitLabel(record.unit_code || '')}`, validity: `${new Date(record.starts_at).toLocaleString(locale.value)}${record.ends_at ? ` → ${new Date(record.ends_at).toLocaleString(locale.value)}` : ''}`, status: record.active ? (record.configuration_current === false ? (ar.value ? 'تغيرت الوحدة أو العملة؛ راجع القاعدة' : 'Unit or currency changed; review rule') : copy.value.active) : (ar.value ? 'مؤرشف' : 'Archived'), revision: String(record.revision), canEdit: !!data.value?.canManagePrices }
 if ('snapshot' in record) return { id: record.id, name: record.kind === 'price' ? copy.value.prices : record.kind === 'group' ? copy.value.groups : copy.value.assign, scope: record.reason, quantity: '', price: '', validity: new Date(record.created_at).toLocaleString(locale.value), status: '', revision: String(record.revision), canEdit: false }
 return { id: record.id, name: record.name, scope: '', quantity: '', price: '', validity: '', status: record.active ? copy.value.active : (ar.value ? 'مؤرشف' : 'Archived'), revision: String(record.revision), canEdit: !!data.value?.canManageGroups }
}))
function open(action: 'group' | 'assignment' | 'price', record: CustomerGroup | TradePriceRule | null = null) {
 if (frozen.value) { editorOpen.value = true; return }
 operation.value = action; selected.value = record; editorError.value = ''; assignmentRevision.value = 0
 const value = blank()
 if (record && 'product_id' in record) Object.assign(value, { productId: record.product_id, customerId: record.customer_id || '', groupId: record.group_id || '', unit: record.package_id ? `package:${record.package_id}:${record.package_version}` : `unit:${record.unit_code}`, minimum: String(record.minimum_quantity), price: String(record.unit_price), startsAt: localDate(record.starts_at), endsAt: localDate(record.ends_at), priority: String(record.priority), active: record.active })
 else if (record) Object.assign(value, { name: record.name, active: record.active })
 form.value = value; editorOpen.value = true
}
function edit(id: string) { const record = data.value?.items.find(item => item.id === id); if (record && !('snapshot' in record)) open('product_id' in record ? 'price' : 'group', record) }
async function submit() {
 if (!currentId.value || saving.value || assignmentLoading.value || measurementLoading.value) return
 const valid = captureScope()
 if (!frozen.value) {
  const f = form.value
  if (f.reason.trim().length < 3) { editorError.value = ar.value ? 'أدخل سببًا واضحًا.' : 'Enter a clear reason.'; return }
  const payload: Record<string, string | number | boolean | null> = { revision: selected.value?.revision ?? 0 }
  if (operation.value === 'group') Object.assign(payload, { id: selected.value?.id || null, name: f.name.trim(), active: f.active })
  else if (operation.value === 'assignment') {
   if (!f.customerId) { editorError.value = ar.value ? 'اختر العميل قبل تعيين المجموعة.' : 'Select a customer before assigning a group.'; return }
   if (editorError.value) return
   Object.assign(payload, { customerId: f.customerId, groupId: f.groupId || null, revision: assignmentRevision.value })
  } else {
   if (!f.productId || !/^\d{1,12}(\.\d{1,6})?$/.test(f.minimum) || !/^\d{1,9}(\.\d{1,12})?$/.test(f.price) || !/^\d{1,4}$/.test(f.priority) || Number(f.priority)>1000 || !f.unit || !f.startsAt || Number.isNaN(new Date(f.startsAt).getTime()) || f.endsAt && Number.isNaN(new Date(f.endsAt).getTime())) { editorError.value = ar.value ? 'راجع المنتج والوحدة والكمية والسعر والسريان.' : 'Review product, unit, quantity, price and validity.'; return }
   const [unitKind, code, version] = f.unit.split(':')
   Object.assign(payload, { id: selected.value?.id || null, productId: f.productId, customerId: f.customerId || null, groupId: f.customerId ? null : f.groupId || null, unitCode: unitKind === 'unit' ? code! : null, packageId: unitKind === 'package' ? code! : null, packageVersion: unitKind === 'package' ? Number(version) : null, minimumQuantity: f.minimum, price: f.price, startsAt: new Date(f.startsAt).toISOString(), endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null, priority: Number(f.priority), active: f.active })
  }
  frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_action: operation.value, p_payload: payload, p_reason: f.reason.trim() }
 }
 saving.value = true; editorError.value = ''
 try {
  const r = await rpc.rpc('save_trade_configuration', frozen.value)
  if (!valid()) return
  if (r.error) {
   if (r.error.code && /^[0-9A-Z]{5}$/.test(r.error.code) && !r.error.code.startsWith('08')) frozen.value = null
   throw r.error
  }
  frozen.value = null; editorOpen.value = false; await refresh(); groupPicker.retry()
 } catch (e) {
  if (valid()) editorError.value = frozen.value ? copy.value.uncertain : (String((e as Error)?.message).includes('CONTEXT_CHANGED') ? (ar.value ? 'تغير السجل. أغلق النموذج وأعد فتحه بعد التحديث.' : 'The record changed. Refresh and reopen the form.') : (ar.value ? 'تعذر حفظ التغيير؛ راجع الصلاحيات والقيم.' : 'Could not save; check permissions and values.'))
 } finally { if (valid()) saving.value = false }
}
function picker(kind: 'product' | 'customer' | 'group'): BsTradePicker {
 const p = pickers[kind]; const record = selected.value
 const picked = record && kind === 'product' && 'product_id' in record ? { id: record.product_id, name: record.product_name } : record && kind === 'customer' && 'customer_id' in record && record.customer_id ? { id: record.customer_id, name: record.customer_name || copy.value.customer } : record && kind === 'group' && 'group_id' in record && record.group_id ? { id: record.group_id, name: record.group_name || copy.value.group } : undefined
 return { options: p.options(picked), loading: p.pending, error: p.error, hasMore: p.hasMore, more: p.copy.more, retry: p.copy.retry }
}
const view = computed<BsTradePricingView>(() => ({ available: !!currentId.value, loading: pending.value, error: error.value ? (ar.value ? 'تعذر تحميل السجل أو لا توجد صلاحية.' : 'Could not load records or permission is missing.') : '', total: data.value?.total ?? 0, pageSize: 20, canManageGroups: !!data.value?.canManageGroups, canManagePrices: !!data.value?.canManagePrices, editor: { kind: operation.value, title: operation.value === 'price' && selected.value && !form.value.active ? (ar.value ? 'أرشفة القاعدة وحفظ تعريفها السابق' : 'Archive rule and preserve its existing definition') : operation.value === 'group' ? copy.value.groups : operation.value === 'assignment' ? copy.value.assign : copy.value.prices, dirty: dirty.value, pending: saving.value || assignmentLoading.value || measurementLoading.value, locked: !!frozen.value, error: editorError.value, productLocked: !!selected.value, archive: operation.value === 'price' && !!selected.value && !form.value.active, baseUnit: unitLabel(!form.value.active && selected.value && 'stock_unit_code' in selected.value ? selected.value.stock_unit_code || '' : measurement.value?.baseUnitCode || '') } }))
</script>
<template>
 <BsTradePricingPage v-model:kind="kind" v-model:search="search" v-model:page="page" v-model:editor-open="editorOpen" v-model:form="form" :copy="copy" :view="view" :rows="rows" :product-picker="picker('product')" :customer-picker="picker('customer')" :group-picker="picker('group')" :units="units" @retry="refresh()" @add="open(queryKind === 'group' ? 'group' : 'price')" @assign="open('assignment')" @edit="edit" @submit="submit" @picker-search="(kind, query) => pickers[kind].query(query)" @picker-more="kind => pickers[kind].more()" @picker-retry="kind => pickers[kind].retry()" />
</template>

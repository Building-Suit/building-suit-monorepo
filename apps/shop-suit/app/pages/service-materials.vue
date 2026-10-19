<script setup lang="ts">
import type { BsServiceWorkForm, BsServiceWorkView, BsServiceWorkCopy } from '@building-suit/ui/types/serviceFulfillmentPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
definePageMeta({ layout: 'default', middleware: ['auth'] })
type Material = {productId: string; name: string; unit: string; quantity: number}
type Fulfillment = {id: string; quantity: number; completed_at: string; materials: Material[]; allocations: {id: string; batch_id: string; quantity: number; unit: string; corrections?: {quantity: number; reason: string; created_at: string}[]}[]}
type Context = {totalCount?: number; lines: {id: string; name: string; quantity: number; completedQuantity: number; history: Fulfillment[]}[]}
type RecipeContext = {services: {id: string; name: string}[]; materials: BsServiceWorkView['materials']; totalCount: number; versions: {id: string; service_id: string; materials: Material[]; effective_at: string; reason: string}[]}
const { currentId, currentLocationId } = useShop()
const { locale } = useI18n()
const route = useRoute()
const sessionUser = useSupabaseUser()
const runtimeConfig = useRuntimeConfig()
const rpc = useShopClient<ShopRpcDatabase>().schema('public')
const counter = useOfflineCounter()
const offline = useOfflineCounterView(counter)
const captureScope = useShopTaskScope()
const saleId = computed(() => typeof route.query.sale === 'string' ? route.query.sale : null)
const offset = ref(0)
const correctionMode = ref(false)
let retainedRequest: {key: string; id: string} | null = null
function requestId(payload: unknown) { const key = JSON.stringify([currentId.value, currentLocationId.value, payload]); if (retainedRequest?.key !== key) retainedRequest = {key, id: crypto.randomUUID()}; return retainedRequest.id }
const pending = ref(false)
const actionError = ref('')
const success = ref('')
const form = ref<BsServiceWorkForm>({target: '', quantity: '1', reason: '', effectiveAt: '', override: false, materials: [], unit: 'each'})
const recordAction = useRecordAction(() => form.value)
const { visible: editor, dirty } = recordAction
const copy = computed<BsServiceWorkCopy>(() => locale.value === 'ar' ? {
 title: 'تنفيذ الخدمات والمواد', help: 'الوصفة اختيارية. التنفيذ قرار مستقل عن السداد. دقة الكمية ٠٫٠١ من وحدة المخزون بدون تحويل وحدات. رد قيمة الخدمة لا يعيد المواد المستهلكة تلقائيًا.', back: 'رجوع', loading: 'بنحمّل…', error: 'تعذر التحميل. راجع صلاحيات النشاط والفرع.', retry: 'حاول تاني', noContext: 'اختار نشاطًا وفرعًا.', empty: 'مفيش سجل.', configure: 'نسخة وصفة جديدة', complete: 'تسجيل تنفيذ', unit: 'وحدة المخزون', defineUnit: 'تحديد وحدة صنف بدون مخزون سابق', product: 'المادة', service: 'الخدمة', quantity: 'الكمية', reason: 'السبب', effectiveAt: 'سارية من', immediate: 'اتركه فارغًا للتفعيل الآن. وصفة فارغة توقف الاستهلاك المستقبلي.', override: 'تسجيل استهلاك فعلي بدل الوصفة (مدير)', add: 'إضافة مادة', remove: 'إزالة', save: 'حفظ', queued: 'الطلب محفوظ محليًا؛ التنفيذ غير مؤكد حتى المزامنة. راجع حالة الطلب أدناه.', saved: 'اتحفظت.', history: 'سجل التنفيذ والوصفات', detail: 'المواد وتخصيصات FIFO', date: 'وقت السريان أو التنفيذ', correction: 'تصحيح مدقق',
} : {
 title: 'Service fulfillment & materials', help: 'Recipes are optional. Completion is independent of payment. Quantities use 0.01 stock units with no conversions. Service refunds never automatically restore consumed materials.', back: 'Back', loading: 'Loading…', error: 'Could not load. Check shop and location permissions.', retry: 'Retry', noContext: 'Select a shop and location.', empty: 'No history.', configure: 'New recipe version', complete: 'Record fulfillment', unit: 'Stock unit', defineUnit: 'Define unit for an unused stock product', product: 'Material', service: 'Service', quantity: 'Quantity', reason: 'Reason', effectiveAt: 'Effective from', immediate: 'Leave blank for immediate effect. An empty recipe disables future consumption.', override: 'Record actual usage instead of recipe (manager)', add: 'Add material', remove: 'Remove', save: 'Save', queued: 'Request retained locally; fulfillment is unconfirmed until synced. Check the request status below.', saved: 'Saved.', history: 'Fulfillment & recipe history', detail: 'Materials and FIFO allocations', date: 'Effective or completion time', correction: 'Audited correction',
})
const { data, pending: loading, error, refresh } = useShopQuery(() => `shop-data:shop-crm:${runtimeConfig.public.supabase.url}:${sessionUser.value?.id}:service-materials:${currentId.value}:${currentLocationId.value}:${saleId.value}:${offset.value}`, async () => {
 if (!currentId.value || !currentLocationId.value) return null
 const key = 'service-fulfillment'
 if (!counter.online.value && saleId.value) {
  const cached = await counter.cached<{invoiceId: string; offset: number; value: {context: Context; recipes: RecipeContext | null}}>(key)
  return cached?.invoiceId === saleId.value && cached.offset === offset.value ? cached.value : null
 }
 const recipes = await rpc.rpc('service_recipe_context', {p_shop_id: currentId.value, p_offset: offset.value})
 if (!saleId.value) { if (recipes.error) throw recipes.error; return {context: {lines: []} as Context, recipes: recipes.data as RecipeContext} }
 const result = await rpc.rpc('service_fulfillment_context', {p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_invoice_id: saleId.value, p_offset: offset.value})
 if (result.error) throw result.error
 const value = {context: result.data as Context, recipes: recipes.error ? null : recipes.data as RecipeContext}
 await counter.cache(key, {invoiceId: saleId.value, offset: offset.value, value: {context: {totalCount: 0, lines: value.context.lines.map(line => ({id: line.id, name: line.name, quantity: line.quantity, completedQuantity: line.completedQuantity, history: []}))}, recipes: null}})
 return value
}, { watch: [() => sessionUser.value?.id, currentId, currentLocationId, saleId, offset], default: () => null })
watch([() => sessionUser.value?.id, currentId, currentLocationId, saleId], () => { recordAction.complete(); pending.value = false; retainedRequest = null; correctionMode.value = false; actionError.value = ''; success.value = ''; form.value = {target: '', quantity: '1', reason: '', effectiveAt: '', override: false, materials: [], unit: 'each'} })
watch(() => counter.records.value.filter(item => item.envelope.command.kind === 'service' && item.state === 'synced').length, () => { void refresh() })
watch(counter.ready, ready => { if (ready) void refresh() })
const view = computed<BsServiceWorkView>(() => {
 const recipes = data.value?.recipes
 const rows = saleId.value ? (data.value?.context.lines ?? []).flatMap(line => line.history.map(f => ({id: f.id, name: line.name, quantity: String(f.quantity), date: new Date(f.completed_at).toLocaleString(locale.value), detail: `${f.materials.map(m => `${m.name}: ${m.quantity} ${m.unit}`).join(', ')} · ${f.allocations.map(a => `${a.quantity} ${a.unit} / ${a.batch_id}${(a.corrections ?? []).map(c => ` · ${copy.value.correction}: ${c.quantity} ${a.unit} (${c.reason})`).join('')}`).join(', ')}`}))) : (recipes?.versions ?? []).map(v => ({id: v.id, name: recipes?.services.find(s => s.id === v.service_id)?.name ?? v.service_id, quantity: '', date: new Date(v.effective_at).toLocaleString(locale.value), detail: `${v.reason} · ${v.materials.map(m => `${m.name}: ${m.quantity} ${m.unit}`).join(', ')}`}))
 return {available: Boolean(currentId.value && currentLocationId.value && data.value), saleMode: Boolean(saleId.value), correctionMode: correctionMode.value, manager: Boolean(recipes), loading: loading.value, error: Boolean(error.value), actionError: actionError.value, success: success.value, pending: pending.value, choices: correctionMode.value ? (data.value?.context.lines ?? []).flatMap(l => l.history.flatMap(f => f.allocations.map(a => ({id: a.id, name: `${l.name} · ${a.quantity} ${a.unit} · ${a.batch_id}`})))) : saleId.value ? (data.value?.context.lines ?? []).filter(l => l.completedQuantity < l.quantity).map(l => ({id: l.id, name: `${l.name} (${l.completedQuantity}/${l.quantity})`})) : recipes?.services ?? [], materials: recipes?.materials ?? [], records: rows, first: offset.value, totalRecords: saleId.value ? data.value?.context.totalCount ?? 0 : recipes?.totalCount ?? 0, offline: offline.value}
})
function edit(correction = false) { correctionMode.value = correction; retainedRequest = null; form.value = {...form.value, target: '', quantity: '1', reason: '', effectiveAt: '', override: false, materials: []}; actionError.value = ''; success.value = ''; recordAction.open() }
async function save(defineUnit = false) {
 if (!currentId.value || !currentLocationId.value || pending.value) return
 const isCurrent = captureScope()
 pending.value = true; actionError.value = ''; success.value = ''
 try {
  const materials = form.value.materials.map(m => ({productId: m.productId, unit: data.value?.recipes?.materials.find(p => p.id === m.productId)?.unit ?? '', quantity: Number(m.quantity)}))
  if (correctionMode.value && !defineUnit) {
   const args = {p_shop_id: currentId.value, p_consumption_id: form.value.target, p_quantity: Number(form.value.quantity), p_reason: form.value.reason}
   const result = await rpc.rpc('correct_service_material', {...args, p_request_id: requestId(args)})
   if (result.error) throw result.error
  } else if (defineUnit) {
   const result = await rpc.rpc('define_service_material_unit', {p_shop_id: currentId.value, p_product_id: form.value.target, p_unit: form.value.unit})
   if (result.error) throw result.error
  } else if (saleId.value) {
   await counter.enqueue({kind: 'service', args: {p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_line_id: form.value.target, p_quantity: Number(form.value.quantity), p_appointment_id: null, p_materials: form.value.override ? materials : null, p_reason: form.value.reason}})
   if (isCurrent()) { recordAction.complete(); success.value = copy.value.queued }
   await counter.sync()
   if (isCurrent()) await refresh()
   return
  } else {
   const result = await rpc.rpc('save_service_recipe', {p_request_id: requestId(form.value), p_shop_id: currentId.value, p_service_id: form.value.target, p_effective_at: form.value.effectiveAt ? new Date(form.value.effectiveAt).toISOString() : null, p_materials: materials, p_reason: form.value.reason})
   if (result.error) throw result.error
  }
  if (isCurrent()) { await refresh(); recordAction.complete(); success.value = copy.value.saved }
 } catch { if (isCurrent()) actionError.value = copy.value.error } finally { if (isCurrent()) pending.value = false }
}
</script>
<template>
 <BsServiceFulfillmentPage v-model:form="form" v-model:editor="editor" :copy="copy" :view="view" :dirty="dirty" :back-to="saleId ? `/sales/${saleId}` : '/services'" @edit="edit()" @correct="edit(true)" @save="save()" @define-unit="save(true)" @retry="refresh()" @page="offset = $event" @retry-offline="counter.retry($event)" @reconcile-offline="counter.reconcile($event)" />
</template>

import { normalizeDecimalText } from '@building-suit/ux/decimalText'
import type { Ref } from 'vue'
import type { BsOrderDeliveryForm, BsOrderDeliveryView } from '@building-suit/ui/types/tradeOrderPresentation'
import { formatPresentationMoney } from '@building-suit/ui/utils/presentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

export function useOrderDelivery(orderId: Ref<string | null>, refreshOrder: () => Promise<unknown>) {
 const rpc = useShopClient<ShopRpcDatabase>().schema('public'), user = useSupabaseUser()
 const { currentId, currentLocationId } = useShop(), { locale } = useI18n(), captureScope = useShopTaskScope()
 const ar = computed(() => locale.value === 'ar'), page = ref(1), open = ref(false), saving = ref(false), commandError = ref(''), revision = ref(0)
 const blank = (): BsOrderDeliveryForm => ({ reason: '', applyDeposits: false, lines: [] })
 const form = ref(blank()), frozen = ref<ShopRpcDatabase['public']['Functions']['fulfill_trade_order']['Args'] | null>(null)
 const { dirty } = useRecordAction(() => form.value, open), locked = computed(() => saving.value || !!frozen.value)
 const { data, pending, error, refresh } = useShopQuery(() => `shop-data:order-deliveries:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${orderId.value}:${page.value}`, async () => {
  if (!currentId.value || !currentLocationId.value || !orderId.value) return null
  const result = await rpc.rpc('trade_order_delivery_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_page: page.value })
  if (result.error) throw result.error
  const d = result.data, decimal = (value: unknown) => typeof value === 'string' && /^[0-9]+(?:\.[0-9]+)?$/.test(value)
  if (!d || !Array.isArray(d.lines) || !Array.isArray(d.history) || typeof d.currency !== 'string'
   || d.lines.some(row => ![row.orderedQuantity,row.deliveredQuantity,row.remainingQuantity,row.heldQuantity,row.heldLoss].every(decimal)) || d.history.some(row => !decimal(row.total))) throw new Error('INVALID_ORDER_DELIVERY_RESPONSE')
  return d
 }, { default: () => null })
 watch([currentId, currentLocationId, () => user.value?.id, orderId], () => { page.value = 1; open.value = false; frozen.value = null; saving.value = false; commandError.value = ''; form.value = blank() }, { flush: 'sync' })
 const failure = (cause: unknown) => {
  const message = String((cause as Error)?.message || '')
  if (/CONTEXT_CHANGED|ENTERED_INCREMENT|WHOLE_PACKAGE/.test(message)) return ar.value ? 'راجع الكمية ووحدة الاتفاق والعبوات الكاملة. حدّث البيانات ثم افتح النموذج من جديد إذا تغير الأمر.' : 'Review the quantity, agreed unit and whole packages. Refresh and reopen this form if the order changed.'
  if (/RESERVATION|SOURCE_UNAVAILABLE|CUTTING_ALLOWANCE|CONTINUOUS|REEL/.test(message)) return ar.value ? 'راجع الحجز ومصادر البكرات وسماح فاقد القص قبل التسليم.' : 'Review reservations, physical sources and the cutting allowance before collection.'
  if (/PERIOD.*CLOSED|CLOSED.*PERIOD/.test(message)) return ar.value ? 'الفترة المالية مغلقة. افتح الفترة المناسبة قبل إصدار فاتورة التسليم.' : 'The financial period is closed. Open the appropriate period before issuing the collection invoice.'
  return ar.value ? 'تعذر تحميل التسليم أو إصداره. راجع البيانات والصلاحيات وحاول مجددًا.' : 'Could not load or issue this collection. Check details and access, then retry.'
 }
 function edit() {
  const d = data.value
  if (locked.value || pending.value || error.value || !d?.canFulfill) return
  revision.value = d.revision; commandError.value = ''
  form.value = { reason: '', applyDeposits: d.canApplyDeposits, lines: d.lines.filter(line => line.remainingQuantity !== '0').map(line => ({ id: line.id, name: `${line.name} (${line.unitCode})`, quantity: '', loss: '0', reelTracked: line.reelTracked, summary: ar.value ? `المتبقي ${line.remainingQuantity} · المحجوز ${line.heldQuantity}${line.reelTracked ? ` · سماح الفاقد ${line.heldLoss}` : ''}${line.packageName ? ` · عبوات كاملة: ${line.packageName}` : ''}` : `Remaining ${line.remainingQuantity} · Held ${line.heldQuantity}${line.reelTracked ? ` · Loss allowance ${line.heldLoss}` : ''}${line.packageName ? ` · Whole packages: ${line.packageName}` : ''}` })) }
  open.value = true
 }
 async function submit() {
  if (!currentId.value || !currentLocationId.value || !orderId.value || saving.value) return
  const valid = captureScope()
  if (!frozen.value) {
   const lines = form.value.lines.map(line => ({ ...line, quantity: normalizeDecimalText(line.quantity), loss: normalizeDecimalText(line.loss) || '0' })).filter(line => line.quantity !== '' && line.quantity !== '0'), exact = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/
   if (!lines.length || lines.some(line => !exact.test(line.quantity) || !/[1-9]/.test(line.quantity) || !exact.test(line.loss)) || form.value.reason.trim().length < 3) { commandError.value = ar.value ? 'أدخل كميات موجبة دقيقة بوحدة المخزون وسبب التسليم.' : 'Enter exact positive quantities in stock units and a collection reason.'; return }
   frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_revision: revision.value, p_lines: lines.map(line => ({ lineId: line.id, quantity: line.quantity, cuttingLoss: line.loss })), p_apply_deposits: form.value.applyDeposits, p_reason: form.value.reason.trim() }
  }
  saving.value = true; commandError.value = ''; let confirmed = false
  try {
   const result = await rpc.rpc('fulfill_trade_order', frozen.value)
   if (!valid()) return
   if (result.error) { if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code) && !result.error.code.startsWith('08')) frozen.value = null; throw result.error }
   if (!result.data) throw new Error('UNCONFIRMED_RESULT')
   frozen.value = null; confirmed = true; await Promise.all([refresh(), refreshOrder()])
  } catch (cause) { if (valid() && !confirmed) commandError.value = frozen.value ? ar.value ? 'لم تتأكد نتيجة التسليم. أعد المحاولة قبل إصدار تسليم آخر.' : 'The collection result is unconfirmed. Retry before issuing another collection.' : failure(cause) }
  finally { if (valid()) { saving.value = false; if (confirmed) open.value = false } }
 }
 const view = computed<BsOrderDeliveryView>(() => {
  const d = data.value
  const money = (value: string) => formatPresentationMoney(value, { currency: d?.currency || 'EGP', locale: ar.value ? 'ar-EG' : 'en-EG', unit: 'major', numberingSystem: ar.value ? 'arab' : 'latn' })
  return { title: ar.value ? 'التسليمات' : 'Collections', explanation: ar.value ? 'إصدار التسليم ينشئ فاتورة بالكميات والأسعار والضرائب المتفق عليها ويخصم المخزون مرة واحدة. احجز الأصناف أولًا. يبقى غير المستلم محجوزًا في المصادر نفسها حتى موعد الحجز، مع مراعاة القطعة المتصلة أو المجزأة وسماح فاقد القص.' : 'Issuing a collection creates an invoice at the agreed quantities, prices and taxes and deducts stock once. Reserve goods first. Uncollected goods remain held on the same sources until the reservation deadline, respecting continuous or split pieces and the cutting allowance.', loading: pending.value, error: error.value ? failure(error.value) : '', retry: ar.value ? 'تحديث التسليمات' : 'Refresh collections', locked: locked.value, canFulfill: !pending.value && !error.value && !!d?.canFulfill, collect: ar.value ? 'تسليم وإصدار فاتورة' : 'Collect and issue invoice', quantity: ar.value ? 'الكمية المطلوبة' : 'Ordered quantity', delivered: ar.value ? 'المستلم' : 'Collected', remaining: ar.value ? 'المتبقي' : 'Remaining', held: ar.value ? 'المحجوز' : 'Reserved', loss: ar.value ? 'فاقد القص بوحدة المخزون' : 'Cutting loss in stock units', reason: ar.value ? 'سبب التسليم' : 'Collection reason', invoice: ar.value ? 'الفاتورة' : 'Invoice', date: ar.value ? 'التاريخ' : 'Date', actor: ar.value ? 'المسؤول' : 'Responsible person', total: ar.value ? 'إجمالي الفاتورة' : 'Invoice total', historyTitle: ar.value ? 'سجل التسليمات' : 'Collection history', close: ar.value ? 'إلغاء' : 'Cancel', applyDeposits: ar.value ? 'تخصيص العربون المتاح لهذه الفاتورة' : 'Apply available deposits to this invoice', canApplyDeposits: !!d?.canApplyDeposits, rows: (d?.lines || []).map(line => ({ id: line.id, name: `${line.name} (${line.unitCode})`, ordered: line.orderedQuantity, delivered: line.deliveredQuantity, remaining: line.remainingQuantity, held: line.itemType === 'product' ? line.heldQuantity : '—' })), history: (d?.history || []).map(row => ({ id: row.id, invoice: row.invoice_number, invoiceTo: `/sales/${encodeURIComponent(row.invoice_id)}`, total: money(row.total), date: new Date(row.created_at).toLocaleString(locale.value), actor: row.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), reason: row.reason })), eventCount: d?.total || 0, editor: { dirty: dirty.value, pending: saving.value, error: commandError.value } }
 })
 return { page, open, form, locked, view, edit, submit, refresh }
}

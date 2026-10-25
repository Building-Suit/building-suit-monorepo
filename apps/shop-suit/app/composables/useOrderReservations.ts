import type { Ref } from 'vue'
import type { BsOrderReservationForm, BsOrderReservationView } from '@building-suit/ui/types/tradeOrderPresentation'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
import type { OrderReservationAction, OrderReservationContext } from '~/types/tradeOrders'

export function useOrderReservations(orderId: Ref<string | null>, refreshOrder: () => Promise<unknown>) {
 const rpc = useShopClient<ShopRpcDatabase>().schema('public'), user = useSupabaseUser()
 const { currentId, currentLocationId } = useShop(), { locale } = useI18n()
 const ar = computed(() => locale.value === 'ar'), captureScope = useShopTaskScope()
 const page = ref(1), historyPage = ref(1), open = ref(false), pendingCommand = ref(false), commandError = ref(''), action = ref<OrderReservationAction>('reserve'), revision = ref(0)
 const emptyForm = (): BsOrderReservationForm => ({ expiresAt: '', reason: '', lines: [] })
 const form = ref(emptyForm()), frozen = ref<ShopRpcDatabase['public']['Functions']['reserve_trade_order']['Args'] | null>(null)
 const { dirty } = useRecordAction(() => form.value, open)
 const { data, pending, error, refresh } = useShopQuery(() => `shop-data:order-reservations:${user.value?.id}:${currentId.value}:${currentLocationId.value}:${orderId.value}:${page.value}:${historyPage.value}`, async () => {
  if (!currentId.value || !currentLocationId.value || !orderId.value) return null
  const result = await rpc.rpc('trade_order_reservation_context', { p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_page: page.value, p_history_page: historyPage.value })
  if (result.error) throw result.error
  return result.data as OrderReservationContext | null
 }, { default: () => null })
 const failure = (cause: unknown) => {
  const message = String((cause as Error)?.message || '')
  if (/CONTEXT_CHANGED/.test(message)) return ar.value ? 'تغير الأمر. أغلق النموذج وافتحه بعد تحديث البيانات.' : 'The order changed. Close and reopen this form after refreshing.'
  if (/INSUFFICIENT|CONTINUOUS|SELECTED_REEL|RESERVED/.test(message)) return ar.value ? 'المخزون المتاح لا يكفي لهذا الحجز. راجع الكمية المتاحة ومصدر القطعة المتصلة.' : 'Available stock cannot fulfill this reservation. Review the available quantity and continuous source.'
  return ar.value ? 'تعذر تحميل الحجز أو تنفيذه. راجع الصلاحيات وحاول مجددًا.' : 'Could not load or complete the reservation. Check access and retry.'
 }
 const locked = computed(() => pendingCommand.value || !!frozen.value)
 watch([currentId, currentLocationId, () => user.value?.id, orderId], () => { page.value = 1; historyPage.value = 1; open.value = false; frozen.value = null; pendingCommand.value = false; commandError.value = ''; form.value = emptyForm() }, { flush: 'sync' })
 const titles = computed(() => ar.value ? { reserve: 'حجز مخزون للأمر', release: 'تحرير حجوزات الأمر', expire: 'تسجيل انتهاء الحجوزات', cancel: 'إلغاء الأمر وتحرير الحجز' } : { reserve: 'Reserve order stock', release: 'Release order holds', expire: 'Record expired holds', cancel: 'Cancel order and release holds' })
 function edit(next: OrderReservationAction) {
  if (locked.value || pending.value || error.value || !data.value?.canManage || data.value.status !== 'open') return
  action.value = next; revision.value = data.value.revision; commandError.value = ''
  // Capture the current revision once; background refresh cannot advance this editor.
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const local = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000).toISOString().slice(0,16)
  form.value = { expiresAt: local, reason: '', lines: data.value.stock.map(row => ({ id: row.lineId, name: `${row.name} (${row.unitCode})`, quantity: row.orderReserved === '0' ? '' : row.orderReserved, loss: '0', reelTracked: row.reelTracked })) }
  open.value = true
 }
 async function submit() {
  if (!currentId.value || !currentLocationId.value || !orderId.value || pendingCommand.value) return
  const valid = captureScope()
  if (!frozen.value) {
   const lines = form.value.lines.filter(line => line.quantity.trim() !== '' && line.quantity.trim() !== '0')
   const exact = /^(?:0|[1-9][0-9]{0,11})(?:\.[0-9]{1,6})?$/
   const expires = new Date(form.value.expiresAt)
   if (form.value.reason.trim().length < 3 || (action.value === 'reserve' && (!lines.length || !Number.isFinite(expires.getTime()) || lines.some(line => !exact.test(line.quantity) || !exact.test(line.loss))))) {
    commandError.value = ar.value ? 'أدخل سببًا وكميات دقيقة بوحدة المخزون وموعد انتهاء صالحًا.' : 'Enter a reason, exact quantities in stock units and a valid expiry.'; return
   }
   frozen.value = { p_request_id: crypto.randomUUID(), p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_order_id: orderId.value, p_revision: revision.value, p_action: action.value, p_lines: action.value === 'reserve' ? lines.map(line => ({ lineId: line.id, quantity: line.quantity, cuttingLoss: line.loss })) : [], p_expires_at: action.value === 'reserve' ? expires.toISOString() : null, p_reason: form.value.reason.trim() }
  }
  pendingCommand.value = true; commandError.value = ''
  try {
   const result = await rpc.rpc('reserve_trade_order', frozen.value)
   if (!valid()) return
   if (result.error) { if (result.error.code && /^[0-9A-Z]{5}$/.test(result.error.code) && !result.error.code.startsWith('08')) frozen.value = null; throw result.error }
   if (!result.data) throw new Error('UNCONFIRMED_RESULT')
   frozen.value = null; open.value = false; await Promise.all([refresh(), refreshOrder()])
  } catch (cause) { if (valid()) commandError.value = frozen.value ? ar.value ? 'لم تتأكد النتيجة. أعد المحاولة بالطلب نفسه قبل تغيير القيم.' : 'The result is unconfirmed. Retry the same request before changing values.' : failure(cause) }
  finally { if (valid()) pendingCommand.value = false }
 }
 const view = computed<BsOrderReservationView>(() => ({ loading: pending.value, error: error.value ? failure(error.value) : '', canManage: !!data.value?.canManage && data.value.status === 'open', locked: locked.value, title: ar.value ? 'حجوزات المخزون' : 'Stock reservations', explanation: ar.value ? 'الحجز يمنع بيع الكمية لغير هذا الأمر حتى الموعد المحدد. استبدال الحجز يستبدل جميع حجوزات الأمر معًا. أدخل الكمية بوحدة المخزون؛ يظل شرط القطعة المتصلة أو المجزأة كما اتُفق عليه. لا ينشئ الحجز فاتورة أو دفعة.' : 'A hold protects stock for this order until its deadline. Replacing holds replaces all of this order’s holds together. Enter quantities in stock units; the agreed continuous or split requirement still applies. Reserving creates no invoice or payment.', reserve: titles.value.reserve, release: titles.value.release, expire: titles.value.expire, cancelOrder: titles.value.cancel, onHand: ar.value ? 'الموجود فعليًا' : 'On hand', reserved: ar.value ? 'المحجوز للجميع' : 'Reserved for all orders', available: ar.value ? 'المتاح للبيع' : 'Available to sell', own: ar.value ? 'المحجوز لهذا البند' : 'Held for this item', expires: ar.value ? 'موعد الانتهاء' : 'Expires at', loss: ar.value ? 'فاقد القص بوحدة المخزون' : 'Cutting loss in stock units', reason: ar.value ? 'سبب إجراء الحجز' : 'Reservation reason', history: ar.value ? 'سجل الحجوزات' : 'Reservation history', commandTitle: titles.value[action.value], dirty: dirty.value, pending: pendingCommand.value, commandError: commandError.value, reserveAction: action.value === 'reserve', stock: (data.value?.stock || []).map(row => ({ id: row.lineId, name: `${row.name} (${row.unitCode})`, onHand: row.onHand, reserved: row.reserved, own: row.orderReserved, available: row.available })), items: (data.value?.items || []).map(row => ({ id: row.id, source: row.barcode || (ar.value ? 'مخزون مجمع' : 'Pooled stock'), quantity: `${row.remaining_sale_quantity} / ${row.sale_quantity}`, status: ({ active: ar.value ? 'نشط' : 'Active', released: ar.value ? 'محرر' : 'Released', expired: ar.value ? 'منتهٍ' : 'Expired', fulfilled: ar.value ? 'تم التوريد' : 'Fulfilled' })[row.status] || row.status, expires: new Date(row.expires_at).toLocaleString(locale.value) })), total: data.value?.total || 0, events: (data.value?.history || []).map(row => ({ id: row.id, action: row.action, reason: row.reason, actor: row.actor_name || (ar.value ? 'عضو الفريق' : 'Team member'), date: new Date(row.created_at).toLocaleString(locale.value) })), eventCount: data.value?.historyTotal || 0 }))
 return { page, historyPage, open, form, locked, view, edit, submit, refresh }
}

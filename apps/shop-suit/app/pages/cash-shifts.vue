<script setup lang="ts">
import type { BsCashShiftActiveView, BsCashShiftHistoryRow, BsCashShiftAmountForm, BsCashShiftMovementForm } from '@building-suit/ui/types/cashShiftPresentation'
import { projectOfflineCash, isCounterCashAmount } from '~/utils/offlineCashProjection.js'
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'
const { businessCurrency } = useShop()

definePageMeta({ layout: 'default', middleware: 'auth' })

type DrawerEvent = { id: string; kind: 'cash_sale' | 'cash_refund' | 'pay_in' | 'pay_out'; amount: number; reason: string | null; reference: string | null; occurredAt: string; actorName: string }
type ShiftSummary = { id: string; registerKey: string; cashierMembershipId: string; cashierName: string; openingAmount: number; cashSales: number; cashRefunds: number; payIns: number; payOuts: number; expectedCash: number; countedCash?: number; variance?: number; openedAt: string; closedAt?: string; notes?: string | null; closingNotes?: string | null; nonCashTotal: number; nonCashByMethod: Record<string, number>; events?: DrawerEvent[] }
type Dashboard = { canManage: boolean; canAdjust: boolean; currentMembershipId: string; active: ShiftSummary | null; items: ShiftSummary[]; total: number; page: number; pageSize: number; cashiers: Array<{ id: string; name: string }> }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const counter = useOfflineCounter()
const offlineView = useOfflineCounterView(counter)
const { current, currentId, currentLocation, currentLocationId, loading: shopLoading } = useShop()
const { push: pushToast } = useToasts()
const confirmation = useConfirmation()
const captureScope = useShopTaskScope()
const isArabic = computed(() => locale.value === 'ar')
const page = ref(1)
const pageSize = 20
const cashierId = ref<string | null>(null)
const actionError = ref('')

const copy = computed(() => isArabic.value ? {
  historyOffline: 'سجل الورديات والحركات الكامل متاح عند الاتصال.',
  title: 'ورديات الخزنة', subtitle: 'افتح خزنة كل فرع، سجّل الحركات، وطابق النقدية عند الإغلاق.', branch: 'الفرع',
  noShop: 'اعمل متجر الأول من لوحة التحكم.', loading: 'بنحمّل الورديات…', noLocation: 'مفيش فرع متاح.', loadError: 'مقدرناش نحمّل ورديات الخزنة.', retry: 'حاول تاني',
  active: 'الوردية المفتوحة', noActive: 'لا توجد وردية نقدية مفتوحة لهذا الفرع.', open: 'فتح وردية', openingCash: 'النقدية الافتتاحية', openingNotes: 'ملاحظة الافتتاح (اختيارية)', openAction: 'فتح الخزنة',
  cashier: 'الكاشير', opened: 'وقت الفتح', closed: 'وقت الإغلاق', register: 'الخزنة', cashSales: 'مبيعات نقدية', cashRefunds: 'مرتجعات نقدية', payIns: 'إيداع نقدي', payOuts: 'سحب نقدي', expected: 'النقدية المتوقعة', counted: 'النقدية المعدودة', variance: 'الفرق', nonCash: 'مدفوعات غير نقدية',
  movement: 'حركة نقدية', payIn: 'إيداع', payOut: 'سحب', amount: 'المبلغ', reason: 'السبب', reference: 'المرجع', record: 'تسجيل الحركة',
  close: 'إغلاق الوردية', closeNotes: 'ملاحظة الإغلاق (اختيارية)', closeAction: 'تأكيد العد والإغلاق',
  history: 'سجل الورديات', allCashiers: 'كل الكاشير', empty: 'لا توجد ورديات مغلقة.', eventHistory: 'حركات الوردية', event: 'الحركة', actor: 'الموظف', date: 'التاريخ',
  cash_sale: 'تحصيل بيع نقدي', cash_refund: 'رد نقدي للعميل', pay_in: 'إيداع نقدي', pay_out: 'سحب نقدي',
  openConfirm: 'فتح الخزنة بالمبلغ الافتتاحي المدخل؟ ستُربط الحركات النقدية التالية بهذه الوردية.',
  movementConfirm: 'تأكيد هذه الحركة؟ ستغيّر النقدية المتوقعة وتبقى محفوظة في سجل غير قابل للتعديل.',
  closeConfirm: 'تقفل الوردية على المبلغ اللي عدّيته؟ هنحفظ المبلغ المتوقع والفرق من غير ما نغيّر أي عملية قديمة.',
  saved: 'اتحدّثت وردية الخزنة.', invalid: 'راجع المبلغ والسبب والمرجع.', denied: 'معندكش صلاحية للفرع أو الإجراء ده.', conflict: 'فيه وردية مفتوحة للخزنة دي بالفعل.', writeError: 'مقدرناش نحفظ العملية. راجع البيانات وحاول تاني.', cancel: 'إلغاء',
} : {
  historyOffline: 'Full shift and movement history is available online.',
  title: 'Cashier shifts', subtitle: 'Open each location drawer, record movements, and reconcile counted cash at close.', branch: 'Location',
  noShop: 'Create a shop from the dashboard first.', loading: 'Loading shifts…', noLocation: 'No location is available.', loadError: 'Could not load cashier shifts.', retry: 'Retry',
  active: 'Open shift', noActive: 'No cash shift is open for this location.', open: 'Open shift', openingCash: 'Opening cash', openingNotes: 'Opening note (optional)', openAction: 'Open drawer',
  cashier: 'Cashier', opened: 'Opened', closed: 'Closed', register: 'Register', cashSales: 'Cash sales', cashRefunds: 'Cash refunds', payIns: 'Pay-ins', payOuts: 'Pay-outs', expected: 'Expected cash', counted: 'Counted cash', variance: 'Variance', nonCash: 'Non-cash payments',
  movement: 'Cash movement', payIn: 'Pay in', payOut: 'Pay out', amount: 'Amount', reason: 'Reason', reference: 'Reference', record: 'Record movement',
  close: 'Close shift', closeNotes: 'Closing note (optional)', closeAction: 'Confirm count and close',
  history: 'Shift history', allCashiers: 'All cashiers', empty: 'No closed shifts yet.', eventHistory: 'Shift movements', event: 'Event', actor: 'Staff member', date: 'Date',
  cash_sale: 'Cash sale receipt', cash_refund: 'Customer cash refund', pay_in: 'Drawer pay-in', pay_out: 'Drawer pay-out',
  openConfirm: 'Open the drawer with this opening amount? Following cash events will be linked to this shift.',
  movementConfirm: 'Confirm this drawer movement? It changes expected cash and remains in the immutable audit trail.',
  closeConfirm: 'Close this shift with the counted amount? Expected cash and variance will be saved without rewriting prior transactions.',
  saved: 'Cash shift updated.', invalid: 'Review the amount, reason, and reference.', denied: 'You do not have permission for this location or action.', conflict: 'A shift is already open for this register.', writeError: 'The action could not be saved. Review the details and retry.', cancel: 'Cancel',
})

const emptyDashboard = (): Dashboard => ({ canManage: false, canAdjust: false, currentMembershipId: '', active: null, items: [], total: 0, page: 1, pageSize, cashiers: [] })
const { data: dashboard, pending, error, refresh } = useAsyncData(
  () => `shop-data:cash-shifts:${currentId.value ?? 'none'}:${currentLocationId.value ?? 'none'}:${cashierId.value ?? 'all'}:${page.value}`,
  async (): Promise<Dashboard> => {
    if (!currentId.value || !currentLocationId.value) return emptyDashboard()
    if (import.meta.client && !counter.online.value) {
      const cached = await counter.cached<Dashboard>('shift')
      if (!cached) throw new Error('OFFLINE_CACHE_EXPIRED')
      return cached
    }
    const { data, error: readError } = await rpc.rpc('cash_shift_dashboard', {
      p_shop_id: currentId.value, p_location_id: currentLocationId.value,
      p_cashier_membership_id: cashierId.value, p_page: page.value, p_page_size: pageSize,
    })
    if (readError) throw readError
    return data as Dashboard
  }, { watch: [currentId, currentLocationId, cashierId, page], default: emptyDashboard },
)

watch([counter.ready, dashboard], async () => {
  if (!counter.ready.value || !counter.online.value || pending.value || error.value) return
  const value = dashboard.value
  const active = value.active ? { ...value.active, notes: null, closingNotes: null, events: [] } : null
  await counter.cache('shift', { ...value, active, items: [], cashiers: [], total: 0 })
})
watch(counter.online, () => { void refresh() })
watch(counter.ready, value => { if (value && !counter.online.value) void refresh() })

watch(currentLocationId, () => { cashierId.value = null; page.value = 1 })
watch(cashierId, () => { page.value = 1 })

const openForm = reactive({ amount: 0, notes: '' })
const movementForm = reactive({ kind: 'pay_in' as 'pay_in' | 'pay_out', amount: 0, reason: '', reference: '' })
const closeForm = reactive({ amount: 0, notes: '' })
const { visible: showOpen, pending: opening, dirty: openDirty } = useRecordAction(() => openForm)
const { visible: showMovement, pending: moving, dirty: movementDirty } = useRecordAction(() => movementForm)
const { visible: showClose, pending: closing, dirty: closeDirty } = useRecordAction(() => closeForm)
watch(counter.scope, () => {
  showOpen.value = false; showMovement.value = false; showClose.value = false
  Object.assign(openForm, { amount: 0, notes: '' }); Object.assign(movementForm, { kind: 'pay_in', amount: 0, reason: '', reference: '' }); Object.assign(closeForm, { amount: 0, notes: '' })
  actionError.value = ''
})
const openRequestId = ref<string | null>(null)
const movementRequestId = ref<string | null>(null)
const closeRequestId = ref<string | null>(null)

const validMoney = isCounterCashAmount
function money(value: number | string | undefined) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: businessCurrency.value, maximumFractionDigits: 20 }).format(Number(value ?? 0)) }
function date(value?: string) { return value ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function eventLabel(kind: DrawerEvent['kind']) { return copy.value[kind] }
function errorText(caught: unknown) {
  const message = typeof caught === 'string' ? caught
    : typeof caught === 'object' && caught !== null && 'message' in caught && typeof caught.message === 'string' ? caught.message : undefined
  if (message?.includes('PERMISSION') || message?.includes('ACCESS_DENIED')) return copy.value.denied
  if (message?.includes('ALREADY_OPEN')) return copy.value.conflict
  if (message?.includes('INVALID_')) return copy.value.invalid
  return copy.value.writeError
}
function startOpen() { Object.assign(openForm, { amount: 0, notes: '' }); openRequestId.value = null; actionError.value = ''; showOpen.value = true }
function startMovement() { Object.assign(movementForm, { kind: 'pay_in', amount: 0, reason: '', reference: '' }); movementRequestId.value = null; actionError.value = ''; showMovement.value = true }
function startClose() { Object.assign(closeForm, { amount: projectedExpectedCash.value, notes: '' }); closeRequestId.value = null; actionError.value = ''; showClose.value = true }

async function openShift() {
  if (!counter.online.value || !currentId.value || !currentLocationId.value || !validMoney(openForm.amount, true) || opening.value) { actionError.value = copy.value.invalid; return }
  const inScope = captureScope()
  opening.value = true; actionError.value = ''; openRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${currentLocation.value?.name ?? ''} · ${copy.value.openingCash}: ${money(openForm.amount)}. ${copy.value.openConfirm}`) || !inScope()) return
    const { error } = await rpc.rpc('open_cash_shift', { p_request_id: openRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_register_key: 'main', p_opening_amount: openForm.amount, p_notes: openForm.notes.trim() || null })
    if (!inScope()) return
    if (error) throw error
    showOpen.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught) }
  finally { opening.value = false }
}

async function recordMovement() {
  const active = dashboard.value.active
  if (counter.shiftClosing.value || !currentId.value || !active || !validMoney(movementForm.amount) || movementForm.reason.trim().length < 2 || !movementForm.reference.trim() || moving.value) { actionError.value = copy.value.invalid; return }
  const inScope = captureScope()
  moving.value = true; actionError.value = ''; movementRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${currentLocation.value?.name ?? ''} · ${movementForm.kind === 'pay_out' ? copy.value.payOut : copy.value.payIn}: ${money(movementForm.amount)} · ${movementForm.reason.trim()} · ${movementForm.reference.trim()}. ${copy.value.movementConfirm}`) || !inScope()) return
    if (!counter.online.value) {
      await counter.enqueue({ kind: 'movement', args: { p_request_id: movementRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_kind: movementForm.kind, p_amount: movementForm.amount, p_reason: movementForm.reason.trim(), p_reference: movementForm.reference.trim() } }, movementRequestId.value)
      showMovement.value = false; return
    }
    const { error } = await rpc.rpc('record_cash_movement', { p_request_id: movementRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_kind: movementForm.kind, p_amount: movementForm.amount, p_reason: movementForm.reason.trim(), p_reference: movementForm.reference.trim() })
    if (!inScope()) return
    if (error) throw error
    showMovement.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught) }
  finally { moving.value = false }
}

async function closeShift() {
  const active = dashboard.value.active
  if (!currentId.value || !active || !validMoney(closeForm.amount, true) || closing.value) { actionError.value = copy.value.invalid; return }
  const inScope = captureScope()
  closing.value = true; actionError.value = ''; closeRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(`${currentLocation.value?.name ?? ''} · ${copy.value.expected}: ${money(projectedExpectedCash.value)} · ${copy.value.counted}: ${money(closeForm.amount)}. ${copy.value.closeConfirm}`) || !inScope()) return
    if (!counter.online.value) {
      if (counter.shiftClosing.value) throw new Error('OFFLINE_CLOSE_PENDING')
      await counter.enqueue({ kind: 'close', args: { p_request_id: closeRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_counted_amount: closeForm.amount, p_notes: closeForm.notes.trim() || null } }, closeRequestId.value)
      showClose.value = false; return
    }
    if (counter.records.value.some(record => record.state !== 'synced' && record.resolution?.phase !== 'reconciled')) throw new Error('OFFLINE_REPLAY_PENDING')
    const { error } = await rpc.rpc('close_cash_shift', { p_request_id: closeRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_counted_amount: closeForm.amount, p_notes: closeForm.notes.trim() || null })
    if (!inScope()) return
    if (error) throw error
    showClose.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught) }
  finally { closing.value = false }
}

useShopRealtime('cash-shifts', () => openDirty.value || movementDirty.value || closeDirty.value)

const projectedExpectedCash = computed(() => projectOfflineCash(dashboard.value.active, counter.records.value))
watch(counter.busy, value => { if (!value && counter.online.value) void refresh() })

const activeView = computed<BsCashShiftActiveView | null>(() => {
  const active = dashboard.value.active
  if (!active) return null
  const metrics: [string, number][] = [ [copy.value.openingCash, active.openingAmount], [copy.value.cashSales, active.cashSales], [copy.value.cashRefunds, -active.cashRefunds], [copy.value.payIns, active.payIns], [copy.value.payOuts, -active.payOuts], [copy.value.nonCash, active.nonCashTotal], [copy.value.expected, projectedExpectedCash.value] ]
  return { cashier: active.cashierName, opened: date(active.openedAt), metrics: metrics.map(([label, amount]) => ({ label, value: money(amount) })), events: (active.events ?? []).map(event => ({ id: event.id, date: date(event.occurredAt), label: eventLabel(event.kind), detail: event.reason || event.reference || '—', actor: event.actorName, amount: money(event.amount) })) }
})
const historyRows = computed<BsCashShiftHistoryRow[]>(() => dashboard.value.items.map(shift => ({ id: shift.id, cashierName: shift.cashierName, opened: date(shift.openedAt), expected: money(shift.expectedCash), counted: money(shift.countedCash), variance: money(shift.variance), nonCash: money(shift.nonCashTotal) })))
const canClose = computed(() => Boolean(dashboard.value.active && (dashboard.value.canManage || dashboard.value.active.cashierMembershipId === dashboard.value.currentMembershipId)))
const openModel = computed<BsCashShiftAmountForm>({ get: () => ({ ...openForm }), set: value => Object.assign(openForm, value) })
const closeModel = computed<BsCashShiftAmountForm>({ get: () => ({ ...closeForm }), set: value => Object.assign(closeForm, value) })
const movementModel = computed<BsCashShiftMovementForm>({ get: () => ({ ...movementForm }), set: value => { Object.assign(movementForm, { ...value, kind: value.kind === 'pay_out' ? 'pay_out' : 'pay_in' }) } })
const movementOptions = computed(() => [{ value: 'pay_in', label: copy.value.payIn }, { value: 'pay_out', label: copy.value.payOut }])
</script>
<template>
  <BsCashShiftsPage v-model:cashier="cashierId" v-model:open-form="openModel" v-model:movement-form="movementModel" v-model:close-form="closeModel" v-model:open-visible="showOpen" v-model:movement-visible="showMovement" v-model:close-visible="showClose" :offline="offlineView" :can-open="counter.online.value" :history-available="counter.online.value" :copy="copy" :context-available="Boolean(current)" :shop-loading="shopLoading" :location-name="currentLocation?.name ?? null" :pending="pending" :error="Boolean(error)" :active="activeView" :can-adjust="Boolean(dashboard.active && dashboard.canAdjust && !counter.shiftClosing.value && !counter.busy.value)" :can-close="canClose && !counter.shiftClosing.value && !counter.busy.value" :can-manage="dashboard.canManage && counter.online.value" :history-rows="historyRows" :cashier-options="dashboard.cashiers" :page="page" :page-size="pageSize" :total="dashboard.total" :action-error="actionError" :expected-cash="money(projectedExpectedCash)" :open-editor="{ dirty: openDirty, pending: opening }" :movement-editor="{ dirty: movementDirty, pending: moving }" :close-editor="{ dirty: closeDirty, pending: closing }" :movement-options="movementOptions" @retry-offline="counter.retry($event)" @reconcile-offline="counter.reconcile($event)" @retry="refresh()" @open="startOpen" @movement="startMovement" @close="startClose" @save-open="openShift" @save-movement="recordMovement" @save-close="closeShift" @page="page = $event"/>
</template>

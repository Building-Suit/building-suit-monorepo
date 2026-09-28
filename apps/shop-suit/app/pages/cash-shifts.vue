<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: 'auth' })

type DrawerEvent = { id: string; kind: 'cash_sale' | 'cash_refund' | 'pay_in' | 'pay_out'; amount: number; reason: string | null; reference: string | null; occurredAt: string; actorName: string }
type ShiftSummary = { id: string; registerKey: string; cashierMembershipId: string; cashierName: string; openingAmount: number; cashSales: number; cashRefunds: number; payIns: number; payOuts: number; expectedCash: number; countedCash?: number; variance?: number; openedAt: string; closedAt?: string; notes?: string | null; closingNotes?: string | null; nonCashTotal: number; nonCashByMethod: Record<string, number>; events?: DrawerEvent[] }
type Dashboard = { canManage: boolean; canAdjust: boolean; currentMembershipId: string; active: ShiftSummary | null; items: ShiftSummary[]; total: number; page: number; pageSize: number; cashiers: Array<{ id: string; name: string }> }

const rpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const { locale } = useI18n()
const { current, currentId, currentLocation, currentLocationId, loading: shopLoading } = useShop()
const { push: pushToast } = useToasts()
const confirmation = useConfirmation()
const isArabic = computed(() => locale.value === 'ar')
const page = ref(1)
const pageSize = 20
const cashierId = ref<string | null>(null)
const actionError = ref('')

const copy = computed(() => isArabic.value ? {
  title: 'ورديات الخزنة', subtitle: 'افتح خزنة كل فرع، سجّل الحركات، وطابق النقدية عند الإغلاق.', branch: 'الفرع',
  noShop: 'أنشئ متجرًا أولًا من لوحة التحكم.', noLocation: 'لا يوجد فرع متاح.', loadError: 'تعذّر تحميل ورديات الخزنة.', retry: 'إعادة المحاولة',
  active: 'الوردية المفتوحة', noActive: 'لا توجد وردية نقدية مفتوحة لهذا الفرع.', open: 'فتح وردية', openingCash: 'النقدية الافتتاحية', openingNotes: 'ملاحظة الافتتاح (اختيارية)', openAction: 'فتح الخزنة',
  cashier: 'الكاشير', opened: 'وقت الفتح', closed: 'وقت الإغلاق', register: 'الخزنة', cashSales: 'مبيعات نقدية', cashRefunds: 'مرتجعات نقدية', payIns: 'إيداع نقدي', payOuts: 'سحب نقدي', expected: 'النقدية المتوقعة', counted: 'النقدية المعدودة', variance: 'الفرق', nonCash: 'مدفوعات غير نقدية',
  movement: 'حركة نقدية', payIn: 'إيداع', payOut: 'سحب', amount: 'المبلغ', reason: 'السبب', reference: 'المرجع', record: 'تسجيل الحركة',
  close: 'إغلاق الوردية', closeNotes: 'ملاحظة الإغلاق (اختيارية)', closeAction: 'تأكيد العد والإغلاق',
  history: 'سجل الورديات', allCashiers: 'كل الكاشير', empty: 'لا توجد ورديات مغلقة.', eventHistory: 'حركات الوردية', event: 'الحركة', actor: 'الموظف', date: 'التاريخ',
  cash_sale: 'تحصيل بيع نقدي', cash_refund: 'رد نقدي للعميل', pay_in: 'إيداع نقدي', pay_out: 'سحب نقدي',
  openConfirm: 'فتح الخزنة بالمبلغ الافتتاحي المدخل؟ ستُربط الحركات النقدية التالية بهذه الوردية.',
  movementConfirm: 'تأكيد هذه الحركة؟ ستغيّر النقدية المتوقعة وتبقى محفوظة في سجل غير قابل للتعديل.',
  closeConfirm: 'إغلاق الوردية بالمبلغ المعدود؟ سيُحفظ المتوقع والفرق دون تعديل أي عملية سابقة.',
  saved: 'تم تحديث وردية الخزنة.', invalid: 'راجع المبلغ والسبب والمرجع.', denied: 'ليست لديك صلاحية لهذا الفرع أو الإجراء.', conflict: 'توجد وردية مفتوحة بالفعل لهذه الخزنة.', writeError: 'تعذّر حفظ العملية. راجع البيانات وحاول مرة أخرى.', cancel: 'إلغاء',
} : {
  title: 'Cashier shifts', subtitle: 'Open each location drawer, record movements, and reconcile counted cash at close.', branch: 'Location',
  noShop: 'Create a shop from the dashboard first.', noLocation: 'No location is available.', loadError: 'Could not load cashier shifts.', retry: 'Retry',
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
    const { data, error: readError } = await rpc.rpc('cash_shift_dashboard', {
      p_shop_id: currentId.value, p_location_id: currentLocationId.value,
      p_cashier_membership_id: cashierId.value, p_page: page.value, p_page_size: pageSize,
    })
    if (readError) throw readError
    return data as Dashboard
  }, { watch: [currentId, currentLocationId, cashierId, page], default: emptyDashboard },
)

watch(currentLocationId, () => { cashierId.value = null; page.value = 1 })
watch(cashierId, () => { page.value = 1 })

const openForm = reactive({ amount: 0, notes: '' })
const movementForm = reactive({ kind: 'pay_in' as 'pay_in' | 'pay_out', amount: 0, reason: '', reference: '' })
const closeForm = reactive({ amount: 0, notes: '' })
const { visible: showOpen, pending: opening, dirty: openDirty } = useRecordAction(() => openForm)
const { visible: showMovement, pending: moving, dirty: movementDirty } = useRecordAction(() => movementForm)
const { visible: showClose, pending: closing, dirty: closeDirty } = useRecordAction(() => closeForm)
const openRequestId = ref<string | null>(null)
const movementRequestId = ref<string | null>(null)
const closeRequestId = ref<string | null>(null)

function validMoney(value: number, allowZero = false) { return Number.isFinite(value) && (allowZero ? value >= 0 : value > 0) && Math.round(value * 100) === value * 100 }
function money(value: number | string | undefined) { return new Intl.NumberFormat(isArabic.value ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 2 }).format(Number(value ?? 0)) }
function date(value?: string) { return value ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—' }
function eventLabel(kind: DrawerEvent['kind']) { return copy.value[kind] }
function errorText(message?: string) {
  if (message?.includes('PERMISSION') || message?.includes('ACCESS_DENIED')) return copy.value.denied
  if (message?.includes('ALREADY_OPEN')) return copy.value.conflict
  if (message?.includes('INVALID_')) return copy.value.invalid
  return copy.value.writeError
}
function startOpen() { Object.assign(openForm, { amount: 0, notes: '' }); openRequestId.value = null; actionError.value = ''; showOpen.value = true }
function startMovement() { Object.assign(movementForm, { kind: 'pay_in', amount: 0, reason: '', reference: '' }); movementRequestId.value = null; actionError.value = ''; showMovement.value = true }
function startClose() { Object.assign(closeForm, { amount: Number(dashboard.value.active?.expectedCash ?? 0), notes: '' }); closeRequestId.value = null; actionError.value = ''; showClose.value = true }

async function openShift() {
  if (!currentId.value || !currentLocationId.value || !validMoney(openForm.amount, true) || opening.value) { actionError.value = copy.value.invalid; return }
  if (!await confirmation.ask(copy.value.openConfirm)) return
  opening.value = true; actionError.value = ''; openRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await rpc.rpc('open_cash_shift', { p_request_id: openRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_register_key: 'main', p_opening_amount: openForm.amount, p_notes: openForm.notes.trim() || null })
    if (error) throw error
    showOpen.value = false; await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { opening.value = false }
}

async function recordMovement() {
  const active = dashboard.value.active
  if (!currentId.value || !active || !validMoney(movementForm.amount) || movementForm.reason.trim().length < 2 || !movementForm.reference.trim() || moving.value) { actionError.value = copy.value.invalid; return }
  if (!await confirmation.ask(copy.value.movementConfirm)) return
  moving.value = true; actionError.value = ''; movementRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await rpc.rpc('record_cash_movement', { p_request_id: movementRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_kind: movementForm.kind, p_amount: movementForm.amount, p_reason: movementForm.reason.trim(), p_reference: movementForm.reference.trim() })
    if (error) throw error
    showMovement.value = false; await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { moving.value = false }
}

async function closeShift() {
  const active = dashboard.value.active
  if (!currentId.value || !active || !validMoney(closeForm.amount, true) || closing.value) { actionError.value = copy.value.invalid; return }
  if (!await confirmation.ask(copy.value.closeConfirm)) return
  closing.value = true; actionError.value = ''; closeRequestId.value ??= crypto.randomUUID()
  try {
    const { error } = await rpc.rpc('close_cash_shift', { p_request_id: closeRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_counted_amount: closeForm.amount, p_notes: closeForm.notes.trim() || null })
    if (error) throw error
    showClose.value = false; await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { closing.value = false }
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-wrap items-end justify-between gap-3"><div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-1 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div><p v-if="currentLocation" class="rounded-xl bg-muted px-4 py-2 text-sm"><strong>{{ copy.branch }}:</strong> {{ currentLocation.name }}</p></header>
    <p v-if="!current && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm">{{ copy.noShop }}</p>
    <p v-else-if="!currentLocation && !shopLoading" class="rounded-2xl border border-border bg-card p-8 text-center text-sm">{{ copy.noLocation }}</p>
    <section v-else-if="current" class="space-y-5">
      <div v-if="error" role="alert" class="rounded-2xl border border-[var(--bs-status-error)] bg-[var(--bs-status-error-bg)] p-5 text-sm text-[var(--bs-status-error)]"><p>{{ copy.loadError }}</p><BsButton severity="secondary" class="mt-3" @click="refresh()">{{ copy.retry }}</BsButton></div>
      <div v-else-if="pending" role="status" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><div v-for="index in 4" :key="index" class="h-28 animate-pulse rounded-2xl bg-muted" /></div>
      <template v-else>
        <section class="rounded-2xl border border-border bg-card p-5" aria-labelledby="active-shift-heading">
          <div class="flex flex-wrap items-start justify-between gap-3"><div><h2 id="active-shift-heading" class="text-xl font-extrabold">{{ copy.active }}</h2><p v-if="dashboard.active" class="mt-1 text-sm text-muted-foreground">{{ dashboard.active.cashierName }} · {{ date(dashboard.active.openedAt) }}</p></div><div class="flex flex-wrap gap-2"><BsButton v-if="!dashboard.active" @click="startOpen">{{ copy.open }}</BsButton><BsButton v-if="dashboard.active && dashboard.canAdjust" severity="secondary" @click="startMovement">{{ copy.movement }}</BsButton><BsButton v-if="dashboard.active && (dashboard.canManage || dashboard.active.cashierMembershipId === dashboard.currentMembershipId)" @click="startClose">{{ copy.close }}</BsButton></div></div>
          <p v-if="!dashboard.active" class="mt-6 rounded-xl bg-muted p-6 text-center text-sm text-muted-foreground">{{ copy.noActive }}</p>
          <template v-else>
            <dl class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><div
              v-for="item in [
              [copy.openingCash, dashboard.active.openingAmount], [copy.cashSales, dashboard.active.cashSales], [copy.cashRefunds, -dashboard.active.cashRefunds], [copy.payIns, dashboard.active.payIns], [copy.payOuts, -dashboard.active.payOuts], [copy.nonCash, dashboard.active.nonCashTotal], [copy.expected, dashboard.active.expectedCash]
            ]" :key="String(item[0])" class="rounded-xl bg-muted p-4"><dt class="text-xs font-bold text-muted-foreground">{{ item[0] }}</dt><dd class="mt-1 text-lg font-extrabold">{{ money(item[1] as number) }}</dd></div></dl>
            <div class="mt-5 overflow-x-auto"><h3 class="mb-3 font-bold">{{ copy.eventHistory }}</h3><BsDataTable :value="dashboard.active.events ?? []" data-key="id" :label="copy.eventHistory"><Column><template #header>{{ copy.date }}</template><template #body="{ data: event }">{{ date(event.occurredAt) }}</template></Column><Column><template #header>{{ copy.event }}</template><template #body="{ data: event }"><p class="font-bold">{{ eventLabel(event.kind) }}</p><p class="text-xs text-muted-foreground">{{ event.reason || event.reference || '—' }}</p></template></Column><Column><template #header>{{ copy.actor }}</template><template #body="{ data: event }">{{ event.actorName }}</template></Column><Column body-class="text-end"><template #header>{{ copy.amount }}</template><template #body="{ data: event }"><strong>{{ money(event.amount) }}</strong></template></Column><template #empty><p class="p-5 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div>
          </template>
        </section>

        <section class="rounded-2xl border border-border bg-card p-5"><div class="flex flex-wrap items-end justify-between gap-3"><h2 class="text-xl font-extrabold">{{ copy.history }}</h2><BsSelect v-if="dashboard.canManage" v-model="cashierId" class="w-full sm:w-64" :label="copy.cashier" :options="[{ id: null, name: copy.allCashiers }, ...dashboard.cashiers]" option-label="name" option-value="id" /></div><div class="mt-4 overflow-x-auto"><BsDataTable :value="dashboard.items" data-key="id" :label="copy.history" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="dashboard.total" :always-show-paginator="false" @page="page = $event.page + 1"><Column field="cashierName"><template #header>{{ copy.cashier }}</template></Column><Column><template #header>{{ copy.opened }}</template><template #body="{ data: shift }">{{ date(shift.openedAt) }}</template></Column><Column body-class="text-end"><template #header>{{ copy.expected }}</template><template #body="{ data: shift }">{{ money(shift.expectedCash) }}</template></Column><Column body-class="text-end"><template #header>{{ copy.counted }}</template><template #body="{ data: shift }">{{ money(shift.countedCash) }}</template></Column><Column body-class="text-end"><template #header>{{ copy.variance }}</template><template #body="{ data: shift }"><strong :class="Number(shift.variance) === 0 ? 'text-[var(--bs-status-success)]' : 'text-[var(--bs-status-error)]'">{{ money(shift.variance) }}</strong></template></Column><Column body-class="text-end"><template #header>{{ copy.nonCash }}</template><template #body="{ data: shift }">{{ money(shift.nonCashTotal) }}</template></Column><template #empty><p class="p-6 text-center text-sm text-muted-foreground">{{ copy.empty }}</p></template></BsDataTable></div></section>
      </template>
    </section>

    <BsDialog v-model:visible="showOpen" :title="copy.open" :dirty="openDirty" :pending="opening"><template #default="{ close }"><BsForm class="grid gap-4" :pending="opening" :error="actionError" @submit="openShift"><label class="grid gap-1 text-sm font-bold">{{ copy.openingCash }}<input v-model.number="openForm.amount" type="number" min="0" step="0.01" required class="ls-input min-h-11"></label><label class="grid gap-1 text-sm font-bold">{{ copy.openingNotes }}<textarea v-model="openForm.notes" maxlength="1000" rows="3" class="ls-input" /></label><div class="flex gap-2"><BsButton type="submit" :pending="opening">{{ copy.openAction }}</BsButton><BsButton type="button" severity="secondary" @click="close">{{ copy.cancel }}</BsButton></div></BsForm></template></BsDialog>
    <BsDialog v-model:visible="showMovement" :title="copy.movement" :dirty="movementDirty" :pending="moving"><template #default="{ close }"><BsForm class="grid gap-4" :pending="moving" :error="actionError" @submit="recordMovement"><fieldset class="flex gap-4"><legend class="mb-2 text-sm font-bold">{{ copy.event }}</legend><label class="flex min-h-11 items-center gap-2"><input v-model="movementForm.kind" type="radio" value="pay_in">{{ copy.payIn }}</label><label class="flex min-h-11 items-center gap-2"><input v-model="movementForm.kind" type="radio" value="pay_out">{{ copy.payOut }}</label></fieldset><label class="grid gap-1 text-sm font-bold">{{ copy.amount }}<input v-model.number="movementForm.amount" type="number" min="0.01" step="0.01" required class="ls-input min-h-11"></label><label class="grid gap-1 text-sm font-bold">{{ copy.reason }}<textarea v-model="movementForm.reason" minlength="2" maxlength="1000" required rows="3" class="ls-input" /></label><label class="grid gap-1 text-sm font-bold">{{ copy.reference }}<input v-model="movementForm.reference" maxlength="200" required class="ls-input min-h-11"></label><div class="flex gap-2"><BsButton type="submit" :pending="moving">{{ copy.record }}</BsButton><BsButton type="button" severity="secondary" @click="close">{{ copy.cancel }}</BsButton></div></BsForm></template></BsDialog>
    <BsDialog v-model:visible="showClose" :title="copy.close" :dirty="closeDirty" :pending="closing"><template #default="{ close }"><BsForm class="grid gap-4" :pending="closing" :error="actionError" @submit="closeShift"><p class="rounded-xl bg-muted p-4 text-sm">{{ copy.expected }}: <strong>{{ money(dashboard.active?.expectedCash) }}</strong></p><label class="grid gap-1 text-sm font-bold">{{ copy.counted }}<input v-model.number="closeForm.amount" type="number" min="0" step="0.01" required class="ls-input min-h-11"></label><label class="grid gap-1 text-sm font-bold">{{ copy.closeNotes }}<textarea v-model="closeForm.notes" minlength="2" maxlength="1000" rows="3" class="ls-input" /></label><div class="flex gap-2"><BsButton type="submit" :pending="closing">{{ copy.closeAction }}</BsButton><BsButton type="button" severity="secondary" @click="close">{{ copy.cancel }}</BsButton></div></BsForm></template></BsDialog>
  </div>
</template>

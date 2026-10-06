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
const captureScope = useShopTaskScope()
const isArabic = computed(() => locale.value === 'ar')
const page = ref(1)
const pageSize = 20
const cashierId = ref<string | null>(null)
const actionError = ref('')

const copy = computed(() => isArabic.value ? {
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
  const inScope = captureScope()
  opening.value = true; actionError.value = ''; openRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(copy.value.openConfirm) || !inScope()) return
    const { error } = await rpc.rpc('open_cash_shift', { p_request_id: openRequestId.value, p_shop_id: currentId.value, p_location_id: currentLocationId.value, p_register_key: 'main', p_opening_amount: openForm.amount, p_notes: openForm.notes.trim() || null })
    if (!inScope()) return
    if (error) throw error
    showOpen.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { opening.value = false }
}

async function recordMovement() {
  const active = dashboard.value.active
  if (!currentId.value || !active || !validMoney(movementForm.amount) || movementForm.reason.trim().length < 2 || !movementForm.reference.trim() || moving.value) { actionError.value = copy.value.invalid; return }
  const inScope = captureScope()
  moving.value = true; actionError.value = ''; movementRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(copy.value.movementConfirm) || !inScope()) return
    const { error } = await rpc.rpc('record_cash_movement', { p_request_id: movementRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_kind: movementForm.kind, p_amount: movementForm.amount, p_reason: movementForm.reason.trim(), p_reference: movementForm.reference.trim() })
    if (!inScope()) return
    if (error) throw error
    showMovement.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { moving.value = false }
}

async function closeShift() {
  const active = dashboard.value.active
  if (!currentId.value || !active || !validMoney(closeForm.amount, true) || closing.value) { actionError.value = copy.value.invalid; return }
  const inScope = captureScope()
  closing.value = true; actionError.value = ''; closeRequestId.value ??= crypto.randomUUID()
  try {
    if (!await confirmation.ask(copy.value.closeConfirm) || !inScope()) return
    const { error } = await rpc.rpc('close_cash_shift', { p_request_id: closeRequestId.value, p_shop_id: currentId.value, p_session_id: active.id, p_counted_amount: closeForm.amount, p_notes: closeForm.notes.trim() || null })
    if (!inScope()) return
    if (error) throw error
    showClose.value = false; await refresh(); if (inScope()) pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { if (inScope()) actionError.value = errorText(caught instanceof Error ? caught.message : String(caught)) }
  finally { closing.value = false }
}
</script>

<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsText v-if="currentLocation" as="p" size="sm">
          <BsText as="strong">{{ copy.branch }}:</BsText> {{ currentLocation.name }}</BsText>
      </template>
    </BsPageHeader>
    <BsText v-if="!current && !shopLoading" as="p" size="sm">{{ copy.noShop }}</BsText>
    <BsText v-else-if="!currentLocation && !shopLoading" as="p" size="sm">{{ copy.noLocation }}</BsText>
    <BsStack v-else-if="current">
      <BsBox v-if="error" role="alert" padding="md">
        <BsText as="p">{{ copy.loadError }}</BsText>
        <BsButton severity="secondary" @click="refresh()">{{ copy.retry }}</BsButton>
      </BsBox>
      <BsGrid v-else-if="pending" :aria-label="copy.loading" role="status" :columns="4">
        <BsSkeleton v-for="index in 4" :key="index"/>
      </BsGrid>
      <template v-else>
        <BsPanel aria-labelledby="active-shift-heading" padding="md">
          <BsInline justify="between">
            <BsBox>
              <BsHeading id="active-shift-heading" :level="2">{{ copy.active }}</BsHeading>
              <BsText v-if="dashboard.active" as="p" size="sm" tone="muted">{{ dashboard.active.cashierName }} · {{ date(dashboard.active.openedAt) }}</BsText>
            </BsBox>
            <BsInline>
              <BsButton v-if="!dashboard.active" @click="startOpen">{{ copy.open }}</BsButton>
              <BsButton v-if="dashboard.active && dashboard.canAdjust" severity="secondary" @click="startMovement">{{ copy.movement }}</BsButton>
              <BsButton v-if="dashboard.active && (dashboard.canManage || dashboard.active.cashierMembershipId === dashboard.currentMembershipId)" @click="startClose">{{ copy.close }}</BsButton>
            </BsInline>
          </BsInline>
          <BsText v-if="!dashboard.active" as="p" size="sm" tone="muted">{{ copy.noActive }}</BsText>
          <template v-else>
            <BsDescriptionList>
              <BsDescriptionItem
                v-for="item in [
                  [copy.openingCash, dashboard.active.openingAmount], [copy.cashSales, dashboard.active.cashSales], [copy.cashRefunds, -dashboard.active.cashRefunds], [copy.payIns, dashboard.active.payIns], [copy.payOuts, -dashboard.active.payOuts], [copy.nonCash, dashboard.active.nonCashTotal], [copy.expected, dashboard.active.expectedCash]
                ]" :key="String(item[0])" :term="(item[0])">
                <BsText as="span" size="lg" emphasis="semibold">{{ money(item[1] as number) }}</BsText>
              </BsDescriptionItem>
            </BsDescriptionList>
            <BsBox scroll="x">
              <BsHeading :level="3">{{ copy.eventHistory }}</BsHeading>
              <BsDataTable :value="dashboard.active.events ?? []" data-key="id" :label="copy.eventHistory" :columns="[{ key: 'column0', header: (copy.date) }, { key: 'column1', header: (copy.event) }, { key: 'column2', header: (copy.actor) }, { key: 'column3', header: (copy.amount), align: 'end' }]">
                <template #cell-column0="{ row: event }">{{ date(event.occurredAt) }}</template>
                <template #cell-column1="{ row: event }">
                  <BsText as="p" emphasis="semibold">{{ eventLabel(event.kind) }}</BsText>
                  <BsText as="p" size="xs" tone="muted">{{ event.reason || event.reference || '—' }}</BsText>
                </template>
                <template #cell-column2="{ row: event }">{{ event.actorName }}</template>
                <template #cell-column3="{ row: event }">
                  <BsText as="strong">{{ money(event.amount) }}</BsText>
                </template>
                <template #empty>
                  <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
                </template>
              </BsDataTable>
            </BsBox>
          </template>
        </BsPanel>
        <BsPanel padding="md">
          <BsInline justify="between">
            <BsHeading :level="2">{{ copy.history }}</BsHeading>
            <BsSelect v-if="dashboard.canManage" v-model="cashierId" :label="copy.cashier" :options="[{ id: null, name: copy.allCashiers }, ...dashboard.cashiers]" option-label="name" option-value="id"/>
          </BsInline>
          <BsBox scroll="x">
            <BsDataTable :value="dashboard.items" data-key="id" :label="copy.history" lazy paginator :rows="pageSize" :first="(page - 1) * pageSize" :total-records="dashboard.total" :always-show-paginator="false" :columns="[{ key: 'cashierName', header: (copy.cashier), field: 'cashierName' }, { key: 'column1', header: (copy.opened) }, { key: 'column2', header: (copy.expected), align: 'end' }, { key: 'column3', header: (copy.counted), align: 'end' }, { key: 'column4', header: (copy.variance), align: 'end' }, { key: 'column5', header: (copy.nonCash), align: 'end' }]" @page="page = $event.page + 1">
              <template #cell-column1="{ row: shift }">{{ date(shift.openedAt) }}</template>
              <template #cell-column2="{ row: shift }">{{ money(shift.expectedCash) }}</template>
              <template #cell-column3="{ row: shift }">{{ money(shift.countedCash) }}</template>
              <template #cell-column4="{ row: shift }">
                <BsText as="strong">{{ money(shift.variance) }}</BsText>
              </template>
              <template #cell-column5="{ row: shift }">{{ money(shift.nonCashTotal) }}</template>
              <template #empty>
                <BsText as="p" size="sm" tone="muted">{{ copy.empty }}</BsText>
              </template>
            </BsDataTable>
          </BsBox>
        </BsPanel>
      </template>
    </BsStack>
    <BsRecordActionDialog v-model:visible="showOpen" :title="copy.open" :dirty="openDirty" :pending="opening" :error="actionError" :submit-label="copy.openAction" :cancel-label="copy.cancel" @submit="openShift">
      <BsField v-slot="field" :label="copy.openingCash">
        <BsInput :id="field.id" v-model.number="openForm.amount" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required/>
      </BsField>
      <BsField v-slot="field" :label="copy.openingNotes">
        <BsTextarea :id="field.id" v-model="openForm.notes" :aria-describedby="field.describedby" :maxlength="1000" :rows="3"/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="showMovement" :title="copy.movement" :dirty="movementDirty" :pending="moving" :error="actionError" :submit-label="copy.record" :cancel-label="copy.cancel" @submit="recordMovement">
      <BsFieldGroup :legend="(copy.event)">
        <BsRadio  v-model="movementForm.kind" value="pay_in" :label="copy.payIn" />
        <BsRadio  v-model="movementForm.kind" value="pay_out" :label="copy.payOut" />
      </BsFieldGroup>
      <BsField v-slot="field" :label="copy.amount">
        <BsInput :id="field.id" v-model.number="movementForm.amount" :aria-describedby="field.describedby" type="number" :min="0.01" :step="0.01" required/>
      </BsField>
      <BsField v-slot="field" :label="copy.reason">
        <BsTextarea :id="field.id" v-model="movementForm.reason" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" required :rows="3"/>
      </BsField>
      <BsField v-slot="field" :label="copy.reference">
        <BsInput :id="field.id" v-model="movementForm.reference" :aria-describedby="field.describedby" :maxlength="200" required/>
      </BsField>
    </BsRecordActionDialog>
    <BsRecordActionDialog v-model:visible="showClose" :title="copy.close" :dirty="closeDirty" :pending="closing" :error="actionError" :submit-label="copy.closeAction" :cancel-label="copy.cancel" @submit="closeShift">
      <BsText as="p" size="sm">{{ copy.expected }}: <BsText as="strong">{{ money(dashboard.active?.expectedCash) }}</BsText>
      </BsText>
      <BsField v-slot="field" :label="copy.counted">
        <BsInput :id="field.id" v-model.number="closeForm.amount" :aria-describedby="field.describedby" type="number" :min="0" :step="0.01" required/>
      </BsField>
      <BsField v-slot="field" :label="copy.closeNotes">
        <BsTextarea :id="field.id" v-model="closeForm.notes" :aria-describedby="field.describedby" :minlength="2" :maxlength="1000" :rows="3"/>
      </BsField>
    </BsRecordActionDialog>
  </BsStack>
</template>

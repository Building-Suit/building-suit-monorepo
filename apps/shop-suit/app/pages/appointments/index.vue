<script setup lang="ts">
import type { ShopRpcDatabase } from '~/types/shopCrmRpc'

definePageMeta({ layout: 'default', middleware: ['auth', 'business-mode'] })

type AppointmentStatus = 'booked' | 'arrived' | 'waiting' | 'in_service' | 'completed' | 'cancelled' | 'no_show'
type Appointment = {
  id: string; locationId: string; staffMembershipId: string; serviceId: string
  customerId: string | null; identityKind: 'customer' | 'walk_in'; customerName: string
  customerPhone: string | null; status: AppointmentStatus; startsAt: string; endsAt: string
  notes: string | null; saleId: string | null; serviceName: string; staffName: string
  history: Array<{ action: string; status: AppointmentStatus; occurredAt: string }>
}
type WorkingHours = { membershipId: string; weekday: number; startsLocal: string; endsLocal: string; timezone: string }
type ScheduleBlock = { id?: string; membershipId?: string; kind: 'break' | 'time_off'; startsAt: string; endsAt: string; note: string | null }
type CalendarData = { appointments: Appointment[]; workingHours: WorkingHours[]; blocks: ScheduleBlock[] }
type Options = {
  canManage: boolean; canManageSchedule: boolean
  locations: Array<{ id: string; name: string }>
  staff: Array<{ membershipId: string; name: string; locationIds: string[] }>
  services: Array<{ id: string; name: string; durationMinutes: number; cleanupMinutes: number; locationIds: string[]; staffMembershipIds: string[] }>
  customers: Array<{ id: string; name: string; phone: string | null }>
}

const shopRpc = useSupabaseClient<ShopRpcDatabase>().schema('public')
const route = useRoute()
const { locale } = useI18n()
const { current, currentId, currentLocationId, selectLocation, loading: shopLoading } = useShop()
const { push: pushToast } = useToasts()
const confirmation = useConfirmation()
const isArabic = computed(() => locale.value === 'ar')
const view = ref<'day' | 'week'>('day')
const selectedDate = ref(typeof route.query.from === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(route.query.from)
  ? route.query.from : dateKey(new Date()))
const staffId = ref<string | null>(null)
const actionError = ref('')
const transitionId = ref<string | null>(null)

const copy = computed(() => isArabic.value ? {
  title: 'المواعيد', subtitle: 'تقويم الفريق وقائمة الانتظار والحضور بدون حجز.', add: 'موعد جديد',
  day: 'يوم', week: 'أسبوع', today: 'اليوم', previous: 'السابق', next: 'التالي', allBarbers: 'كل الموظفين',
  barber: 'الموظف', branch: 'الفرع', loading: 'بنحمّل التقويم…', empty: 'مفيش مواعيد في الفترة دي.',
  loadError: 'مقدرناش نحمّل التقويم.', denied: 'اطلب من المالك صلاحية المواعيد وحاول تاني.', retry: 'حاول تاني',
  queue: 'قائمة الانتظار', queueEmpty: 'مفيش عملاء مستنيين.', schedule: 'ساعات العمل والإجازات',
  create: 'إضافة موعد', edit: 'تعديل الموعد', save: 'حفظ الموعد', saving: 'بنحفظ…', cancel: 'إلغاء',
  service: 'الخدمة', start: 'وقت البداية', customerType: 'نوع العميل', customer: 'عميل مسجل', walkIn: 'حضور بدون حجز',
  selectCustomer: 'اختر العميل', name: 'الاسم', phone: 'الهاتف', notes: 'ملاحظات',
  booked: 'محجوز', arrived: 'وصل', waiting: 'منتظر', in_service: 'قيد الخدمة', completed: 'مكتمل', cancelled: 'ملغي', no_show: 'لم يحضر',
  markArrived: 'تسجيل الوصول', markWaiting: 'إلى الانتظار', startService: 'بدء الخدمة', complete: 'إكمال', noShow: 'لم يحضر', cancelAppointment: 'إلغاء الموعد',
  reschedule: 'إعادة الجدولة', saved: 'تم حفظ الموعد.', statusSaved: 'تم تحديث حالة الموعد.', conflict: 'هذا الموظف لديه موعد متداخل.',
  unavailable: 'الوقت خارج ساعات العمل أو يتداخل مع استراحة/إجازة.', invalid: 'أكمل بيانات الموعد واختر وقتًا صحيحًا.',
  writeError: 'مقدرناش نحفظ الموعد.', statusError: 'مقدرناش نحدّث الحالة.', sale: 'فتح البيعة المرتبطة',
  history: 'سجل الموعد',
  cancelConfirm: 'تلغي الموعد ده؟ هيفضل محفوظ في السجل.', noShowConfirm: 'تسجل إن العميل ماجاش؟',
  scheduleTitle: 'جدول الموظف', workDays: 'أيام وساعات العمل', from: 'من', to: 'إلى',
  invalidBlock: 'اختر بداية ونهاية لاحقة للاستراحة أو الإجازة.',
  blockKind: 'نوع التوقف', break: 'استراحة', timeOff: 'إجازة', addBlock: 'إضافة توقف', remove: 'حذف',
  blockStart: 'بداية التوقف', blockEnd: 'نهاية التوقف', blockNote: 'ملاحظة', saveSchedule: 'حفظ الجدول', scheduleSaved: 'تم حفظ جدول الموظف.',
  noShop: 'اعمل متجر الأول من لوحة التحكم.', noLocation: 'اطلب من المالك يضيفك لفرع شغّال من إعدادات النشاط.', noStaff: 'اطلب من المالك يضيف الموظفين والخدمات للفرع قبل الحجز.',
} : {
  title: 'Appointments', subtitle: 'Team calendar, walk-ins, and the live service queue.', add: 'New appointment',
  day: 'Day', week: 'Week', today: 'Today', previous: 'Previous', next: 'Next', allBarbers: 'All staff',
  barber: 'Staff member', branch: 'Location', loading: 'Loading calendar…', empty: 'No appointments in this period.',
  loadError: 'Could not load the calendar.', denied: 'Ask the owner for appointment access, then retry.', retry: 'Retry',
  queue: 'Walk-in and arrival queue', queueEmpty: 'Nobody is waiting.', schedule: 'Working hours & time off',
  create: 'Add appointment', edit: 'Edit appointment', save: 'Save appointment', saving: 'Saving…', cancel: 'Cancel',
  service: 'Service', start: 'Start time', customerType: 'Customer type', customer: 'Saved customer', walkIn: 'Walk-in',
  selectCustomer: 'Select a customer', name: 'Name', phone: 'Phone', notes: 'Notes',
  booked: 'Booked', arrived: 'Arrived', waiting: 'Waiting', in_service: 'In service', completed: 'Completed', cancelled: 'Cancelled', no_show: 'No-show',
  markArrived: 'Mark arrived', markWaiting: 'Add to queue', startService: 'Start service', complete: 'Complete', noShow: 'No-show', cancelAppointment: 'Cancel appointment',
  reschedule: 'Reschedule', saved: 'Appointment saved.', statusSaved: 'Appointment status updated.', conflict: 'This staff member already has an overlapping appointment.',
  unavailable: 'That time is outside working hours or overlaps a break/time off.', invalid: 'Complete the appointment details and choose a valid time.',
  writeError: 'Could not save the appointment.', statusError: 'Could not update the status.', sale: 'Open linked sale',
  history: 'Appointment history',
  cancelConfirm: 'Cancel this appointment? It will remain in the audit history.', noShowConfirm: 'Mark this customer as a no-show?',
  scheduleTitle: 'Staff schedule', workDays: 'Working days and hours', from: 'From', to: 'To',
  invalidBlock: 'Choose a start time and a later end time for the break or time off.',
  blockKind: 'Block type', break: 'Break', timeOff: 'Time off', addBlock: 'Add block', remove: 'Remove',
  blockStart: 'Block starts', blockEnd: 'Block ends', blockNote: 'Note', saveSchedule: 'Save schedule', scheduleSaved: 'Staff schedule saved.',
  noShop: 'Create a shop from the dashboard first.', noLocation: 'Ask the owner to add or assign an active location in Business settings.', noStaff: 'Ask the owner to assign staff and services to this location before booking.',
})

const emptyOptions = (): Options => ({ canManage: false, canManageSchedule: false, locations: [], staff: [], services: [], customers: [] })
const { data: options, pending: optionsPending, error: optionsError, refresh: refreshOptions } = useAsyncData(
  'shop-data:appointment-options', async (): Promise<Options> => {
    if (!currentId.value) return emptyOptions()
    const { data, error } = await shopRpc.rpc('appointment_options', { p_shop_id: currentId.value })
    if (error) throw error
    return data as Options
  }, { watch: [currentId], default: emptyOptions },
)

const locationId = computed<string | null>(() => {
  const sharedLocationId = currentLocationId.value

  return (
    sharedLocationId
    && options.value.locations.some(
      location => location.id === sharedLocationId,
    )
  )
    ? sharedLocationId
    : null
})

async function handleAppointmentLocationChange(value: string | number | null) {
  const nextLocationId = String(value ?? '')

  if (
    !nextLocationId
    || nextLocationId === currentLocationId.value
    || !options.value.locations.some(
      location => location.id === nextLocationId,
    )
  ) {
    return
  }

  await selectLocation(nextLocationId)
}

const locationStaff = computed(() => options.value.staff.filter(member => member.locationIds.includes(locationId.value ?? '')))
watch(locationStaff, (members) => {
  if (staffId.value && !members.some(member => member.membershipId === staffId.value)) staffId.value = null
})

function localMidnight(date: string) { return new Date(`${date}T00:00:00`) }
function addDays(date: Date, amount: number) { const next = new Date(date); next.setDate(next.getDate() + amount); return next }
const range = computed(() => {
  let start = localMidnight(selectedDate.value)
  if (view.value === 'week') start = addDays(start, -start.getDay())
  return { from: start.toISOString(), to: addDays(start, view.value === 'week' ? 7 : 1).toISOString() }
})
const visibleDays = computed(() => {
  const start = new Date(range.value.from)
  return Array.from({ length: view.value === 'week' ? 7 : 1 }, (_, index) => addDays(start, index))
})
const emptyCalendar = (): CalendarData => ({ appointments: [], workingHours: [], blocks: [] })
const { data: calendar, pending, error, refresh } = useAsyncData(
  'shop-data:appointment-calendar', async (): Promise<CalendarData> => {
    if (!currentId.value || !locationId.value) return emptyCalendar()
    const { data, error: readError } = await shopRpc.rpc('appointment_calendar', {
      p_shop_id: currentId.value, p_location_id: locationId.value,
      p_from: range.value.from, p_to: range.value.to, p_membership_id: staffId.value,
    })
    if (readError) throw readError
    return data as CalendarData
  }, { watch: [currentId, locationId, staffId, range], default: emptyCalendar },
)

function dateKey(value: Date | string) {
  const date = typeof value === 'string' ? new Date(value) : value
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
function appointmentsForDay(day: Date) { return calendar.value.appointments.filter(item => dateKey(item.startsAt) === dateKey(day)) }
function formatDay(day: Date) { return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(day) }
function formatTime(value: string) { return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
function move(amount: number) { selectedDate.value = dateKey(addDays(localMidnight(selectedDate.value), amount * (view.value === 'week' ? 7 : 1))) }
function goToday() { selectedDate.value = dateKey(new Date()) }
const queue = computed(() => calendar.value.appointments.filter(item => ['arrived', 'waiting', 'in_service'].includes(item.status)))

const editingId = ref<string | null>(null)
const form = reactive({
  serviceId: '', membershipId: '', startsLocal: '', identityKind: 'customer' as 'customer' | 'walk_in',
  customerId: '', walkInName: '', walkInPhone: '', notes: '',
})
const { visible: showForm, pending: saving, dirty: formDirty } = useRecordAction(() => form)
const eligibleServices = computed(() => options.value.services.filter(service => service.locationIds.includes(locationId.value ?? '')))
const eligibleStaff = computed(() => options.value.staff.filter(member => member.locationIds.includes(locationId.value ?? '')
  && (!form.serviceId || options.value.services.find(service => service.id === form.serviceId)?.staffMembershipIds.includes(member.membershipId))))

function toLocalInput(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}
function resetForm() {
  editingId.value = null; actionError.value = ''
  Object.assign(form, { serviceId: '', membershipId: staffId.value ?? '', startsLocal: `${selectedDate.value}T09:00`,
    identityKind: 'customer', customerId: '', walkInName: '', walkInPhone: '', notes: '' })
}
function openCreate(walkIn = false) {
  resetForm()
  if (walkIn) {
    goToday()
    form.identityKind = 'walk_in'
    form.startsLocal = toLocalInput(new Date())
  }
  showForm.value = true
}
function openEdit(appointment: Appointment) {
  editingId.value = appointment.id
  Object.assign(form, { serviceId: appointment.serviceId, membershipId: appointment.staffMembershipId,
    startsLocal: toLocalInput(appointment.startsAt), identityKind: appointment.identityKind,
    customerId: appointment.customerId ?? '', walkInName: appointment.identityKind === 'walk_in' ? appointment.customerName : '',
    walkInPhone: appointment.identityKind === 'walk_in' ? (appointment.customerPhone ?? '') : '', notes: appointment.notes ?? '' })
  actionError.value = ''; showForm.value = true
}
function readableError(message?: string) {
  if (message?.includes('APPOINTMENT_STAFF_CONFLICT')) return copy.value.conflict
  if (message?.includes('APPOINTMENT_OUTSIDE_WORKING_HOURS') || message?.includes('APPOINTMENT_STAFF_UNAVAILABLE')) return copy.value.unavailable
  if (message?.includes('SHOP_PERMISSION_DENIED')) return copy.value.denied
  if (message?.includes('INVALID_')) return copy.value.invalid
  return copy.value.writeError
}
async function save() {
  if (!currentId.value || !locationId.value || !options.value.canManage || saving.value) return
  actionError.value = ''
  const start = new Date(form.startsLocal)
  if (!form.serviceId || !form.membershipId || Number.isNaN(start.getTime())
    || (form.identityKind === 'customer' && !form.customerId)
    || (form.identityKind === 'walk_in' && form.walkInName.trim().length < 2)) {
    actionError.value = copy.value.invalid; return
  }
  saving.value = true
  try {
    const { error: writeError } = await shopRpc.rpc('save_appointment', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_appointment_id: editingId.value, p_location_id: locationId.value,
      p_membership_id: form.membershipId, p_service_id: form.serviceId,
      p_starts_at: start.toISOString(), p_identity_kind: form.identityKind,
      p_customer_id: form.identityKind === 'customer' ? form.customerId : null,
      p_walk_in_name: form.identityKind === 'walk_in' ? form.walkInName.trim() : null,
      p_walk_in_phone: form.identityKind === 'walk_in' ? (form.walkInPhone.trim() || null) : null,
      p_notes: form.notes.trim() || null,
    })
    if (writeError) throw writeError
    showForm.value = false; await refresh(); pushToast({ tone: 'success', title: copy.value.saved })
  } catch (caught) { actionError.value = readableError(caught instanceof Error ? caught.message : undefined) }
  finally { saving.value = false }
}

async function transition(appointment: Appointment, status: Exclude<AppointmentStatus, 'booked'>) {
  if (!currentId.value || transitionId.value || !options.value.canManage) return
  if (status === 'cancelled' && !await confirmation.ask(copy.value.cancelConfirm)) return
  if (status === 'no_show' && !await confirmation.ask(copy.value.noShowConfirm)) return
  transitionId.value = appointment.id; actionError.value = ''
  try {
    const { error: statusError } = await shopRpc.rpc('transition_appointment', {
      p_request_id: crypto.randomUUID(), p_shop_id: currentId.value,
      p_appointment_id: appointment.id, p_status: status,
      p_reason: status === 'cancelled' ? 'Cancelled by staff' : null,
    })
    if (statusError) throw statusError
    await refresh(); pushToast({ tone: 'success', title: copy.value.statusSaved })
  } catch { actionError.value = copy.value.statusError }
  finally { transitionId.value = null }
}

const scheduleMemberId = ref('')
const scheduleForm = reactive({
  weekdays: Array.from({ length: 7 }, (_, weekday) => ({ weekday, enabled: weekday > 0 && weekday < 6, startsLocal: '09:00', endsLocal: '18:00' })),
  blocks: [] as ScheduleBlock[], blockKind: 'break' as 'break' | 'time_off', blockStarts: '', blockEnds: '', blockNote: '',
})
const { visible: showSchedule, pending: scheduleSaving, dirty: scheduleDirty } = useRecordAction(() => scheduleForm)
function openSchedule() {
  actionError.value = ''
  scheduleMemberId.value = staffId.value ?? locationStaff.value[0]?.membershipId ?? ''
  loadScheduleMember(); showSchedule.value = true
}
function loadScheduleMember() {
  const existing = calendar.value.workingHours.filter(item => item.membershipId === scheduleMemberId.value)
  scheduleForm.weekdays.forEach(day => {
    const saved = existing.find(item => item.weekday === day.weekday)
    day.enabled = Boolean(saved); day.startsLocal = saved?.startsLocal.slice(0, 5) ?? '09:00'; day.endsLocal = saved?.endsLocal.slice(0, 5) ?? '18:00'
  })
  scheduleForm.blocks = calendar.value.blocks.filter(item => item.membershipId === scheduleMemberId.value).map(item => ({ ...item }))
  scheduleForm.blockStarts = ''; scheduleForm.blockEnds = ''; scheduleForm.blockNote = ''
}
function addBlock() {
  const starts = new Date(scheduleForm.blockStarts); const ends = new Date(scheduleForm.blockEnds)
  if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) { actionError.value = copy.value.invalidBlock; return }
  actionError.value = ''
  scheduleForm.blocks.push({ kind: scheduleForm.blockKind, startsAt: starts.toISOString(), endsAt: ends.toISOString(), note: scheduleForm.blockNote.trim() || null })
  scheduleForm.blockStarts = ''; scheduleForm.blockEnds = ''; scheduleForm.blockNote = ''
}
async function saveSchedule() {
  if (!currentId.value || !locationId.value || !scheduleMemberId.value || scheduleSaving.value) return
  scheduleSaving.value = true; actionError.value = ''
  try {
    const { error: writeError } = await shopRpc.rpc('save_staff_schedule', {
      p_shop_id: currentId.value, p_location_id: locationId.value, p_membership_id: scheduleMemberId.value,
      p_timezone: 'Africa/Cairo',
      p_working_hours: scheduleForm.weekdays.filter(day => day.enabled).map(day => ({ weekday: day.weekday, startsLocal: day.startsLocal, endsLocal: day.endsLocal })),
      p_blocks: scheduleForm.blocks.map(block => ({ kind: block.kind, startsAt: block.startsAt, endsAt: block.endsAt, note: block.note })),
    })
    if (writeError) throw writeError
    showSchedule.value = false; await refresh(); pushToast({ tone: 'success', title: copy.value.scheduleSaved })
  } catch (caught) { actionError.value = readableError(caught instanceof Error ? caught.message : undefined) }
  finally { scheduleSaving.value = false }
}
watch([currentId, currentLocationId], () => {
  showForm.value = false; showSchedule.value = false; actionError.value = ''; staffId.value = null
  resetForm()
}, { flush: 'sync' })
const canCreate = computed(() => Boolean(locationId.value && eligibleServices.value.length && locationStaff.value.length && !optionsPending.value && !pending.value && !optionsError.value && !error.value))
const weekdayNames = computed(() => Array.from({ length: 7 }, (_, weekday) => new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { weekday: 'long' }).format(addDays(new Date('2026-09-27T12:00:00'), weekday))))
</script>

<template>
  <BsStack>
    <BsPageHeader  :title="copy.title" :subtitle="copy.subtitle">
      <template #actions>
        <BsButton v-if="options.canManageSchedule" severity="secondary" :disabled="!locationId || !locationStaff.length || pending || optionsPending || Boolean(error || optionsError)" @click="openSchedule">{{ copy.schedule }}</BsButton>
      </template>
    </BsPageHeader>
    <BsPanel v-if="!current && !shopLoading" padding="md">{{ copy.noShop }}</BsPanel>
    <template v-else-if="current">
      <BsToolbar sticky :label="copy.title">
        <BsText as="p" size="sm">
          <BsText as="strong">{{ copy.branch }}:</BsText> {{ options.locations.find(item => item.id === locationId)?.name || copy.noLocation }} · <BsText as="strong">{{ copy.barber }}:</BsText> {{ locationStaff.find(item => item.membershipId === staffId)?.name || copy.allBarbers }}</BsText>
        <BsInline v-if="options.canManage">
          <BsButton variant="primary" :disabled="!canCreate" @click="openCreate()">{{ copy.add }}</BsButton>
          <BsButton :disabled="!canCreate" @click="openCreate(true)">{{ copy.walkIn }}</BsButton>
        </BsInline>
      </BsToolbar>
      <BsText v-if="actionError && !showForm && !showSchedule" role="alert" as="p" size="sm" tone="danger">{{ actionError }}</BsText>
      <BsFilterBar :label="copy.title">
        <BsField v-slot="field" :label="copy.branch">
          <BsSelect :input-id="field.id" :aria-describedby="field.describedby" :model-value="locationId ?? ''" :label="copy.branch" :options="[...(options.locations).map(location => ({ value: location.id, label: (location.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled" @update:model-value="handleAppointmentLocationChange"/>
        </BsField>
        <BsField v-slot="field" :label="copy.barber">
          <BsSelect v-model="staffId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.barber" :options="[{ value: null, label: (copy.allBarbers), disabled: false }, ...(locationStaff).map(member => ({ value: member.membershipId, label: (member.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled"/>
        </BsField>
        <BsInline>
          <BsButton severity="secondary" :aria-label="copy.previous" @click="move(-1)">
            <BsText aria-hidden="true" as="span">{{ isArabic ? '›' : '‹' }}</BsText>
          </BsButton>
          <BsButton severity="secondary" @click="goToday">{{ copy.today }}</BsButton>
          <BsButton severity="secondary" :aria-label="copy.next" @click="move(1)">
            <BsText aria-hidden="true" as="span">{{ isArabic ? '‹' : '›' }}</BsText>
          </BsButton>
        </BsInline>
        <BsInline>
          <BsInline role="group">
            <BsButton variant="chip" type="button" :aria-pressed="view === 'day'" @click="view = 'day'">{{ copy.day }}</BsButton>
            <BsButton variant="chip" type="button" :aria-pressed="view === 'week'" @click="view = 'week'">{{ copy.week }}</BsButton>
          </BsInline>
        </BsInline>
      </BsFilterBar>
      <BsText v-if="optionsPending || pending" role="status" as="p" size="sm" tone="muted">{{ copy.loading }}</BsText>
      <BsPanel v-else-if="optionsError || error" role="alert" padding="md">
        <BsText as="p">{{ (optionsError || error)?.message?.includes('SHOP_PERMISSION_DENIED') ? copy.denied : copy.loadError }}</BsText>
        <BsButton severity="secondary" @click="refreshOptions(); refresh()">{{ copy.retry }}</BsButton>
      </BsPanel>
      <BsText v-else-if="!locationId" as="p" size="sm">{{ copy.noLocation }}</BsText>
      <BsGrid v-else :columns="view === 'week' ? 7 : 1">
        <BsPanel v-for="day in visibleDays" :key="dateKey(day)" padding="md">
          <BsHeading :level="2">{{ formatDay(day) }}</BsHeading>
          <BsText v-if="!appointmentsForDay(day).length" as="p" size="xs" tone="muted">{{ copy.empty }}</BsText>
          <BsList v-else ordered>
            <BsListItem v-for="appointment in appointmentsForDay(day)" :key="appointment.id">
              <BsInline justify="between">
                <BsText as="strong">{{ formatTime(appointment.startsAt) }}–{{ formatTime(appointment.endsAt) }}</BsText>
                <BsStatusBadge :status="appointment.status" :label="copy[appointment.status]" :tone="appointment.status === 'completed' ? 'success' : ['cancelled', 'no_show'].includes(appointment.status) ? 'danger' : appointment.status === 'in_service' ? 'info' : 'neutral'" />
              </BsInline>
              <BsText as="p" emphasis="semibold">{{ appointment.customerName }}</BsText>
              <BsText as="p" size="xs" tone="muted">{{ appointment.serviceName }} · {{ appointment.staffName }}</BsText>
              <BsInline v-if="options.canManage && !['completed','cancelled','no_show'].includes(appointment.status)" :aria-busy="transitionId === appointment.id">
                <BsButton v-if="['booked','arrived','waiting'].includes(appointment.status)" variant="link" :disabled="Boolean(transitionId)" @click="openEdit(appointment)">{{ copy.reschedule }}</BsButton>
                <BsButton v-if="appointment.status === 'booked'" variant="link" :disabled="Boolean(transitionId)" @click="transition(appointment, 'arrived')">{{ copy.markArrived }}</BsButton>
                <BsButton v-if="['booked','arrived'].includes(appointment.status)" variant="link" :disabled="Boolean(transitionId)" @click="transition(appointment, 'waiting')">{{ copy.markWaiting }}</BsButton>
                <BsButton v-if="['arrived','waiting'].includes(appointment.status)" variant="link" :disabled="Boolean(transitionId)" @click="transition(appointment, 'in_service')">{{ copy.startService }}</BsButton>
                <BsButton v-if="appointment.status === 'in_service'" variant="text" :disabled="Boolean(transitionId)" @click="transition(appointment, 'completed')">{{ copy.complete }}</BsButton>
                <BsButton v-if="['booked','arrived','waiting'].includes(appointment.status)" variant="text" :disabled="Boolean(transitionId)" @click="transition(appointment, 'no_show')">{{ copy.noShow }}</BsButton>
                <BsButton variant="text" :disabled="Boolean(transitionId)" @click="transition(appointment, 'cancelled')">{{ copy.cancelAppointment }}</BsButton>
                <BsText v-if="transitionId === appointment.id" role="status" as="span" size="xs">{{ copy.saving }}</BsText>
              </BsInline>
              <BsDisclosure v-if="appointment.history?.length" :summary="copy.history">
                <BsList ordered>
                  <BsListItem v-for="event in appointment.history" :key="`${event.occurredAt}-${event.action}`">{{ new Date(event.occurredAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }} · {{ copy[event.status] }}</BsListItem>
                </BsList>
              </BsDisclosure>
              <BsLink v-if="appointment.saleId" :to="`/sales/${appointment.saleId}`">{{ copy.sale }}</BsLink>
              <BsLink v-else-if="options.canManage && !['cancelled','no_show'].includes(appointment.status)" :to="{ path: '/pos', query: { appointment: appointment.id } }">{{ isArabic ? 'تحصيل الموعد' : 'Check out appointment' }}</BsLink>
            </BsListItem>
          </BsList>
        </BsPanel>
      </BsGrid>
      <BsText v-if="!optionsPending && !pending && !optionsError && !error && locationId && (!locationStaff.length || !eligibleServices.length)" role="status" as="p" size="sm">{{ copy.noStaff }}</BsText>
      <BsPanel v-if="!optionsPending && !pending && !optionsError && !error && locationId" padding="md">
        <BsHeading :level="2">{{ copy.queue }}</BsHeading>
        <BsText v-if="!queue.length" as="p" size="sm" tone="muted">{{ copy.queueEmpty }}</BsText>
        <BsList v-else ordered>
          <BsListItem v-for="appointment in queue" :key="appointment.id">
            <BsInline justify="between">
              <BsText as="strong">{{ appointment.customerName }}</BsText>
              <BsText as="span" size="xs" emphasis="semibold">{{ copy[appointment.status] }}</BsText>
            </BsInline>
            <BsText as="p" size="xs" tone="muted">{{ formatTime(appointment.startsAt) }} · {{ appointment.staffName }}</BsText>
            <BsButton v-if="appointment.status !== 'in_service' && options.canManage" severity="secondary" :disabled="Boolean(transitionId)" :pending="transitionId === appointment.id" @click="transition(appointment, 'in_service')">{{ copy.startService }}</BsButton>
            <BsButton v-else-if="options.canManage" severity="secondary" :disabled="Boolean(transitionId)" :pending="transitionId === appointment.id" @click="transition(appointment, 'completed')">{{ copy.complete }}</BsButton>
          </BsListItem>
        </BsList>
      </BsPanel>
    </template>
    <BsRecordActionDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.create" :dirty="formDirty" :pending="saving" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="save">
      <BsField v-slot="field" :label="copy.service">
        <BsSelect v-model="form.serviceId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.service" :options="eligibleServices" option-label="name" option-value="id" filter virtual :aria-required="true"/>
      </BsField>
      <BsField v-slot="field" :label="copy.barber">
        <BsSelect v-model="form.membershipId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.barber" :options="eligibleStaff" option-label="name" option-value="membershipId" filter virtual :aria-required="true"/>
      </BsField>
      <BsField v-slot="field" :label="copy.start">
        <BsInput :id="field.id" v-model="form.startsLocal" :aria-describedby="field.describedby" type="datetime-local" required/>
      </BsField>
      <BsFieldGroup :legend="(copy.customerType)">
        <BsInline>
          <BsRadio  v-model="form.identityKind" value="customer" :label="copy.customer" />
          <BsRadio  v-model="form.identityKind" value="walk_in" :label="copy.walkIn" />
        </BsInline>
      </BsFieldGroup>
      <BsField v-if="form.identityKind === 'customer'" v-slot="field" :label="copy.customer">
        <BsSelect v-model="form.customerId" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.customer" :options="options.customers" option-label="name" option-value="id" :placeholder="copy.selectCustomer" filter virtual :aria-required="true"/>
      </BsField>
      <template v-else>
        <BsField v-slot="field" :label="copy.name">
          <BsInput :id="field.id" v-model="form.walkInName" :aria-describedby="field.describedby" :minlength="2" :maxlength="160" required/>
        </BsField>
        <BsField v-slot="field" :label="copy.phone">
          <BsInput :id="field.id" v-model="form.walkInPhone" :aria-describedby="field.describedby" :maxlength="40" dir="ltr"/>
        </BsField>
      </template>
      <BsField v-slot="field" :label="copy.notes">
        <BsTextarea :id="field.id" v-model="form.notes" :aria-describedby="field.describedby" :maxlength="1000" :rows="2"/>
      </BsField>
    </BsRecordActionDialog>
    <BsDialog v-model:visible="showSchedule" :title="copy.scheduleTitle" size="lg" :dirty="scheduleDirty" :pending="scheduleSaving">
      <template #default="{ close }">
        <BsForm :pending="scheduleSaving" :error="actionError" @submit="saveSchedule">
          <BsField v-slot="field" :label="copy.barber">
            <BsSelect v-model="scheduleMemberId" :input-id="field.id" :aria-describedby="field.describedby" required :label="copy.barber" :options="[...(locationStaff).map(member => ({ value: member.membershipId, label: (member.name), disabled: false }))]" option-label="label" option-value="value" option-disabled="disabled" @change="loadScheduleMember"/>
          </BsField>
          <BsFieldGroup :legend="(copy.workDays)">
            <BsStack>
              <BsGrid v-for="day in scheduleForm.weekdays" :key="day.weekday" :columns="2">
                <BsCheckbox  v-model="day.enabled" :label="weekdayNames[day.weekday] ?? String(day.weekday)" />
                <BsInput v-model="day.startsLocal" type="time" :aria-label="`${weekdayNames[day.weekday]} · ${copy.from}`" :disabled="!day.enabled"/>
                <BsInput v-model="day.endsLocal" type="time" :aria-label="`${weekdayNames[day.weekday]} · ${copy.to}`" :disabled="!day.enabled"/>
              </BsGrid>
            </BsStack>
          </BsFieldGroup>
          <BsFieldGroup :legend="(copy.break) + ' / ' + (copy.timeOff)">
            <BsGrid :columns="2">
              <BsField v-slot="field" :label="copy.blockKind">
                <BsSelect v-model="scheduleForm.blockKind" :input-id="field.id" :aria-describedby="field.describedby" :label="copy.blockKind" :options="[{ value: 'break', label: (copy.break), disabled: false }, { value: 'time_off', label: (copy.timeOff), disabled: false }]" option-label="label" option-value="value" option-disabled="disabled"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockNote">
                <BsInput :id="field.id" v-model="scheduleForm.blockNote" :aria-describedby="field.describedby" :maxlength="500"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockStart">
                <BsInput :id="field.id" v-model="scheduleForm.blockStarts" :aria-describedby="field.describedby" type="datetime-local"/>
              </BsField>
              <BsField v-slot="field" :label="copy.blockEnd">
                <BsInput :id="field.id" v-model="scheduleForm.blockEnds" :aria-describedby="field.describedby" type="datetime-local"/>
              </BsField>
              <BsButton severity="secondary" @click="addBlock">{{ copy.addBlock }}</BsButton>
            </BsGrid>
            <BsList>
              <BsListItem v-for="(block, index) in scheduleForm.blocks" :key="`${block.startsAt}-${index}`">
                <BsText as="span">{{ block.kind === 'break' ? copy.break : copy.timeOff }} · {{ new Date(block.startsAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }}–{{ new Date(block.endsAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }}</BsText>
                <BsButton variant="text" type="button" @click="scheduleForm.blocks.splice(index, 1)">{{ copy.remove }}</BsButton>
              </BsListItem>
            </BsList>
          </BsFieldGroup>
          <BsInline>
            <BsButton type="submit" :pending="scheduleSaving">{{ copy.saveSchedule }}</BsButton>
            <BsButton severity="secondary" :disabled="scheduleSaving" @click="close">{{ copy.cancel }}</BsButton>
          </BsInline>
        </BsForm>
      </template>
    </BsDialog>
  </BsStack>
</template>

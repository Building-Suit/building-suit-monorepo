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

async function handleAppointmentLocationChange(event: Event) {
  const nextLocationId = (event.target as HTMLSelectElement).value

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
function statusClass(status: AppointmentStatus) {
  if (status === 'completed') return 'bg-[var(--bs-status-success-bg)] text-[var(--bs-status-success)]'
  if (status === 'cancelled' || status === 'no_show') return 'bg-[var(--bs-status-error-bg)] text-[var(--bs-status-error)]'
  if (status === 'in_service') return 'bg-primary/15 text-primary'
  return 'bg-muted text-foreground'
}
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
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div><h1 class="text-3xl font-extrabold tracking-tight">{{ copy.title }}</h1><p class="mt-2 text-sm text-muted-foreground">{{ copy.subtitle }}</p></div>
      <BsButton v-if="options.canManageSchedule" severity="secondary" :disabled="!locationId || !locationStaff.length || pending || optionsPending || Boolean(error || optionsError)" @click="openSchedule">{{ copy.schedule }}</BsButton>
    </header>

    <div v-if="!current && !shopLoading" class="ls-card p-8 text-center text-sm">{{ copy.noShop }}</div>
    <template v-else-if="current">
      <section class="sticky top-20 z-10 flex flex-wrap items-center justify-between gap-3 ls-card-flat p-3" :aria-label="copy.title">
        <p class="min-w-0 break-words text-sm"><strong>{{ copy.branch }}:</strong> {{ options.locations.find(item => item.id === locationId)?.name || copy.noLocation }} · <strong>{{ copy.barber }}:</strong> {{ locationStaff.find(item => item.membershipId === staffId)?.name || copy.allBarbers }}</p>
        <div v-if="options.canManage" class="flex flex-wrap gap-2">
          <BsButton variant="primary" :disabled="!canCreate" @click="openCreate()">{{ copy.add }}</BsButton>
          <BsButton :disabled="!canCreate" @click="openCreate(true)">{{ copy.walkIn }}</BsButton>
        </div>
      </section>
      <p v-if="actionError && !showForm && !showSchedule" role="alert" class="rounded-xl bg-[var(--bs-status-error-bg)] p-3 text-sm text-[var(--bs-status-error)]">{{ actionError }}</p>
      <section class="grid gap-3 ls-card p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto_auto]">
        <label class="grid gap-1 text-sm font-bold">{{ copy.branch }}<select class="ls-input min-h-11" :value="locationId ?? ''" @change="handleAppointmentLocationChange"><option v-for="location in options.locations" :key="location.id" :value="location.id">{{ location.name }}</option></select></label>
        <label class="grid gap-1 text-sm font-bold">{{ copy.barber }}<select v-model="staffId" class="ls-input min-h-11"><option :value="null">{{ copy.allBarbers }}</option><option v-for="member in locationStaff" :key="member.membershipId" :value="member.membershipId">{{ member.name }}</option></select></label>
        <div class="flex items-end gap-1"><BsButton severity="secondary" :aria-label="copy.previous" @click="move(-1)"><span aria-hidden="true">{{ isArabic ? '›' : '‹' }}</span></BsButton><BsButton severity="secondary" @click="goToday">{{ copy.today }}</BsButton><BsButton severity="secondary" :aria-label="copy.next" @click="move(1)"><span aria-hidden="true">{{ isArabic ? '‹' : '›' }}</span></BsButton></div>
        <div class="flex items-end"><div class="flex rounded-xl border border-border p-1" role="group"><BsButton variant="chip" type="button" class="min-h-11 rounded-lg px-3 text-sm font-bold" :aria-pressed="view === 'day'" @click="view = 'day'">{{ copy.day }}</BsButton><BsButton variant="chip" type="button" class="min-h-11 rounded-lg px-3 text-sm font-bold" :aria-pressed="view === 'week'" @click="view = 'week'">{{ copy.week }}</BsButton></div></div>
      </section>

      <p v-if="optionsPending || pending" role="status" class="ls-card p-8 text-center text-sm text-muted-foreground">{{ copy.loading }}</p>
      <div v-else-if="optionsError || error" role="alert" class="ls-card p-8 text-center text-sm"><p>{{ (optionsError || error)?.message?.includes('SHOP_PERMISSION_DENIED') ? copy.denied : copy.loadError }}</p><BsButton severity="secondary" class="mt-3" @click="refreshOptions(); refresh()">{{ copy.retry }}</BsButton></div>
      <p v-else-if="!locationId" class="ls-card p-8 text-center text-sm">{{ copy.noLocation }}</p>
      <div v-else class="grid gap-4" :class="view === 'week' ? 'md:grid-cols-2 xl:grid-cols-7' : ''">
        <section v-for="day in visibleDays" :key="dateKey(day)" class="min-w-0 ls-card p-3">
          <h2 class="border-b border-border pb-3 text-sm font-extrabold">{{ formatDay(day) }}</h2>
          <p v-if="!appointmentsForDay(day).length" class="py-8 text-center text-xs text-muted-foreground">{{ copy.empty }}</p>
          <ol v-else class="mt-3 space-y-3">
            <li v-for="appointment in appointmentsForDay(day)" :key="appointment.id" class="rounded-xl border border-border p-3 text-sm">
              <div class="flex flex-wrap items-center justify-between gap-2"><strong>{{ formatTime(appointment.startsAt) }}–{{ formatTime(appointment.endsAt) }}</strong><span class="rounded-full px-2 py-1 text-xs font-bold" :class="statusClass(appointment.status)">{{ copy[appointment.status] }}</span></div>
              <p class="mt-2 font-bold">{{ appointment.customerName }}</p><p class="text-xs text-muted-foreground">{{ appointment.serviceName }} · {{ appointment.staffName }}</p>
              <div v-if="options.canManage && !['completed','cancelled','no_show'].includes(appointment.status)" class="mt-3 flex flex-wrap gap-2" :aria-busy="transitionId === appointment.id">
                <BsButton variant="link" v-if="['booked','arrived','waiting'].includes(appointment.status)" class="text-[var(--bs-link)]" :disabled="Boolean(transitionId)" @click="openEdit(appointment)">{{ copy.reschedule }}</BsButton>
                <BsButton variant="link" v-if="appointment.status === 'booked'" class="text-[var(--bs-link)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'arrived')">{{ copy.markArrived }}</BsButton>
                <BsButton variant="link" v-if="['booked','arrived'].includes(appointment.status)" class="text-[var(--bs-link)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'waiting')">{{ copy.markWaiting }}</BsButton>
                <BsButton variant="link" v-if="['arrived','waiting'].includes(appointment.status)" class="text-[var(--bs-link)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'in_service')">{{ copy.startService }}</BsButton>
                <BsButton variant="text" v-if="appointment.status === 'in_service'" class="text-[var(--bs-status-success)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'completed')">{{ copy.complete }}</BsButton>
                <BsButton variant="text" v-if="['booked','arrived','waiting'].includes(appointment.status)" class="text-[var(--bs-status-error)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'no_show')">{{ copy.noShow }}</BsButton>
                <BsButton variant="text" class="text-[var(--bs-status-error)]" :disabled="Boolean(transitionId)" @click="transition(appointment, 'cancelled')">{{ copy.cancelAppointment }}</BsButton>
                <span v-if="transitionId === appointment.id" role="status" class="self-center text-xs">{{ copy.saving }}</span>
              </div>
              <details v-if="appointment.history?.length" class="mt-3 text-xs"><summary class="min-h-11 cursor-pointer py-3 font-bold text-[var(--bs-link)]">{{ copy.history }}</summary><ol class="mt-2 space-y-1 text-muted-foreground"><li v-for="event in appointment.history" :key="`${event.occurredAt}-${event.action}`">{{ new Date(event.occurredAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }} · {{ copy[event.status] }}</li></ol></details>
              <NuxtLink v-if="appointment.saleId" :to="`/sales/${appointment.saleId}`" class="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--bs-link)] underline">{{ copy.sale }}</NuxtLink>
              <NuxtLink v-else-if="options.canManage && !['cancelled','no_show'].includes(appointment.status)" :to="{ path: '/pos', query: { appointment: appointment.id } }" class="mt-3 inline-flex min-h-11 items-center font-bold text-[var(--bs-link)] underline">{{ isArabic ? 'تحصيل الموعد' : 'Check out appointment' }}</NuxtLink>
            </li>
          </ol>
        </section>
      </div>

      <p v-if="!optionsPending && !pending && !optionsError && !error && locationId && (!locationStaff.length || !eligibleServices.length)" role="status" class="rounded-xl border border-border p-4 text-sm">{{ copy.noStaff }}</p>
      <section v-if="!optionsPending && !pending && !optionsError && !error && locationId" class="ls-card p-5"><h2 class="text-lg font-extrabold">{{ copy.queue }}</h2><p v-if="!queue.length" class="mt-4 text-sm text-muted-foreground">{{ copy.queueEmpty }}</p><ol v-else class="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><li v-for="appointment in queue" :key="appointment.id" class="rounded-xl border border-border p-4"><div class="flex items-center justify-between gap-2"><strong>{{ appointment.customerName }}</strong><span class="rounded-full px-2 py-1 text-xs font-bold" :class="statusClass(appointment.status)">{{ copy[appointment.status] }}</span></div><p class="mt-1 text-xs text-muted-foreground">{{ formatTime(appointment.startsAt) }} · {{ appointment.staffName }}</p><BsButton v-if="appointment.status !== 'in_service' && options.canManage" severity="secondary" class="mt-3" :disabled="Boolean(transitionId)" :pending="transitionId === appointment.id" @click="transition(appointment, 'in_service')">{{ copy.startService }}</BsButton><BsButton v-else-if="options.canManage" severity="secondary" class="mt-3" :disabled="Boolean(transitionId)" :pending="transitionId === appointment.id" @click="transition(appointment, 'completed')">{{ copy.complete }}</BsButton></li></ol></section>
    </template>

    <BsRecordActionDialog v-model:visible="showForm" :title="editingId ? copy.edit : copy.create" :dirty="formDirty" :pending="saving" :error="actionError" :submit-label="copy.save" :cancel-label="copy.cancel" @submit="save">
        <label class="grid gap-2 text-sm font-bold">{{ copy.service }}<BsSelect v-model="form.serviceId" :label="copy.service" :options="eligibleServices" option-label="name" option-value="id" filter virtual :aria-required="true" /></label>
        <label class="grid gap-2 text-sm font-bold">{{ copy.barber }}<BsSelect v-model="form.membershipId" :label="copy.barber" :options="eligibleStaff" option-label="name" option-value="membershipId" filter virtual :aria-required="true" /></label>
        <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.start }}<input v-model="form.startsLocal" type="datetime-local" required class="ls-input min-h-11 min-w-0"></label>
        <fieldset class="sm:col-span-2"><legend class="text-sm font-bold">{{ copy.customerType }}</legend><div class="mt-2 flex flex-wrap gap-4"><label class="flex min-h-11 items-center gap-2"><input v-model="form.identityKind" type="radio" value="customer">{{ copy.customer }}</label><label class="flex min-h-11 items-center gap-2"><input v-model="form.identityKind" type="radio" value="walk_in">{{ copy.walkIn }}</label></div></fieldset>
        <label v-if="form.identityKind === 'customer'" class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.customer }}<BsSelect v-model="form.customerId" :label="copy.customer" :options="options.customers" option-label="name" option-value="id" :placeholder="copy.selectCustomer" filter virtual :aria-required="true" /></label>
        <template v-else><label class="grid gap-2 text-sm font-bold">{{ copy.name }}<input v-model="form.walkInName" minlength="2" maxlength="160" required class="ls-input min-h-11 min-w-0"></label><label class="grid gap-2 text-sm font-bold">{{ copy.phone }}<input v-model="form.walkInPhone" maxlength="40" class="ls-input min-h-11 min-w-0" dir="ltr"></label></template>
        <label class="grid gap-2 text-sm font-bold sm:col-span-2">{{ copy.notes }}<textarea v-model="form.notes" maxlength="1000" rows="2" class="ls-input min-h-11 min-w-0" /></label>
    </BsRecordActionDialog>

    <BsDialog v-model:visible="showSchedule" :title="copy.scheduleTitle" size="lg" :dirty="scheduleDirty" :pending="scheduleSaving">
      <template #default="{ close }"><BsForm class="space-y-5" :pending="scheduleSaving" :error="actionError" @submit="saveSchedule">
        <label class="grid gap-2 text-sm font-bold">{{ copy.barber }}<select v-model="scheduleMemberId" required class="ls-input min-h-11 min-w-0" @change="loadScheduleMember"><option v-for="member in locationStaff" :key="member.membershipId" :value="member.membershipId">{{ member.name }}</option></select></label>
        <fieldset><legend class="text-sm font-bold">{{ copy.workDays }}</legend><div class="mt-3 space-y-2"><div v-for="day in scheduleForm.weekdays" :key="day.weekday" class="grid grid-cols-2 items-center gap-2 rounded-xl border border-border p-2 sm:grid-cols-[minmax(7rem,1fr)_1fr_1fr]"><label class="col-span-2 flex min-h-11 items-center gap-2 text-sm sm:col-span-1"><input v-model="day.enabled" type="checkbox">{{ weekdayNames[day.weekday] }}</label><input v-model="day.startsLocal" type="time" class="ls-input min-h-11 min-w-0" :aria-label="`${weekdayNames[day.weekday]} · ${copy.from}`" :disabled="!day.enabled"><input v-model="day.endsLocal" type="time" class="ls-input min-h-11 min-w-0" :aria-label="`${weekdayNames[day.weekday]} · ${copy.to}`" :disabled="!day.enabled"></div></div></fieldset>
        <fieldset><legend class="text-sm font-bold">{{ copy.break }} / {{ copy.timeOff }}</legend><div class="mt-3 grid gap-3 sm:grid-cols-2"><label class="grid gap-1 text-sm">{{ copy.blockKind }}<select v-model="scheduleForm.blockKind" class="ls-input min-h-11 min-w-0"><option value="break">{{ copy.break }}</option><option value="time_off">{{ copy.timeOff }}</option></select></label><label class="grid gap-1 text-sm">{{ copy.blockNote }}<input v-model="scheduleForm.blockNote" maxlength="500" class="ls-input min-h-11 min-w-0"></label><label class="grid gap-1 text-sm">{{ copy.blockStart }}<input v-model="scheduleForm.blockStarts" type="datetime-local" class="ls-input min-h-11 min-w-0"></label><label class="grid gap-1 text-sm">{{ copy.blockEnd }}<input v-model="scheduleForm.blockEnds" type="datetime-local" class="ls-input min-h-11 min-w-0"></label><BsButton severity="secondary" class="sm:col-span-2" @click="addBlock">{{ copy.addBlock }}</BsButton></div><ul class="mt-3 space-y-2"><li v-for="(block, index) in scheduleForm.blocks" :key="`${block.startsAt}-${index}`" class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"><span>{{ block.kind === 'break' ? copy.break : copy.timeOff }} · {{ new Date(block.startsAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }}–{{ new Date(block.endsAt).toLocaleString(isArabic ? 'ar-EG' : 'en-EG') }}</span><BsButton variant="text" type="button" class="min-h-11 min-w-11 font-bold text-[var(--bs-status-error)]" @click="scheduleForm.blocks.splice(index, 1)">{{ copy.remove }}</BsButton></li></ul></fieldset>
        <div class="flex gap-2"><BsButton type="submit" :pending="scheduleSaving">{{ copy.saveSchedule }}</BsButton><BsButton severity="secondary" :disabled="scheduleSaving" @click="close">{{ copy.cancel }}</BsButton></div>
      </BsForm></template>
    </BsDialog>
  </div>
</template>

<script setup lang="ts">
import type { BsAppointmentForm, BsAppointmentScheduleForm, BsAppointmentCard, BsAppointmentsView, BsAppointmentChoices, BsAppointmentBlockView } from '@building-suit/ui/types/appointmentsPresentation'
import { calendarDateKey, calendarAddDays, calendarLocalDate, useCalendarNavigation } from '@building-suit/ux'
import { readAppointmentCalendar, appointmentsForCalendarDay } from '~/utils/appointmentCalendar'
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
const { selectedDate, view, days: visibleDays, range, move, selectDate, today: goToday } = useCalendarNavigation(typeof route.query.from === 'string' ? route.query.from : calendarDateKey(new Date()))
const staffId = ref<string | null>(null)
const actionError = ref('')
const transitionId = ref<string | null>(null)

const copy = computed(() => isArabic.value ? {
  blockDetails: 'تفاصيل فترة عدم التوفر', title: 'المواعيد', subtitle: 'تقويم الفريق وقائمة الانتظار والحضور بدون حجز.', add: 'موعد جديد',
  day: 'يوم', week: 'أسبوع', month: 'شهر', date: 'التاريخ', actions: 'إجراءات الموعد', today: 'اليوم', previous: 'السابق', next: 'التالي', allBarbers: 'كل الموظفين',
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
  blockDetails: 'Schedule block details', title: 'Appointments', subtitle: 'Team calendar, walk-ins, and the live service queue.', add: 'New appointment',
  day: 'Day', week: 'Week', month: 'Month', date: 'Date', actions: 'Appointment actions', today: 'Today', previous: 'Previous', next: 'Next', allBarbers: 'All staff',
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
// Calendar reads depend on the authorized location options, including during SSR.
const { data: options, pending: optionsPending, error: optionsError, refresh: refreshOptions } = await useAsyncData(
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

const addDays = calendarAddDays
const emptyCalendar = (): CalendarData => ({ appointments: [], workingHours: [], blocks: [] })
const { data: calendar, pending, error, refresh } = useAsyncData(
  'shop-data:appointment-calendar', async (): Promise<CalendarData> => {
    if (!currentId.value || !locationId.value) return emptyCalendar()
    return readAppointmentCalendar<CalendarData>(visibleDays.value, range.value.to, async (from, to) => {
      const { data, error: readError } = await shopRpc.rpc('appointment_calendar', {
        p_shop_id: currentId.value!, p_location_id: locationId.value!,
        p_from: from, p_to: to, p_membership_id: staffId.value,
      })
      return { data: data as CalendarData | null, error: readError }
    })
  }, { watch: [currentId, locationId, staffId, range], default: emptyCalendar },
)

const dateKey = calendarDateKey
function appointmentsForDay(day: Date) { return appointmentsForCalendarDay(calendar.value.appointments, day) }
function formatDay(day: Date) { return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { weekday: 'short', day: 'numeric', month: 'short' }).format(day) }
function formatTime(value: string) { return new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) }
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

useShopRealtime('appointments', () => formDirty.value || scheduleDirty.value)

const appointmentForm = computed<BsAppointmentForm>({ get: () => ({ ...form }), set: value => { Object.assign(form, value, { identityKind: value.identityKind === 'walk_in' ? 'walk_in' : 'customer' }) } })
const appointmentSchedule = computed<BsAppointmentScheduleForm>({ get: () => ({ weekdays: scheduleForm.weekdays.map(day => ({ ...day })), blockKind: scheduleForm.blockKind, blockStarts: scheduleForm.blockStarts, blockEnds: scheduleForm.blockEnds, blockNote: scheduleForm.blockNote }), set: value => { Object.assign(scheduleForm, value, { blockKind: value.blockKind === 'time_off' ? 'time_off' : 'break' }) } })
function appointmentCard(item: Appointment): BsAppointmentCard {
  const terminal = ['completed', 'cancelled', 'no_show'].includes(item.status)
  const actions: BsAppointmentCard['actions'] = []
  if (options.value.canManage && !terminal) {
    if (item.status === 'booked') actions.push({ id: 'arrived', label: copy.value.markArrived, text: false })
    if (['booked', 'arrived'].includes(item.status)) actions.push({ id: 'waiting', label: copy.value.markWaiting, text: false })
    if (['arrived', 'waiting'].includes(item.status)) actions.push({ id: 'in_service', label: copy.value.startService, text: false })
    if (item.status === 'in_service') actions.push({ id: 'completed', label: copy.value.complete, text: true })
    if (['booked', 'arrived', 'waiting'].includes(item.status)) actions.push({ id: 'no_show', label: copy.value.noShow, text: true })
    actions.push({ id: 'cancelled', label: copy.value.cancelAppointment, text: true })
  }
  return { id: item.id, time: `${formatTime(item.startsAt)}–${formatTime(item.endsAt)}`, queueTime: formatTime(item.startsAt), status: item.status, statusLabel: copy.value[item.status], tone: item.status === 'completed' ? 'success' : ['cancelled', 'no_show'].includes(item.status) ? 'danger' : item.status === 'in_service' ? 'info' : 'neutral', customerName: item.customerName, detail: `${item.serviceName} · ${item.staffName}`, queueDetail: `${view.value === 'day' ? '' : formatDay(new Date(item.startsAt)) + ' · '}${formatTime(item.startsAt)} · ${item.staffName}`, pending: transitionId.value === item.id, canEdit: options.value.canManage && ['booked', 'arrived', 'waiting'].includes(item.status), actions, queueAction: options.value.canManage ? { id: item.status === 'in_service' ? 'completed' : 'in_service', label: item.status === 'in_service' ? copy.value.complete : copy.value.startService } : null, history: (item.history ?? []).map(event => ({ id: `${event.occurredAt}-${event.action}`, label: `${new Date(event.occurredAt).toLocaleString(isArabic.value ? 'ar-EG' : 'en-EG')} · ${copy.value[event.status]}` })), link: item.saleId ? { to: `/sales/${item.saleId}`, label: copy.value.sale } : options.value.canManage && !['cancelled', 'no_show'].includes(item.status) ? { to: `/pos?appointment=${encodeURIComponent(item.id)}`, label: isArabic.value ? 'تحصيل الموعد' : 'Check out appointment' } : null }
}
function scheduleBlockCard(block: ScheduleBlock): BsAppointmentBlockView {
  const localeName = isArabic.value ? 'ar-EG' : 'en-EG'
  const full = new Intl.DateTimeFormat(localeName, { dateStyle: 'medium', timeStyle: 'short' })
  const time = new Intl.DateTimeFormat(localeName, { hour: 'numeric', minute: '2-digit' })
  return { id: block.id ?? `${block.membershipId}:${block.kind}:${block.startsAt}:${block.endsAt}`,
    kindLabel: block.kind === 'break' ? copy.value.break : copy.value.timeOff,
    staff: locationStaff.value.find(member => member.membershipId === block.membershipId)?.name || '—',
    time: `${time.format(new Date(block.startsAt))} — ${time.format(new Date(block.endsAt))}`,
    starts: full.format(new Date(block.startsAt)), ends: full.format(new Date(block.endsAt)), note: block.note }
}
function blocksForDay(day: Date) {
  return appointmentsForCalendarDay(calendar.value.blocks.filter(block => !staffId.value || block.membershipId === staffId.value), day).map(scheduleBlockCard)
}
const appointmentPresentation = computed<BsAppointmentsView>(() => ({ exists: Boolean(current.value), shopLoading: shopLoading.value, canManage: options.value.canManage, canSchedule: options.value.canManageSchedule, scheduleDisabled: !locationId.value || !locationStaff.value.length || pending.value || optionsPending.value || Boolean(error.value || optionsError.value), canCreate: canCreate.value, locationId: locationId.value, locationName: options.value.locations.find(item => item.id === locationId.value)?.name || copy.value.noLocation, staffName: locationStaff.value.find(item => item.membershipId === staffId.value)?.name || copy.value.allBarbers, loading: optionsPending.value || pending.value, failed: Boolean(optionsError.value || error.value), failureMessage: (optionsError.value || error.value)?.message?.includes('SHOP_PERMISSION_DENIED') ? copy.value.denied : copy.value.loadError, noStaff: !optionsPending.value && !pending.value && !optionsError.value && !error.value && Boolean(locationId.value) && (!locationStaff.value.length || !eligibleServices.value.length), error: actionError.value, transitioning: Boolean(transitionId.value), formTitle: editingId.value ? copy.value.edit : copy.value.create, formDirty: formDirty.value, saving: saving.value, scheduleDirty: scheduleDirty.value, scheduleSaving: scheduleSaving.value, previousSymbol: isArabic.value ? '›' : '‹', nextSymbol: isArabic.value ? '‹' : '›', rangeLabel: view.value === 'month' ? new Intl.DateTimeFormat(isArabic.value ? 'ar-EG' : 'en-EG', { month: 'long', year: 'numeric' }).format(calendarLocalDate(selectedDate.value)) : visibleDays.value.length === 1 ? formatDay(visibleDays.value[0]!) : `${formatDay(visibleDays.value[0]!)} — ${formatDay(visibleDays.value[visibleDays.value.length - 1]!)}`, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
 days: visibleDays.value.map(day => ({ id: dateKey(day), today: dateKey(day) === dateKey(new Date()), outside: view.value === 'month' && day.getMonth() !== calendarLocalDate(selectedDate.value).getMonth(), label: formatDay(day), appointments: appointmentsForDay(day).map(appointmentCard), blocks: blocksForDay(day) })), queue: queue.value.map(appointmentCard), weekdayNames: weekdayNames.value, blocks: scheduleForm.blocks.map((block, index) => ({ id: `${block.startsAt}-${index}`, index, label: `${block.kind === 'break' ? copy.value.break : copy.value.timeOff} · ${new Date(block.startsAt).toLocaleString(isArabic.value ? 'ar-EG' : 'en-EG')}–${new Date(block.endsAt).toLocaleString(isArabic.value ? 'ar-EG' : 'en-EG')}` })), constraints: { nameMin: 2, nameMax: 160, phoneMax: 40, notesMax: 1000, blockNoteMax: 500 } }))
const appointmentChoices = computed<BsAppointmentChoices>(() => ({ locations: options.value.locations.map(item => ({ value: item.id, label: item.name })), staff: [{ value: null, label: copy.value.allBarbers }, ...locationStaff.value.map(item => ({ value: item.membershipId, label: item.name }))], scheduleStaff: locationStaff.value.map(item => ({ value: item.membershipId, label: item.name })), services: eligibleServices.value.map(item => ({ value: item.id, label: item.name })), eligibleStaff: eligibleStaff.value.map(item => ({ value: item.membershipId, label: item.name })), customers: options.value.customers.map(item => ({ value: item.id, label: item.name })) }))
function editAppointment(id: string) { const item = calendar.value.appointments.find(row => row.id === id); if (item) openEdit(item) }
async function transitionAppointment(id: string, status: string) { const item = calendar.value.appointments.find(row => row.id === id); if (item && ['arrived','waiting','in_service','completed','cancelled','no_show'].includes(status)) await transition(item, status as Exclude<AppointmentStatus, 'booked'>) }
async function retryAppointments() { await Promise.all([refreshOptions(), refresh()]) }
function removeScheduleBlock(index: number) { scheduleForm.blocks.splice(index, 1) }
const appointmentView = computed({ get: () => view.value, set: value => { if (value === 'day' || value === 'week' || value === 'month') view.value = value } })
</script>
<template>
  <BsAppointmentsPage v-model:view="appointmentView" v-model:staff-id="staffId" v-model:show-form="showForm" v-model:show-schedule="showSchedule" v-model:form="appointmentForm" v-model:schedule-form="appointmentSchedule" v-model:schedule-member-id="scheduleMemberId" :selected-date="selectedDate" :copy="copy" :presentation="appointmentPresentation" :choices="appointmentChoices" @create="openCreate" @edit="editAppointment" @transition="transitionAppointment" @date="selectDate" @move="move" @today="goToday" @retry="retryAppointments" @location="handleAppointmentLocationChange" @save="save" @open-schedule="openSchedule" @schedule-member="loadScheduleMember" @save-schedule="saveSchedule" @add-block="addBlock" @remove-block="removeScheduleBlock" />
</template>

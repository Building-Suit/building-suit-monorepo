export interface BsAppointmentsCopy {
  add: string
  addBlock: string
  allBarbers: string
  barber: string
  blockDetails?: string
  blockDraft?: string
  blockEnd: string
  blockKind: string
  blockNote: string
  blockStart: string
  branch: string
  break: string
  cancel: string
  cancelAppointment: string
  complete: string
  create: string
  customer: string
  customerType: string
  month?: string
  date?: string
  actions?: string
  day: string
  denied: string
  edit: string
  empty: string
  from: string
  history: string
  loadError: string
  loading: string
  markArrived: string
  markWaiting: string
  name: string
  next: string
  noLocation: string
  noShop: string
  noShow: string
  noStaff: string
  notes: string
  phone: string
  previous: string
  queue: string
  queueEmpty: string
  remove: string
  reschedule: string
  retry: string
  sale: string
  save: string
  saveSchedule: string
  saving: string
  schedule: string
  scheduleTitle: string
  scheduleSwitchHint?: string
  selectCustomer: string
  service: string
  start: string
  startService: string
  subtitle: string
  timeOff: string
  title: string
  to: string
  today: string
  walkIn: string
  week: string
  workDays: string
}
export interface BsAppointmentChoice { value: string | null; label: string }
export interface BsAppointmentForm { serviceId: string; membershipId: string; startsLocal: string; identityKind: string; customerId: string; walkInName: string; walkInPhone: string; notes: string }
export interface BsAppointmentScheduleForm { weekdays: { weekday: number; enabled: boolean; startsLocal: string; endsLocal: string }[]; blockKind: string; blockStarts: string; blockEnds: string; blockNote: string }
export interface BsAppointmentCard { id: string; time: string; queueTime: string; status: string; statusLabel: string; tone: 'success' | 'danger' | 'info' | 'neutral'; customerName: string; detail: string; queueDetail: string; pending: boolean; canEdit: boolean; actions: { id: string; label: string; text: boolean }[]; queueAction: { id: string; label: string } | null; history: { id: string; label: string }[]; link: { to: string; label: string } | null }
export interface BsAppointmentBlockView { id: string; kindLabel: string; staff: string; time: string; starts: string; ends: string; note: string | null }
export interface BsAppointmentsView { rangeLabel?: string; timezone?: string; exists: boolean; shopLoading: boolean; canManage: boolean; canSchedule: boolean; scheduleDisabled: boolean; canCreate: boolean; locationId: string | null; locationName: string; staffName: string; loading: boolean; failed: boolean; failureMessage: string; noStaff: boolean; error: string; transitioning: boolean; formTitle: string; formDirty: boolean; saving: boolean; scheduleDirty: boolean; scheduleSaving: boolean; previousSymbol: string; nextSymbol: string; days: { id: string; label: string; today?: boolean; outside?: boolean; appointments: BsAppointmentCard[]; blocks?: BsAppointmentBlockView[] }[]; queue: BsAppointmentCard[]; weekdayNames: string[]; blocks: { id: string; label: string; index: number }[]; constraints: { nameMin: number; nameMax: number; phoneMax: number; notesMax: number; blockNoteMax: number } }
export interface BsAppointmentChoices { locations: BsAppointmentChoice[]; staff: BsAppointmentChoice[]; scheduleStaff: BsAppointmentChoice[]; services: BsAppointmentChoice[]; eligibleStaff: BsAppointmentChoice[]; customers: BsAppointmentChoice[] }

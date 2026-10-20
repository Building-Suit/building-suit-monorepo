import { doctorAdministrativeReason,doctorAdministrativeReasonOptions,doctorAdministrativeReasonLabel } from '../utils/administrativeEdition'
import { doctorDashboardSource } from '../utils/dashboardSource'
import { usePageRevalidation,useRecordAction } from '@building-suit/ux'
import { doctorAvailabilityToday,doctorMinuteClock,doctorScheduleDate } from '../utils/availability'
import { doctorAppointmentReason,doctorAppointmentTransitions,type DoctorAppointment,type DoctorAppointmentCommand,type DoctorAppointmentSnapshot } from '../utils/appointments'
import { doctorAppointmentsCopy } from '../utils/appointmentsPresentation'
export function useDoctorAppointmentsPage() {
  const nuxt = useNuxtApp();const context = useDoctorContext();const appointments = nuxt.$doctorAppointments;const state = appointments.state;const { locale } = useI18n()
  const copy = computed(() => doctorAppointmentsCopy(locale.value==='ar'));const hydrated = ref(false);const scopeKey = computed(() => appointments.scopeKey())
  const administrative = computed(() => context.state.current?.edition==='administrative_candidate')
  const reasonOptions = computed(() => administrative.value ? doctorAdministrativeReasonOptions(locale.value==='ar') : undefined)
  const validReason = (value: string) => administrative.value ? doctorAdministrativeReason(value) : doctorAppointmentReason(value)
  const today = (zone = nuxt.$doctorAppointmentsScope()?.timezone || 'Etc/UTC') => doctorAvailabilityToday(zone)
  const date = ref(today());const page = ref(0);const queuePage = ref(0);const form = ref<{ consultationId?:string;patientId: string; destinationId: string; date: string; minute: number | null; reason: string }>({ consultationId:'',patientId: '',destinationId: '',date: today(),minute: null,reason: '' });const reason = ref('')
  const original = ref<DoctorAppointment | null>(null);const transitionTarget = ref<{ row: DoctorAppointment; action: Exclude<DoctorAppointment['state'],'booked'> } | null>(null);const historyTarget = ref<string | null>(null);const historyOpen = ref(false);const sourceMode = ref(false)
  const submitted = ref<{ scope: string | null; fingerprint: string; input: DoctorAppointmentCommand } | null>(null)
  const editor = useRecordAction(() => form.value);const transition = useRecordAction(() => ({ reason: reason.value }));const query = () => ({ date: date.value,page: page.value,queuePage: queuePage.value })
  function reset() { submitted.value = null;editor.reset();transition.reset();appointments.discard();original.value = null;transitionTarget.value = null;historyTarget.value = null;historyOpen.value = false;sourceMode.value = false;reason.value = '';form.value = { consultationId:'',patientId: '',destinationId: '',date: today(),minute: null,reason: '' } }
  const unregister = context.registerClear(reset)
  let initialRead = true;let refreshAfterInitial = false;let stopped = false
  onBeforeUnmount(() => { stopped=true;unregister();reset();appointments.clear();void nuxt.$doctorAppointmentsLive.update(null,async () => {}) })
  async function denied() { if([state.error,state.actionError,state.historyError,state.offersError,state.patientsError].includes('denied')) { reset();await context.refresh() } }
  async function read() { const result = await appointments.load(query());if(result)state.live = nuxt.$doctorAppointmentsLive.connected ? 'current' : 'offline';await denied();return result }
  async function bind() { const selected = nuxt.$doctorAppointmentsScope();try { await nuxt.$doctorAppointmentsLive.update(selected,async () => {
    // The initial source read owns its date/page intent. A connection refresh
    // must trail it rather than aborting the read that opens source history.
    if(initialRead) { refreshAfterInitial=true;return }
    if(!stopped)await read()
  }) } catch { appointments.disconnected() } }
  async function reload() { if(state.pending)return;reset();await context.refresh();await nuxt.$doctorAppointmentsLive.update(null,async () => {}).catch(() => {});await bind();return read() }
  watch(scopeKey,() => { reset();appointments.clear();date.value = today();page.value = queuePage.value = 0;if(hydrated.value) { void bind();void read() } },{ flush: 'sync' })
  const route = useRoute()
  onMounted(async () => {
    try {
      hydrated.value = true;await bind();if(!scopeKey.value)return
      const requested = doctorDashboardSource(route.query,nuxt.$doctorAppointmentsScope())
      if(requested==='denied') { appointments.clear();state.error = 'denied';return }
      if(requested) { date.value = requested.date;page.value = requested.page;queuePage.value = requested.queuePage }
      const captured = scopeKey.value
      if(await read() && requested && captured===scopeKey.value) {
        if(!row(requested.appointmentId)) { appointments.clear();state.error = 'denied';return }
        state.history = null;historyTarget.value = requested.appointmentId;sourceMode.value = true;historyOpen.value = true
      }
    } finally {
      initialRead=false
      if(refreshAfterInitial && !stopped && scopeKey.value && state.error!=='denied')void read()
    }
  })
  usePageRevalidation(async () => { await context.refresh();await read() },() => hydrated.value && Boolean(scopeKey.value) && !state.pending && !editor.visible.value && !transition.visible.value && !historyOpen.value)
  watch(editor.visible,value => { if(!value && !state.pending) { submitted.value = null;appointments.discard() } })
  watch(historyOpen,value => { if(!value) { historyTarget.value = null;state.history = null;sourceMode.value = false } })
  const row = (id: string) => state.board?.items.find(item => item.id===id) || state.board?.queue.find(item => item.id===id)
  // A board read does not change clinic capabilities. Keep the permitted action
  // mounted so an asynchronous refresh cannot discard keyboard focus/activation.
  const canCreate = computed(() => hydrated.value && Boolean(state.board?.canWrite && state.board.canReadPatients))
  const clinicOptions = computed(() => context.state.options.filter(item => item.practiceId===nuxt.$doctorAppointmentsScope()?.practiceId && (['appointments.read','appointments.write','patients.read'] as const).every(cap => item.capabilities.includes(cap))).map(item => ({ value: item.locationId,label: `${item.locationName} · ${item.timezone}` })))
  const selectedType=computed(()=>nuxt.$doctorConsultations.state.types.find(t=>t.id===form.value.consultationId&&t.active))
  const consultationOptions=computed(()=>[{value:'',label:locale.value==='ar'?'مدة جدول العيادة':'Clinic schedule duration'},...nuxt.$doctorConsultations.state.types.filter(t=>t.active).map(t=>({value:t.id,label:`${t.name} · ${t.duration_minutes}`}))])
  async function patients(search = '') { form.value.patientId = '';await appointments.patients(search);await denied() }
  async function offers() { form.value.minute = null;if(!editor.visible.value || !form.value.destinationId)return;await appointments.offers(form.value.destinationId,form.value.date,administrative.value?undefined:original.value?{appointmentId:original.value.id}:selectedType.value?{typeId:selectedType.value.id,typeVersion:selectedType.value.version}:undefined);await denied() }
  async function open(id: string | null = null) {
    const item = id ? row(id) : null;if(!hydrated.value || state.pending || (id ? !item || item.state!=='booked' || !state.board?.canWrite || !state.board.canReadPatients : !canCreate.value))return
    submitted.value = null;appointments.discard();original.value = item ? { ...item } : null
    form.value = { consultationId:'',patientId: item?.patientId || '',destinationId: item?.locationId || nuxt.$doctorAppointmentsScope()?.locationId || '',date: date.value<today() ? today() : date.value,minute: null,reason: '' }
    if(item)editor.edit();else editor.create();if(!administrative.value)await nuxt.$doctorConsultations.load();await Promise.all([offers(),...(item ? [] : [patients()])])
  }
  function command(): DoctorAppointmentCommand | null {
    const retry = submitted.value
    if(state.actionError==='network' && retry && retry.scope===scopeKey.value && retry.fingerprint===JSON.stringify(form.value))return { ...retry.input }
    const value = form.value;if(value.consultationId&&!selectedType.value)return null;const slots = state.offers;if(!slots || slots.locationId!==value.destinationId || slots.date!==value.date || value.minute===null || !slots.slots.some(item => item.minute===value.minute && item.available))return null
    const base = { destinationId: value.destinationId,date: value.date,minute: value.minute,scheduleVersion: slots.scheduleVersion,locationVersion: slots.locationVersion }
    return original.value ? validReason(value.reason) ? { kind: 'reschedule',appointmentId: original.value.id,version: original.value.version,...base,reason: value.reason.trim() } : null : state.patients?.rows.some(item => item.id===value.patientId) ? { kind: 'book',patientId: value.patientId,...(selectedType.value?{typeId:selectedType.value.id,typeVersion:selectedType.value.version}:{}),...base } : null
  }
  const error = (value: string | null) => !value ? null : value==='denied' ? copy.value.denied : value==='conflict' ? copy.value.conflict : value==='invalid' ? copy.value.invalid : copy.value.network
  async function save() {
    const input = command();if(!editor.visible.value || !input)return
    submitted.value = { scope: scopeKey.value,fingerprint: JSON.stringify(form.value),input: { ...input } }
    const done = await editor.run(async () => { if(!await appointments.command(input)) { await denied();throw new Error('DOCTOR_APPOINTMENT_COMMAND_FAILED') } },() => error(state.actionError) || copy.value.network)
    if(done) { reset();await read() } else if(state.actionError!=='network')submitted.value = null
  }
  function permitted(item: DoctorAppointment) {
    const board = state.board;if(!board)return []
    return doctorAppointmentTransitions(item.state).filter(action => {
      if(action==='cancelled')return board.canWrite && (item.state!=='checked_in' || board.canQueue)
      if(action==='no_show')return board.canWrite && Date.parse(item.startsAt)<=Date.now()
      return board.canQueue && (action!=='checked_in' || doctorAvailabilityToday(item.timezone,new Date(item.startsAt))===today(item.timezone))
    })
  }
  async function action(id: string,value: string) {
    const item = row(id);if(!item || state.pending)return
    if(value==='history') { historyTarget.value = id;historyOpen.value = true;await appointments.history(id);await denied();return }
    const target = permitted(item).find(state => state===value);if(!target)return
    appointments.discard();transitionTarget.value = { row: { ...item },action: target };reason.value = '';transition.edit()
  }
  const reasonRequired = computed(() => Boolean(transitionTarget.value && ['cancelled','no_show'].includes(transitionTarget.value.action)))
  async function submitTransition() {
    const target = transitionTarget.value;if(!target || !transition.visible.value || (reasonRequired.value && !validReason(reason.value)))return
    const input: DoctorAppointmentCommand = { kind: 'transition',appointmentId: target.row.id,version: target.row.version,state: target.action,reason: reasonRequired.value ? reason.value.trim() : '' }
    const done = await transition.run(async () => { if(!await appointments.command(input)) { await denied();throw new Error('DOCTOR_APPOINTMENT_TRANSITION_FAILED') } },() => error(state.actionError) || copy.value.network);if(done) { reset();await read() }
  }
  async function historyPage(value = 0) { if(historyTarget.value) { await appointments.history(historyTarget.value,value);await denied() } }
  async function changeDate() { if(state.pending)return;if(!doctorScheduleDate(date.value)) { state.board = null;state.error = 'invalid';return };page.value = 0;return read() }
  async function changePage(scope: string | null,value: number,queue = false) { if(scope!==scopeKey.value || state.pending || !Number.isSafeInteger(value) || value<0)return;if(queue)queuePage.value = value;else page.value = value;return read() }
  const language = () => locale.value==='ar' ? 'ar-EG' : 'en-GB'
  const stamp = (value: string,zone: string) => `${new Intl.DateTimeFormat(language(),{ timeZone: zone,dateStyle: 'medium',timeStyle: 'short' }).format(new Date(value))} · ${zone}`
  function card(item: DoctorAppointment) {
    const actions: { id: string; label: string; text: boolean }[] = permitted(item).map(value => ({ id: value,label: copy.value.actions[value],text: true }));actions.push({ id: 'history',label: copy.value.history,text: true })
    return { id: item.id,time: stamp(item.startsAt,item.timezone),queueTime: '',status: item.state,statusLabel: copy.value.states[item.state],tone: item.state==='cancelled' || item.state==='no_show' ? 'danger' as const : item.state==='completed' ? 'success' as const : 'info' as const,customerName: item.patientName || copy.value.restricted,detail: [item.locationName,item.consultation?`${item.consultation.name} · v${item.consultation.version} · ${item.consultation.duration_minutes} · ${item.consultation.buffer_before} / ${item.consultation.buffer_after}`:''].filter(Boolean).join(' · '),queueDetail: '',pending: false,canEdit: item.state==='booked' && Boolean(state.board?.canWrite && state.board.canReadPatients),actions,queueAction: null,history: [],link: null }
  }
  const days = computed(() => state.board ? [{ id: date.value,label: `${date.value} · ${state.board.timezone}`,appointments: state.board.items.map(card) }] : [])
  const queue = computed(() => state.board?.queue.map(item => ({ id: item.id,time: item.checkedInAt ? stamp(item.checkedInAt,item.timezone) : '',patient: item.patientName || copy.value.restricted,status: copy.value.states[item.state],actions: [...permitted(item).map(value => ({ value,label: copy.value.actions[value] })),{ value: 'history',label: copy.value.history }] })) || [])
  const earliest = computed(() => today(state.offers?.timezone));const latest = computed(() => { const value = new Date(`${earliest.value}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+365);return value.toISOString().slice(0,10) })
  const editorView = computed(() => ({ title: original.value ? copy.value.reschedule : copy.value.create,dirty: editor.dirty.value,pending: editor.pending.value || state.pending,error: editor.error.value || (editor.dirty.value && !command() ? copy.value.invalid : null),disabled: !command() || state.pending || state.offersLoading,selectingPatient: !original.value,earliestDate: earliest.value,latestDate: latest.value,timezone: `${copy.value.timezone}: ${state.offers?.timezone || ''}`,patientLoading: state.patientsLoading,patientError: error(state.patientsError),offersLoading: state.offersLoading,offersError: error(state.offersError) }))
  const transitionView = computed(() => ({ title: transitionTarget.value ? copy.value.actions[transitionTarget.value.action] : '',description: copy.value.resolution,reasonRequired: reasonRequired.value,dirty: transition.dirty.value,pending: transition.pending.value || state.pending,error: transition.error.value || (transition.dirty.value && reasonRequired.value && !validReason(reason.value) ? copy.value.invalid : null),disabled: state.pending || (reasonRequired.value && !validReason(reason.value)) }))
  const snapshot = (value: DoctorAppointmentSnapshot | null) => value ? `${value.locationName} · ${stamp(value.startsAt,value.timezone)}` : ''
  const historyRecord = computed(() => {
    const item = historyTarget.value ? row(historyTarget.value) : null
    return item ? [{ id: 'id',label: copy.value.recordId,value: item.id },{ id: 'version',label: copy.value.version,value: String(item.version) },{ id: 'patient',label: copy.value.patient,value: item.patientName || copy.value.restricted },{ id: 'time',label: copy.value.time,value: stamp(item.startsAt,item.timezone) },{ id: 'clinic',label: copy.value.clinic,value: item.locationName },{ id: 'state',label: copy.value.status,value: copy.value.states[item.state] }] : []
  })
  const historyView = computed(() => ({ title: sourceMode.value ? copy.value.sourceTitle : copy.value.history,record: historyRecord.value,hasHistory: Boolean(state.history),loadLabel: copy.value.loadHistory,loading: state.historyLoading,error: error(state.historyError),total: state.history?.total || 0,page: state.history?.page || 0,rows: state.history?.events.map(item => ({ id: item.id,event: item.type==='appointment.booked' ? copy.value.booked : item.type==='appointment.rescheduled' ? copy.value.rescheduled : copy.value.states[item.nextState || 'booked'],actor: item.actorUserId,at: stamp(item.at,nuxt.$doctorAppointmentsScope()?.timezone || 'Etc/UTC'),reason: administrative.value ? doctorAdministrativeReasonLabel(item.reason,locale.value==='ar') : item.reason || '',original: snapshot(item.from),replacement: snapshot(item.to) })) || [] }))
  return { context,appointments,state,copy,consultationOptions,consultationLabel:computed(()=>administrative.value?undefined:locale.value==='ar'?'نوع الموعد':'Appointment type'),reasonOptions,scopeKey,hydrated,date,form,reason,historyOpen,editorOpen: editor.visible,transitionOpen: transition.visible,canCreate,clinicOptions,days,queue,editorView,transitionView,historyView,
    patientOptions: computed(() => state.patients?.rows.map(item => ({ value: item.id,label: item.name })) || []),slotOptions: computed(() => state.offers?.slots.filter(item => item.available).map(item => ({ value: item.minute,label: doctorMinuteClock(item.minute) })) || []),liveLabel: computed(() => copy.value[state.live]),liveTone: computed(() => state.live==='current' ? 'success' as const : state.live==='connecting' ? 'info' as const : 'warning' as const),error: computed(() => error(state.error)),denied: computed(() => !hydrated.value ? null : !scopeKey.value ? copy.value.choose : state.error==='denied' ? copy.value.denied : null),reload,open,action,save,submitTransition,patients,offers,changeDate,changePage,historyPage }
}

import { usePageRevalidation,useRecordAction } from '@building-suit/ux'
import { doctorAvailabilityToday,doctorMinuteClock,doctorScheduleDate } from '@building-suit/contracts'
import { doctorAppointmentReason,doctorAppointmentTransitions,doctorReceptionTransitions,type DoctorReceptionAction,type DoctorAppointment,type DoctorAppointmentCommand,type DoctorAppointmentSnapshot } from '@building-suit/contracts'
import { doctorAppointmentsCopy } from '../utils/nativeAppointmentsPresentation'
export function useDoctorNativeAppointmentsPage() {
  const reloading=ref(false)
  const {appointments,scope}=useDoctorNativeAppointments(),nativeContext=useDoctorNativeContext(),shell=useDoctorMobile(),{auth,readiness}=useDoctorNativeAuth(),{locale,t}=useI18n(),confirmation=useConfirmation()
  const project=()=>{const choice=nativeContext.state.current,value=scope();return choice&&value?{...value,doctorName:choice.doctorName,locationName:choice.locationName,practiceName:choice.practiceName}:null}
  const context={state:{get current(){return project()},get options(){return nativeContext.state.options.map(choice=>({...choice.context,doctorName:choice.doctorName,locationName:choice.locationName,timezone:choice.timezone??''}))}},registerClear:nativeContext.registerClear,refresh:nativeContext.refresh}
  const state=appointments.state
  const copy = computed(() => {const value={...doctorAppointmentsCopy(locale.value==='ar'),...(!auth.identity()?{title:t('destination.schedule')}:{})};return state.outcome==='unknown'?{...value,retry:locale.value==='ar'?'تسوية الإجراء الأصلي':'Reconcile original action',notice:locale.value==='ar'?'نتيجة الإجراء غير مؤكدة. التسوية تعيد الإجراء الأصلي بالمفتاح نفسه وتتحقق من إقرار الخادم؛ لا تنشئ أمراً جديداً.':'The action outcome is unknown. Reconciliation submits the original action with the same key and checks its server acknowledgement; it creates no new command.'}:value});const hydrated = ref(false);const scopeKey = computed(() => appointments.scopeKey())
  const validReason=doctorAppointmentReason
  const today = (zone = scope()?.timezone || 'Etc/UTC') => doctorAvailabilityToday(zone)
  const date = ref(today());const page = ref(0);const queuePage = ref(0);const form = ref<{ consultationId?:string;patientId: string; destinationId: string; date: string; minute: number | null; reason: string }>({ consultationId:'',patientId: '',destinationId: '',date: today(),minute: null,reason: '' });const reason = ref('')
  const walkInMode=ref(false);const original = ref<DoctorAppointment | null>(null);const transitionTarget = ref<{ row: DoctorAppointment; action: Exclude<DoctorAppointment['state'],'booked'>|DoctorReceptionAction } | null>(null);const historyTarget = ref<string | null>(null);const historyOpen = ref(false);const sourceMode = ref(false)
  const submitted = ref<{ scope: string | null; fingerprint: string; input: DoctorAppointmentCommand } | null>(null)
  const editor = useRecordAction(() => form.value);const transition = useRecordAction(() => ({ reason: reason.value }));const query = () => ({ date: date.value,page: page.value,queuePage: queuePage.value })
  function reset() { walkInMode.value=false;submitted.value = null;editor.reset();transition.reset();appointments.discard();original.value = null;transitionTarget.value = null;historyTarget.value = null;historyOpen.value = false;sourceMode.value = false;reason.value = '';form.value = { consultationId:'',patientId: '',destinationId: '',date: today(),minute: null,reason: '' } }
  const unregister = context.registerClear(reset)
  let stopped=false
  const unregisterDirty=nativeContext.registerDirty(()=>editor.dirty.value||transition.dirty.value||state.outcome==='unknown')
  onBeforeUnmount(()=>{stopped=true;unregister();unregisterDirty();reset();appointments.clear()})
  async function denied(){if([state.error,state.actionError,state.historyError,state.offersError,state.patientsError].includes('denied')){reset();await nativeContext.clear()}}
  async function read(){const done=await appointments.load(query());if(done)state.live='current';await denied();return done}
  async function reload(reconcile=false){if(state.pending||reloading.value)return;reloading.value=true;try{reset();await context.refresh();await shell.navigate('/schedule');if(!scopeKey.value)return false;if(reconcile&&state.outcome==='unknown'&&!await appointments.reconcile()){await denied();return false};return await read()}finally{reloading.value=false}}
  watch(scopeKey,()=>{reset();appointments.clear();date.value=today();page.value=queuePage.value=0;if(hydrated.value&&!stopped)void read()},{flush:'sync'})
  onMounted(async()=>{hydrated.value=true;await reload()})
  usePageRevalidation(async()=>{await context.refresh();await read()},()=>hydrated.value&&Boolean(scopeKey.value)&&!state.pending&&!reloading.value&&!editor.visible.value&&!transition.visible.value&&!historyOpen.value)
  watch(editor.visible,value=>{if(!value&&!state.pending){submitted.value=null;appointments.discard()}})
  watch(historyOpen,value=>{if(!value){historyTarget.value=null;state.history=null;sourceMode.value=false}})
  onBeforeRouteLeave(async()=>{if(state.pending)return false;if(!editor.dirty.value&&!transition.dirty.value&&state.outcome!=='unknown')return true;return confirmation.ask({title:copy.value.cancel,message:copy.value.conflict,confirmLabel:copy.value.cancel,cancelLabel:copy.value.history,tone:'danger'})})
  const row = (id: string) => state.board?.items.find(item => item.id===id) || state.board?.queue.find(item => item.id===id)
  // A board read does not change clinic capabilities. Keep the permitted action
  // mounted so an asynchronous refresh cannot discard keyboard focus/activation.
  const canCreate = computed(() => hydrated.value && Boolean(state.board?.canWrite && state.board.canReadPatients))
  const canWalkIn=computed(()=>canCreate.value&&Boolean(state.board?.canQueue))
  const clinicOptions = computed(() => context.state.options.filter(item => item.practiceId===scope()?.practiceId && (['appointments.read','appointments.write','patients.read'] as const).every(cap => item.capabilities.includes(cap))).map(item => ({ value: item.locationId,label: `${item.locationName} · ${item.timezone}` })))
  const selectedType=computed(()=>state.types.find(t=>t.id===form.value.consultationId&&t.active))
  const consultationOptions=computed(()=>[{value:'',label:locale.value==='ar'?'مدة جدول العيادة':'Clinic schedule duration'},...state.types.filter(t=>t.active).map(t=>({value:t.id,label:`${t.name} · ${t.duration_minutes}`}))])
  async function patients(search = '') { form.value.patientId = '';await appointments.patients(search);await denied() }
  async function offers() { form.value.minute = null;if(!editor.visible.value || !form.value.destinationId)return;await appointments.offers(form.value.destinationId,form.value.date,original.value?{appointmentId:original.value.id}:selectedType.value?{typeId:selectedType.value.id,typeVersion:selectedType.value.version}:undefined);await denied() }
  async function open(id: string | null = null,asWalkIn=false) {
    if(asWalkIn&&!canWalkIn.value)return
    const item = id ? row(id) : null;if(!hydrated.value || state.pending || (id ? !item || item.state!=='booked' || !state.board?.canWrite || !state.board.canReadPatients : !canCreate.value))return
    walkInMode.value=asWalkIn;submitted.value = null;appointments.discard();original.value = item ? { ...item } : null
    form.value = { consultationId:'',patientId: item?.patientId || '',destinationId: item?.locationId || scope()?.locationId || '',date: asWalkIn?today():date.value<today() ? today() : date.value,minute: null,reason: '' }
    if(item)editor.edit();else editor.create();await appointments.consultations();await Promise.all([offers(),...(item ? [] : [patients()])])
  }
  function command(): DoctorAppointmentCommand | null {
    const retry = submitted.value
    if(state.actionError==='network' && retry && retry.scope===scopeKey.value && retry.fingerprint===JSON.stringify(form.value))return { ...retry.input }
    const value = form.value;if(value.consultationId&&!selectedType.value)return null;const slots = state.offers;if(!slots || slots.locationId!==value.destinationId || slots.date!==value.date || value.minute===null || !slots.slots.some(item => item.minute===value.minute && item.available))return null
    const base = { destinationId: value.destinationId,date: value.date,minute: value.minute,scheduleVersion: slots.scheduleVersion,locationVersion: slots.locationVersion }
    if(walkInMode.value)return validReason(value.reason)&&value.date===today()&&state.patients?.rows.some(item=>item.id===value.patientId)?{kind:'walk_in',patientId:value.patientId,reason:value.reason.trim(),...(selectedType.value?{typeId:selectedType.value.id,typeVersion:selectedType.value.version}:{}),...base}:null
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
  function receptionPermitted(item:DoctorAppointment){return state.board?.canWrite&&state.board.canQueue&&state.board.canReadPatients?doctorReceptionTransitions(item):[]}
  async function action(id: string,value: string) {
    const item = row(id);if(!item || state.pending)return
    if(value==='history') { historyTarget.value = id;historyOpen.value = true;await appointments.history(id);await denied();return }
    const target = [...permitted(item),...receptionPermitted(item)].find(state => state===value);if(!target)return
    appointments.discard();transitionTarget.value = { row: { ...item },action: target };reason.value = '';transition.edit()
  }
  const reasonRequired = computed(() => Boolean(transitionTarget.value && !['checked_in','in_progress','completed'].includes(transitionTarget.value.action)))
  async function submitTransition() {
    const target = transitionTarget.value;if(!target || !transition.visible.value || (reasonRequired.value && !validReason(reason.value)))return
    const input: DoctorAppointmentCommand = ['late_check_in','reverse_no_show','queue_exit','move_to_end'].includes(target.action)?{kind:'reception',appointmentId:target.row.id,version:target.row.version,action:target.action as DoctorReceptionAction,reason:reason.value.trim()}:{ kind: 'transition',appointmentId: target.row.id,version: target.row.version,state: target.action as Exclude<DoctorAppointment['state'],'booked'>,reason: reasonRequired.value ? reason.value.trim() : '' }
    const done = await transition.run(async () => { if(!await appointments.command(input)) { await denied();throw new Error('DOCTOR_APPOINTMENT_TRANSITION_FAILED') } },() => error(state.actionError) || copy.value.network);if(done) { reset();await read() }
  }
  async function historyPage(value = 0) { if(historyTarget.value) { await appointments.history(historyTarget.value,value);await denied() } }
  async function changeDate() { if(state.pending)return;if(!doctorScheduleDate(date.value)) { state.board = null;state.error = 'invalid';return };page.value = 0;return read() }
  async function changePage(scope: string | null,value: number,queue = false) { if(scope!==scopeKey.value || state.pending || !Number.isSafeInteger(value) || value<0)return;if(queue)queuePage.value = value;else page.value = value;return read() }
  const language = () => locale.value==='ar' ? 'ar-EG' : 'en-GB'
  const stamp = (value: string,zone: string) => `${new Intl.DateTimeFormat(language(),{ timeZone: zone,dateStyle: 'medium',timeStyle: 'short' }).format(new Date(value))} · ${zone}`
  function card(item: DoctorAppointment) {
    const actions: { id: string; label: string; text: boolean }[] = [...permitted(item),...receptionPermitted(item)].map(value => ({ id: value,label: copy.value.actions[value],text: true }));actions.push({ id: 'history',label: copy.value.history,text: true })
    return { id: item.id,time: stamp(item.startsAt,item.timezone),queueTime: '',status: item.state,statusLabel: copy.value.states[item.state],tone: item.state==='cancelled' || item.state==='no_show' ? 'danger' as const : item.state==='completed' ? 'success' as const : 'info' as const,customerName: item.patientName || copy.value.restricted,detail: [item.locationName,item.consultation?`${item.consultation.name} · v${item.consultation.version} · ${item.consultation.duration_minutes} · ${item.consultation.buffer_before} / ${item.consultation.buffer_after}`:''].filter(Boolean).join(' · '),queueDetail: '',pending: false,canEdit: item.state==='booked' && Boolean(state.board?.canWrite && state.board.canReadPatients),actions,queueAction: null,history: [],link: null }
  }
  const days = computed(() => state.board ? [{ id: date.value,label: `${date.value} · ${state.board.timezone}`,appointments: state.board.items.map(card) }] : [])
  const queue = computed(() => state.board?.queue.map(item => ({ id: item.id,time: item.checkedInAt ? stamp(item.checkedInAt,item.timezone) : '',patient: item.patientName || copy.value.restricted,status: copy.value.states[item.state],actions: [...[...permitted(item),...receptionPermitted(item)].map(value => ({ value,label: copy.value.actions[value] })),{ value: 'history',label: copy.value.history }] })) || [])
  const earliest = computed(() => today(state.offers?.timezone));const latest = computed(() => { const value = new Date(`${earliest.value}T00:00:00Z`);value.setUTCDate(value.getUTCDate()+365);return value.toISOString().slice(0,10) })
  const editorView = computed(() => ({ title: walkInMode.value?copy.value.walkIn:original.value ? copy.value.reschedule : copy.value.create,dirty: editor.dirty.value,pending: editor.pending.value || state.pending,error: editor.error.value || (editor.dirty.value && !command() ? copy.value.invalid : null),disabled: !command() || state.pending || state.offersLoading,reasonRequired:walkInMode.value,selectingPatient: !original.value,earliestDate: earliest.value,latestDate: walkInMode.value?today():latest.value,timezone: `${copy.value.timezone}: ${state.offers?.timezone || ''}`,patientLoading: state.patientsLoading,patientError: error(state.patientsError),offersLoading: state.offersLoading,offersError: error(state.offersError) }))
  const transitionView = computed(() => ({ title: transitionTarget.value ? copy.value.actions[transitionTarget.value.action] : '',description: copy.value.resolution,reasonRequired: reasonRequired.value,dirty: transition.dirty.value,pending: transition.pending.value || state.pending,error: transition.error.value || (transition.dirty.value && reasonRequired.value && !validReason(reason.value) ? copy.value.invalid : null),disabled: state.pending || (reasonRequired.value && !validReason(reason.value)) }))
  const snapshot = (value: DoctorAppointmentSnapshot | null) => value ? `${value.locationName} · ${stamp(value.startsAt,value.timezone)}` : ''
  const historyRecord = computed(() => {
    const item = historyTarget.value ? row(historyTarget.value) : null
    return item ? [{ id: 'id',label: copy.value.recordId,value: item.id },{ id: 'version',label: copy.value.version,value: String(item.version) },{ id: 'patient',label: copy.value.patient,value: item.patientName || copy.value.restricted },{ id: 'time',label: copy.value.time,value: stamp(item.startsAt,item.timezone) },{ id: 'clinic',label: copy.value.clinic,value: item.locationName },{ id: 'state',label: copy.value.status,value: copy.value.states[item.state] }] : []
  })
  const historyView = computed(() => ({ title: sourceMode.value ? copy.value.sourceTitle : copy.value.history,record: historyRecord.value,hasHistory: Boolean(state.history),loadLabel: copy.value.loadHistory,loading: state.historyLoading,error: error(state.historyError),total: state.history?.total || 0,page: state.history?.page || 0,rows: state.history?.events.map(item => ({ id: item.id,event: item.type.startsWith('appointment.reception.')?copy.value.actions[item.type.slice('appointment.reception.'.length) as DoctorReceptionAction|'walk_in']:item.type==='appointment.booked' ? copy.value.booked : item.type==='appointment.rescheduled' ? copy.value.rescheduled : copy.value.states[item.nextState || 'booked'],actor: item.actorUserId,at: stamp(item.at,scope()?.timezone || 'Etc/UTC'),reason: item.reason || '',original: snapshot(item.from),replacement: snapshot(item.to) })) || [] }))
  return { reloading, context,appointments,state,copy,canWalkIn,openWalkIn:()=>open(null,true),consultationOptions,consultationLabel:computed(()=>locale.value==='ar'?'نوع الموعد':'Appointment type'),scopeKey,hydrated,date,form,reason,historyOpen,editorOpen: editor.visible,transitionOpen: transition.visible,canCreate,clinicOptions,days,queue,editorView,transitionView,historyView,
    patientOptions: computed(() => state.patients?.rows.map(item => ({ value: item.id,label: item.name })) || []),slotOptions: computed(() => state.offers?.slots.filter(item => item.available).map(item => ({ value: item.minute,label: doctorMinuteClock(item.minute) })) || []),liveLabel: computed(() => copy.value[state.live]),liveTone: computed(() => state.live==='current' ? 'success' as const : state.live==='connecting' ? 'info' as const : 'warning' as const),error: computed(() => error(state.error)),accessAction:computed(()=>!auth.identity()&&readiness.value==='enabled'?{label:t('auth.signIn')}:undefined),denied: computed(() => !hydrated.value ? null : !auth.identity() ? t('phase.signed-out.title') : !scopeKey.value ? copy.value.choose : state.error==='denied' ? copy.value.denied : null),reload,open,action,save,submitTransition,patients,offers,changeDate,changePage,historyPage }
}

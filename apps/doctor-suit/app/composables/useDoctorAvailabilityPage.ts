import { usePageRevalidation,useRecordAction } from '@building-suit/ux'
import { doctorScheduleInput,validDoctorSchedule,doctorClockMinute,doctorMinuteClock,doctorAvailabilityToday,type DoctorScheduleInput,type DoctorWeekWindow } from '../utils/availability'
import { doctorAvailabilityCopy } from '../utils/availabilityPresentation'
const windowId = (item: DoctorWeekWindow) => `${item.weekday}:${item.start}:${item.end}`
export function useDoctorAvailabilityPage() {
  const nuxt = useNuxtApp(); const context = useDoctorContext(); const availability = nuxt.$doctorAvailability; const state = availability.state
  const { locale } = useI18n(); const copy = computed(() => doctorAvailabilityCopy(locale.value==='ar')); const scopeKey = computed(() => availability.scopeKey()); const hydrated = ref(false)
  const today = () => doctorAvailabilityToday(nuxt.$doctorAvailabilityScope()?.timezone || 'Etc/UTC')
  const date = ref(today()); const windowForm = ref({ weekday: 1,start: '09:00',end: '17:00' }); const exceptionForm = ref({ date: today(),closed: true,windows: [{ start: '09:00',end: '17:00' }],reason: '' }); const durationForm = ref<{ minutes: number | string }>({ minutes: 20 })
  const targetWindow = ref<string | null>(null); const targetException = ref<string | null>(null); const editorVersion = ref(0)
  const editor = useRecordAction(() => windowForm.value); const exceptionEditor = useRecordAction(() => exceptionForm.value); const durationEditor = useRecordAction(() => durationForm.value); const confirmation = useConfirmation()
  const canManage = computed(() => hydrated.value && Boolean(state.config?.canManage) && Boolean(scopeKey.value) && !state.loading)
  function reset() { editor.reset(); exceptionEditor.reset(); durationEditor.reset(); availability.discard(); targetWindow.value = null; targetException.value = null; windowForm.value = { weekday: 1,start: '09:00',end: '17:00' }; exceptionForm.value = { date: today(),closed: true,windows: [{ start: '09:00',end: '17:00' }],reason: '' }; durationForm.value = { minutes: 20 } }
  const unregister = context.registerClear(() => { reset(); date.value = today() })
  onBeforeUnmount(() => { unregister(); reset(); availability.clear() })
  onMounted(() => { hydrated.value = true })
  async function denied() { if ([state.error,state.slotsError,state.actionError].includes('denied')) { reset(); await context.refresh() } }
  async function reload() { reset(); const loaded = await availability.load(); if (loaded) await availability.slots(date.value); await denied(); return loaded }
  async function refreshSlots() { if (state.pending) return false; const loaded = await availability.slots(date.value); if (!loaded && state.slotsError==='conflict' && !editor.visible.value && !exceptionEditor.visible.value && !durationEditor.visible.value) return reload(); await denied(); return loaded }
  watch(scopeKey,() => { reset(); availability.clear(); date.value = today(); if (hydrated.value) void reload() },{ flush: 'sync' })
  usePageRevalidation(async () => { await context.refresh(); await reload() },() => hydrated.value && Boolean(scopeKey.value) && !state.pending && !editor.visible.value && !exceptionEditor.visible.value && !durationEditor.visible.value)
  function base() { return state.config ? doctorScheduleInput(state.config) : null }
  function candidateWindow(): DoctorScheduleInput | null {
    const input = base(); const start = doctorClockMinute(windowForm.value.start); const end = doctorClockMinute(windowForm.value.end,true)
    if (!input || start===null || end===null) return null
    input.weekly = input.weekly.filter(item => windowId(item)!==targetWindow.value); input.weekly.push({ weekday: Number(windowForm.value.weekday),start,end }); return validDoctorSchedule(input) ? input : null
  }
  function candidateException(): DoctorScheduleInput | null {
    const input = base(); if (!input) return null; const value = exceptionForm.value; const windows = []
    for (const item of value.closed ? [] : value.windows) { const start = doctorClockMinute(item.start); const end = doctorClockMinute(item.end,true); if (start===null || end===null) return null; windows.push({ start,end }) }
    input.exceptions = input.exceptions.filter(item => item.date!==targetException.value); input.exceptions.push({ date: value.date,closed: value.closed,windows,reason: value.reason.trim() }); return validDoctorSchedule(input) ? input : null
  }
  function candidateDuration(): DoctorScheduleInput | null { const input = base(); if (!input) return null; input.slotMinutes = Number(durationForm.value.minutes); return validDoctorSchedule(input) ? input : null }
  function openWindow(id: string | null = null) {
    if (!canManage.value || state.pending) return; const row = id ? state.config?.weekly.find(item => windowId(item)===id) : null; if (id && !row) return
    availability.discard(); targetWindow.value = id; editorVersion.value = state.config!.version; windowForm.value = row ? { weekday: row.weekday,start: doctorMinuteClock(row.start),end: doctorMinuteClock(row.end) } : { weekday: 1,start: '09:00',end: '17:00' }; if (row) editor.edit(); else editor.create()
  }
  function openException(id: string | null = null) {
    if (!canManage.value || state.pending) return; const row = id ? state.config?.exceptions.find(item => item.date===id) : null; if (id && !row) return
    availability.discard(); targetException.value = id; editorVersion.value = state.config!.version; exceptionForm.value = row ? { date: row.date,closed: row.closed,reason: row.reason,windows: row.windows.length ? row.windows.map(item => ({ start: doctorMinuteClock(item.start),end: doctorMinuteClock(item.end) })) : [{ start: '09:00',end: '17:00' }] } : { date: date.value,closed: true,reason: '',windows: [{ start: '09:00',end: '17:00' }] }; if (row) exceptionEditor.edit(); else exceptionEditor.create()
  }
  function openDuration() { if (!canManage.value || state.pending) return; availability.discard(); editorVersion.value = state.config!.version; durationForm.value = { minutes: state.config!.slotMinutes }; durationEditor.edit() }
  const error = (value: string | null) => !value ? null : value==='denied' ? copy.value.denied : value==='invalid' ? copy.value.invalid : value==='conflict' ? copy.value.conflict : copy.value.network
  async function save(kind: 'window' | 'exception' | 'duration') {
    const action = kind==='window' ? editor : kind==='exception' ? exceptionEditor : durationEditor; const input = kind==='window' ? candidateWindow() : kind==='exception' ? candidateException() : candidateDuration()
    if (!action.visible.value || !input) return
    const done = await action.run(async () => { if (!await availability.write(input,editorVersion.value)) { await denied(); throw new Error('DOCTOR_AVAILABILITY_COMMAND_FAILED') } },() => error(state.actionError) || copy.value.network)
    if (done) { reset(); await refreshSlots() }
  }
  async function remove(kind: 'window' | 'exception',id: string) {
    const input = base(); const config = state.config; if (!input || !config || !canManage.value || state.pending) return
    const selected = scopeKey.value; const version = config.version
    if (kind==='window') { if (!input.weekly.some(item => windowId(item)===id)) return; input.weekly = input.weekly.filter(item => windowId(item)!==id) }
    else { if (!input.exceptions.some(item => item.date===id)) return; input.exceptions = input.exceptions.filter(item => item.date!==id) }
    if (!await confirmation.ask({ title: copy.value.removeTitle,message: copy.value.removeDescription,confirmLabel: copy.value.remove,cancelLabel: copy.value.cancel,tone: 'danger' })) return
    if (scopeKey.value!==selected) return
    if (await availability.write(input,version)) await refreshSlots(); else await denied()
  }
  const earliestDate = computed(today); const latestDate = computed(() => { const result = new Date(`${today()}T00:00:00Z`); result.setUTCDate(result.getUTCDate()+365); return result.toISOString().slice(0,10) })
  return { context,availability,copy,scopeKey,hydrated,date,windowForm,exceptionForm,durationForm,windowOpen: editor.visible,exceptionOpen: exceptionEditor.visible,durationOpen: durationEditor.visible,canManage,reload,refreshSlots,openWindow,openException,openDuration,
    scopeLabel: computed(() => { const value = context.state.current; return value ? `${value.doctorName} · ${value.practiceName} · ${value.locationName} · ${value.timezone}` : '' }),earliestDate,latestDate,
    summary: computed(() => ({ duration: `${copy.value.slotMinutes}: ${state.config?.slotMinutes || 20}`,commitments: `${copy.value.commitments}: ${state.config?.existingCommitments || 0}`,override: copy.value.override,preservation: copy.value.preservation })),
    weekly: computed(() => (state.config?.weekly || []).map(item => ({ id: windowId(item),weekday: copy.value.weekdays[item.weekday] || '',start: doctorMinuteClock(item.start),end: doctorMinuteClock(item.end) }))),
    exceptions: computed(() => (state.config?.exceptions || []).map(item => ({ id: item.date,date: item.date,status: item.closed ? copy.value.closedLabel : copy.value.special,windows: item.windows.map(window => `${doctorMinuteClock(window.start)}–${doctorMinuteClock(window.end)}`).join(' · '),reason: item.reason }))),
    slots: computed(() => (state.slots?.slots || []).map(item => ({ id: String(item.minute),time: `${doctorMinuteClock(item.minute)}–${doctorMinuteClock(item.minute+(state.slots?.slotMinutes || 20))}`,status: item.available ? copy.value.available : item.reason==='busy' ? copy.value.busy : item.reason==='past' ? copy.value.past : item.reason==='ambiguous_or_missing_clock' ? copy.value.clock : copy.value.empty }))),
    editorView: computed(() => ({ title: targetWindow.value ? copy.value.editWindow : copy.value.addWindow,dirty: editor.dirty.value,pending: editor.pending.value,error: editor.error.value || (editor.dirty.value && !candidateWindow() ? copy.value.invalid : null),disabled: !candidateWindow() })),
    exceptionEditorView: computed(() => ({ title: targetException.value ? copy.value.editException : copy.value.addException,dirty: exceptionEditor.dirty.value,pending: exceptionEditor.pending.value,error: exceptionEditor.error.value || (exceptionEditor.dirty.value && !candidateException() ? copy.value.invalid : null),disabled: !candidateException() })),
    durationEditorView: computed(() => ({ dirty: durationEditor.dirty.value,pending: durationEditor.pending.value,error: durationEditor.error.value || (durationEditor.dirty.value && !candidateDuration() ? copy.value.invalid : null),disabled: !candidateDuration() })),
    error: computed(() => error(state.error)),slotsError: computed(() => error(state.slotsError)),actionError: computed(() => error(state.actionError)),weekdayOptions: computed(() => copy.value.weekdays.map((label,value) => ({ label,value }))),
    saveWindow: () => save('window'),saveException: () => save('exception'),saveDuration: () => save('duration'),removeWindow: (id: string) => remove('window',id),removeException: (id: string) => remove('exception',id),
    addTime: () => { if (!state.pending && exceptionForm.value.windows.length<4) exceptionForm.value.windows.push({ start: '09:00',end: '17:00' }) },removeTime: (index: number) => { if (!state.pending && exceptionForm.value.windows.length>1 && Number.isInteger(index) && index>=0 && index<exceptionForm.value.windows.length) exceptionForm.value.windows.splice(index,1) },
  }
}

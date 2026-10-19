import { doctorScopeKey } from './contextScope.ts'
import { doctorUuid,type DoctorLocationContext } from './locationContext.ts'
import { doctorScheduleDate,type DoctorAvailability } from './availability.ts'
import { validDoctorAppointmentCommand,type DoctorAppointmentBoard,type DoctorAppointmentHistory,type DoctorAppointmentQuery,type DoctorAppointmentCommand } from './appointments.ts'
import { doctorPatientFailure,type DoctorPatientError } from './patientsController.ts'
import type { DoctorPatientDirectory } from './patients'
import type { doctorAppointmentsRepository } from './appointmentsRepository'
export interface DoctorAppointmentsState { board: DoctorAppointmentBoard | null; history: DoctorAppointmentHistory | null; offers: DoctorAvailability | null; patients: DoctorPatientDirectory | null; loading: boolean; pending: boolean; historyLoading: boolean; offersLoading: boolean; patientsLoading: boolean; error: DoctorPatientError; actionError: DoctorPatientError; historyError: DoctorPatientError; offersError: DoctorPatientError; patientsError: DoctorPatientError; live: 'connecting' | 'current' | 'reconnecting' | 'offline' }
export const doctorAppointmentsState = (): DoctorAppointmentsState => ({ board: null,history: null,offers: null,patients: null,loading: false,pending: false,historyLoading: false,offersLoading: false,patientsLoading: false,error: null,actionError: null,historyError: null,offersError: null,patientsError: null,live: 'offline' })
export function createDoctorAppointmentsController(repository: ReturnType<typeof doctorAppointmentsRepository> | null,state: DoctorAppointmentsState,scope: () => DoctorLocationContext | null,key = () => crypto.randomUUID()) {
  let generation = 0; const revisions = { board: 0,history: 0,offers: 0,patients: 0 };let abort = new AbortController();let uncertain: { material: string; key: string } | null = null;let latestQuery: DoctorAppointmentQuery | null = null;let refreshQueued = false
  const scopeKey = () => { const selected = scope();return selected ? doctorScopeKey(selected,'appointments') : null }
  const capture = () => ({ generation,key: scopeKey() });const accepts = (value: ReturnType<typeof capture>) => value.generation===generation && value.key===scopeKey()
  const signal = () => AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
  function clear() { generation++;abort.abort();abort = new AbortController();uncertain = null;latestQuery = null;refreshQueued = false;Object.assign(state,doctorAppointmentsState()) }
  function discard() { uncertain = null;state.actionError = null;state.offers = null;state.offersError = null;state.patients = null;state.patientsError = null }
  function failure(error: unknown) { const result = doctorPatientFailure(error);if(result==='denied')clear();return result }
  function disconnected() { state.live = 'reconnecting';state.board = null;state.history = null;state.offers = null;revisions.offers++ }
  async function load(query: DoctorAppointmentQuery) {
    if(state.pending) { latestQuery = { ...query };refreshQueued = true;return false }
    const selected = scope();const expected = capture();const revision = ++revisions.board;latestQuery = { ...query };state.loading = true;state.error = null
    if(!repository || !selected || !doctorScheduleDate(query.date) || !Number.isSafeInteger(query.page) || query.page<0 || !Number.isSafeInteger(query.queuePage) || query.queuePage<0) { state.loading = false;state.board = null;state.error = 'invalid';return false }
    try { const result = await repository.board(selected.practiceId,selected.locationId,query,signal());if(!accepts(expected) || revision!==revisions.board)return false;if(result.locationVersion!==selected.locationVersion || result.timezone!==selected.timezone)throw { code: '40001' };state.board = result;return true }
    catch(error) { if(accepts(expected) && revision===revisions.board) { state.board = null;state.error = failure(error) };return false }
    finally { if(accepts(expected) && revision===revisions.board)state.loading = false }
  }
  async function history(appointmentId: string,page = 0) {
    const selected = scope();const expected = capture();const revision = ++revisions.history;state.history = null;state.historyLoading = true;state.historyError = null
    if(!repository || !selected || !doctorUuid(appointmentId)) { state.historyLoading = false;state.historyError = 'invalid';return false }
    try { const result = await repository.history(selected.practiceId,selected.locationId,appointmentId,page,signal());if(!accepts(expected) || revision!==revisions.history)return false;state.history = result;return true }
    catch(error) { if(accepts(expected) && revision===revisions.history)state.historyError = failure(error);return false }
    finally { if(accepts(expected) && revision===revisions.history)state.historyLoading = false }
  }
  async function offers(locationId: string,date: string) {
    const selected = scope();const expected = capture();const revision = ++revisions.offers;state.offers = null;state.offersLoading = true;state.offersError = null
    if(!repository || !selected || !doctorUuid(locationId) || !doctorScheduleDate(date)) { state.offersLoading = false;state.offersError = 'invalid';return false }
    try { const result = await repository.offers(selected.practiceId,locationId,date,signal());if(!accepts(expected) || revision!==revisions.offers)return false;state.offers = result;return true }
    catch(error) { if(accepts(expected) && revision===revisions.offers)state.offersError = failure(error);return false }
    finally { if(accepts(expected) && revision===revisions.offers)state.offersLoading = false }
  }
  async function patients(search: string) {
    const selected = scope();const expected = capture();const revision = ++revisions.patients;state.patients = null;state.patientsLoading = true;state.patientsError = null
    if(!repository || !selected?.capabilities.includes('patients.read') || search.length>100) { state.patientsLoading = false;state.patientsError = 'denied';return false }
    try { const result = await repository.patients(selected.practiceId,selected.locationId,search,signal());if(!accepts(expected) || revision!==revisions.patients)return false;state.patients = result;return true }
    catch(error) { if(accepts(expected) && revision===revisions.patients)state.patientsError = failure(error);return false }
    finally { if(accepts(expected) && revision===revisions.patients)state.patientsLoading = false }
  }
  async function command(input: DoctorAppointmentCommand) {
    if(state.pending)return false
    const selected = scope();const expected = capture()
    if(!repository || !selected || !validDoctorAppointmentCommand(input) || (input.kind==='book' && input.destinationId!==selected.locationId)) { state.actionError = 'invalid';return false }
    const required = input.kind==='transition' && !['cancelled','no_show'].includes(input.state) ? 'queue.manage' : 'appointments.write'
    if(!selected.capabilities.includes(required)) { state.actionError = 'denied';return false }
    const material = JSON.stringify([scopeKey(),input]);if(uncertain?.material!==material)uncertain = { material,key: key() }
    state.pending = true;state.actionError = null
    try { await repository.command(selected.practiceId,selected.locationId,input,uncertain.key,signal());if(!accepts(expected))return false;uncertain = null;state.history = null;return true }
    catch(error) { if(accepts(expected)) { state.actionError = failure(error);if(state.actionError!=='network')uncertain = null };return false }
    finally { if(accepts(expected)) { state.pending = false;if(refreshQueued && latestQuery) { refreshQueued = false;void load(latestQuery) } } }
  }
  return { state,scopeKey,clear,discard,disconnected,load,history,offers,patients,command }
}

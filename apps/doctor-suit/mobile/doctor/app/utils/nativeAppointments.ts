import {doctorScheduleDate,validDoctorAppointmentCommand,type ConsultationType,type DoctorMobileContext,type DoctorAvailability,type DoctorAppointmentBoard,type DoctorAppointmentHistory,type DoctorAppointmentQuery,type DoctorAppointmentCommand,type DoctorOfferSelection,type DoctorPatientDirectory} from '@building-suit/contracts'
import {nativePatientScopeKey} from './nativePatients.ts'
import {nativeOperationSignal,nativeCommandKey} from './nativeWebCapabilities.ts'
export interface NativeScheduleScope extends DoctorMobileContext {timezone:string}
export interface NativeAppointmentsPort {
 consultations(practice:string,location:string,signal:AbortSignal):Promise<ConsultationType[]>
 board(practice:string,location:string,query:DoctorAppointmentQuery,signal:AbortSignal):Promise<DoctorAppointmentBoard>
 history(practice:string,location:string,id:string,page:number,signal:AbortSignal):Promise<DoctorAppointmentHistory>
 offers(practice:string,location:string,date:string,signal:AbortSignal,selection?:DoctorOfferSelection):Promise<DoctorAvailability>
 patients(practice:string,location:string,search:string,signal:AbortSignal):Promise<DoctorPatientDirectory>
 command(practice:string,location:string,input:DoctorAppointmentCommand,key:string,signal:AbortSignal):Promise<{appointmentId:string;version:number}>
}
type DoctorPatientError='denied'|'invalid'|'conflict'|'network'|null
const doctorUuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
function doctorPatientFailure(error:unknown):DoctorPatientError {const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';return code==='42501'?'denied':code==='40001'?'conflict':code==='22023'?'invalid':'network'}
/** Native online-only appointment orchestration. No storage, reconnect replay or
 * cross-client imports; server atomic commands and durable receipts own writes. */
export interface NativeAppointmentsState { types:ConsultationType[]; board: DoctorAppointmentBoard | null; history: DoctorAppointmentHistory | null; offers: DoctorAvailability | null; patients: DoctorPatientDirectory | null; loading: boolean; refreshing: boolean; pending: boolean; historyLoading: boolean; offersLoading: boolean; patientsLoading: boolean; error: DoctorPatientError; actionError: DoctorPatientError; historyError: DoctorPatientError; offersError: DoctorPatientError; patientsError: DoctorPatientError; outcome: 'idle'|'submitting'|'acknowledged'|'unknown'|'conflict'; live: 'connecting' | 'current' | 'reconnecting' | 'offline' }
export const nativeAppointmentsState = (): NativeAppointmentsState => ({ types:[],board: null,history: null,offers: null,patients: null,loading: false,refreshing: false,pending: false,historyLoading: false,offersLoading: false,patientsLoading: false,error: null,actionError: null,historyError: null,offersError: null,patientsError: null,outcome:'idle',live: 'offline' })
export function createNativeAppointments(repository: NativeAppointmentsPort | null,state: NativeAppointmentsState,scope: () => NativeScheduleScope | null,key = nativeCommandKey) {
  let generation = 0; const revisions = { board: 0,history: 0,offers: 0,patients: 0 };let abort = new AbortController();let uncertain: { material: string; key: string; input:DoctorAppointmentCommand } | null = null;let latestQuery: DoctorAppointmentQuery | null = null;let refreshQueued = false
  let boardScopeKey: string | null = null
  const scopeKey = () => { const selected = scope();return selected ? nativePatientScopeKey(selected) : null }
  const capture = () => ({ generation,key: scopeKey() });const accepts = (value: ReturnType<typeof capture>) => value.generation===generation && value.key===scopeKey()
  const signal = () => nativeOperationSignal(abort.signal,15000)
  function clear() { generation++;abort.abort();abort = new AbortController();uncertain = null;latestQuery = null;refreshQueued = false;boardScopeKey=null;Object.assign(state,nativeAppointmentsState()) }
  function discard() { if(!uncertain)state.actionError = null;state.offers = null;state.offersError = null;state.patients = null;state.patientsError = null }
  function failure(error: unknown) { const result = doctorPatientFailure(error);if(result==='denied')clear();return result }
  function disconnected() { state.live = 'reconnecting';state.board = null;boardScopeKey=null;state.history = null;state.offers = null;revisions.offers++;state.offersLoading=false;state.offersError='network' }
  async function load(query: DoctorAppointmentQuery) {
    if(state.pending) { latestQuery = { ...query };refreshQueued = true;return false }
    const selected = scope();const expected = capture();const revision = ++revisions.board;latestQuery = { ...query }
    const previous=state.board
    const refreshing=Boolean(selected&&previous&&boardScopeKey===expected.key&&previous.practiceId===selected.practiceId&&previous.locationId===selected.locationId&&previous.locationVersion===selected.locationVersion&&previous.timezone===selected.timezone&&previous.date===query.date&&previous.page===query.page&&previous.queuePage===query.queuePage)
    state.loading=!refreshing;state.refreshing=refreshing;state.error=null
    if(!refreshing){state.board=null;boardScopeKey=null}
    if(!repository || !selected?.capabilities.includes('appointments.read') || !doctorScheduleDate(query.date) || !Number.isSafeInteger(query.page) || query.page<0 || !Number.isSafeInteger(query.queuePage) || query.queuePage<0) { state.loading = false;state.refreshing=false;state.board = null;boardScopeKey=null;state.error = 'invalid';return false }
    try { const result = await repository.board(selected.practiceId,selected.locationId,query,signal());if(!accepts(expected) || revision!==revisions.board)return false;if(result.locationVersion!==selected.locationVersion || result.timezone!==selected.timezone)throw { code: '40001' };state.board = result;boardScopeKey=expected.key;return true }
    catch(error) { if(accepts(expected) && revision===revisions.board) { state.board = null;boardScopeKey=null;state.error = failure(error) };return false }
    finally { if(accepts(expected) && revision===revisions.board){state.loading = false;state.refreshing=false} }
  }
  async function consultations(){const selected=scope(),expected=capture();state.types=[];if(!repository||!selected)return false;try{const types=await repository.consultations(selected.practiceId,selected.locationId,signal());if(!accepts(expected))return false;state.types=types;return true}catch(error){if(accepts(expected))state.actionError=failure(error);return false}}
  async function history(appointmentId: string,page = 0) {
    const selected = scope();const expected = capture();const revision = ++revisions.history;state.history = null;state.historyLoading = true;state.historyError = null
    if(!repository || !selected || !doctorUuid(appointmentId)) { state.historyLoading = false;state.historyError = 'invalid';return false }
    try { const result = await repository.history(selected.practiceId,selected.locationId,appointmentId,page,signal());if(!accepts(expected) || revision!==revisions.history)return false;state.history = result;return true }
    catch(error) { if(accepts(expected) && revision===revisions.history)state.historyError = failure(error);return false }
    finally { if(accepts(expected) && revision===revisions.history)state.historyLoading = false }
  }
  async function offers(locationId: string,date: string,selection?:DoctorOfferSelection) {
    const selected = scope();const expected = capture();const revision = ++revisions.offers;state.offers = null;state.offersLoading = true;state.offersError = null
    if(!repository || !selected || !doctorUuid(locationId) || !doctorScheduleDate(date)) { state.offersLoading = false;state.offersError = 'invalid';return false }
    try { const result = await repository.offers(selected.practiceId,locationId,date,signal(),selection);if(!accepts(expected) || revision!==revisions.offers)return false;state.offers = result;return true }
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
    if(!repository || !selected || !validDoctorAppointmentCommand(input) || ((input.kind==='book'||input.kind==='walk_in') && input.destinationId!==selected.locationId)) { state.actionError = 'invalid';return false }
    if((input.kind==='reception'||input.kind==='walk_in')&&!(['queue.manage','appointments.write','patients.read'] as const).every(cap=>selected.capabilities.includes(cap))){state.actionError='denied';return false}
    const required = input.kind==='transition' && !['cancelled','no_show'].includes(input.state) ? 'queue.manage' : 'appointments.write'
    if(!selected.capabilities.includes('appointments.read')||!selected.capabilities.includes(required)) { state.actionError = 'denied';return false }
    const material = JSON.stringify([scopeKey(),input]);if(uncertain&&uncertain.material!==material){state.actionError='network';return false};if(!uncertain)uncertain = { material,key: key(),input:{...input} }
    state.pending = true;state.outcome='submitting';state.actionError = null
    try { const result=await repository.command(selected.practiceId,selected.locationId,input,uncertain.key,signal());if(!accepts(expected))return false;if(('appointmentId'in input&&(result.appointmentId!==input.appointmentId||result.version!==input.version+1))||(!('appointmentId'in input)&&result.version!==1))throw new Error('Invalid acknowledgement');uncertain = null;state.outcome='acknowledged';state.history = null;return true }
    catch(error) { if(accepts(expected)) { state.actionError = failure(error);state.outcome=state.actionError==='network'?'unknown':state.actionError==='conflict'?'conflict':'idle';if(state.actionError!=='network')uncertain = null };return false }
    finally { if(accepts(expected)) { state.pending = false;if(refreshQueued && latestQuery) { refreshQueued = false;void load(latestQuery) } } }
  }
  async function reconcile(){return uncertain?command({...uncertain.input}):false}
  return { state,scopeKey,clear,discard,disconnected,load,consultations,history,offers,patients,command,reconcile }
}

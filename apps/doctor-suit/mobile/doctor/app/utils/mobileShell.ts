import {decodeDoctorMobileContext, type DoctorMobileContext, type DoctorMobileIdentity, type DoctorMobileSelection, type DoctorMobileRoute} from '@building-suit/contracts'
export type MobilePhase = 'loading' | 'signed-out' | 'denied' | 'offline' | 'error' | 'ready'
export interface MobileShellState { phase: MobilePhase; route: DoctorMobileRoute; context: DoctorMobileContext | null }
export interface MobileContextPort { identity(): DoctorMobileIdentity | null; selection(): DoctorMobileSelection | null; load(route: DoctorMobileRoute, selection: DoctorMobileSelection, signal: AbortSignal): Promise<unknown> }
const permissions: Record<DoctorMobileRoute, string | null> = {'/workspace': null, '/schedule': 'appointments.read', '/account': null}
export function doctorMobileDestination(input: string): DoctorMobileRoute | null {
  if (input.length > 200 || /[%\\?#]/.test(input)) return null
  const path = input.startsWith('doctor-suit-synthetic://') ? '/' + input.slice('doctor-suit-synthetic://'.length) : input
  if (path === '/' || path === '/sign-in') return '/workspace'
  return ['/workspace','/schedule','/account'].includes(path) ? path as DoctorMobileRoute : null
}
export function createDoctorMobileShell(port: MobileContextPort, state: MobileShellState = {phase:'signed-out',route:'/workspace',context:null}) {
  let generation = 0, abort = new AbortController(), online = true, destinationRejected = false
  function clear(phase: MobilePhase) {generation++;abort.abort();abort=new AbortController();state.context=null;state.phase=phase}
  async function navigate(input: string) {
    const route = doctorMobileDestination(input)
    clear('loading')
    destinationRejected = !route
    if (!route) {state.phase='denied';return false}
    state.route=route
    if (!online) {state.phase='offline';return false}
    const identity=port.identity()
    if (!identity) {state.phase='signed-out';return false}
    const selection=port.selection();if(!selection){state.phase='denied';return false}
    const selected={...selection}, current={...identity}, revision=generation
    try {
      const raw=await port.load(route,selected,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]))
      const fresh=port.identity()
      if (generation!==revision)return false
      const freshSelection=port.selection()
      if(!fresh || fresh.userId!==current.userId || fresh.sessionId!==current.sessionId || fresh.environment!==current.environment){clear('signed-out');return false}
      if(!freshSelection || freshSelection.doctorId!==selected.doctorId || freshSelection.practiceId!==selected.practiceId || freshSelection.locationId!==selected.locationId){clear('denied');return false}
      const context=decodeDoctorMobileContext(raw,current,selected), required=permissions[route]
      if (required && !context.capabilities.includes(required)) {state.phase='denied';return false}
      state.context=context;state.phase='ready';return true
    } catch (error) {
      if (generation===revision) {state.context=null;state.phase=error && typeof error==='object' && 'code' in error && error.code==='42501'?'denied':'error'}
      return false
    }
  }
  function sessionChanged() {clear('signed-out')}
  function connectivity(value: boolean) {online=value;clear(value?'signed-out':'offline')}
  return {state,navigate,retry:()=>navigate(destinationRejected ? '/unavailable' : state.route),sessionChanged,connectivity,dispose:()=>clear('signed-out')}
}

import type { DoctorIdentity } from './authController'
import type { DoctorLocationContext } from './locationContext'
import { doctorContextId } from './locationContext.ts'
import { doctorScopeKey } from './contextScope.ts'
import { doctorAvailabilityToday } from './availability.ts'
import type { DoctorAppointmentBoard, DoctorAppointmentQuery } from './appointments'
export interface DoctorDashboardSection { context: DoctorLocationContext; board: DoctorAppointmentBoard }
export interface DoctorDashboardState { loading: boolean; sections: DoctorDashboardSection[]; error: 'denied'|'network'|'conflict'|'unavailable'|null; refreshedAt: string|null }
export const doctorDashboardState = (): DoctorDashboardState => ({ loading: false,sections: [],error: null,refreshedAt: null })
interface Repository {
  contexts(actor: DoctorIdentity, signal: AbortSignal): Promise<DoctorLocationContext[]>
  board(practiceId: string, locationId: string, query: DoctorAppointmentQuery, signal: AbortSignal): Promise<DoctorAppointmentBoard>
}
export function createDoctorDashboardController(repository: Repository|null,state: DoctorDashboardState,actor: () => DoctorIdentity|null,now = () => new Date()) {
  let generation = 0;let abort = new AbortController()
  const identity = () => { const value = actor();return value ? `${value.userId}:${value.sessionId}` : null }
  function clear() { generation++;abort.abort();abort = new AbortController();state.loading = false;state.sections = [];state.refreshedAt = null;state.error = null }
  async function load(pages: Record<string,{ page: number; queuePage: number }> = {}) {
    clear();const captured = generation;const owner = identity();const currentActor = actor()
    if(!repository || !currentActor) { state.error = repository ? 'denied' : 'unavailable';return false }
    const signal = AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]);state.loading = true
    const current = () => captured===generation && owner===identity() && !signal.aborted
    try {
      const options = await repository.contexts(currentActor,signal)
      if(!current())return false
      const scopes = options.filter(item => item.capabilities.includes('dashboard.read') && item.capabilities.includes('appointments.read'))
      const instant = now();const results: DoctorDashboardSection[] = [];let index = 0
      await Promise.all(Array.from({ length: Math.min(4,scopes.length) },async () => {
        while(index<scopes.length && current()) {
          const context = scopes[index++]!;const page = pages[doctorContextId(context)] || { page: 0,queuePage: 0 }
          if(!Number.isSafeInteger(page.page) || !Number.isSafeInteger(page.queuePage) || page.page<0 || page.queuePage<0 || page.page>100000 || page.queuePage>100000)throw new Error('Invalid dashboard page')
          const query = { date: doctorAvailabilityToday(context.timezone,instant),...page }
          const board = await repository.board(context.practiceId,context.locationId,query,signal)
          if(board.locationVersion!==context.locationVersion || board.timezone!==context.timezone)throw { code: '40001' }
          results.push({ context,board })
        }
      }))
      if(!current())return false
      const order = new Map(scopes.map((item,i) => [doctorContextId(item),i]))
      state.sections = results.sort((a,b) => order.get(doctorContextId(a.context))!-order.get(doctorContextId(b.context))!)
      state.refreshedAt = instant.toISOString();return true
    } catch(error) {
      if(captured===generation && owner===identity()) {
        const code = error && typeof error==='object' && 'code' in error ? error.code : ''
        clear();state.error = code==='42501' ? 'denied' : code==='40001' ? 'conflict' : 'network'
      }
      return false
    } finally { if(captured===generation && owner===identity())state.loading = false }
  }
  return { state,clear,load,scopeKey: identity,sourceKey: (context: DoctorLocationContext) => doctorScopeKey(context,'dashboard') }
}

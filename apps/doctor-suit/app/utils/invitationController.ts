import type { DoctorIdentity } from './authController'
import { doctorDelegationFailure, doctorInvitationCredential, type DoctorDelegationError, type DoctorInvitationDetails } from './delegation.ts'
import type { doctorDelegationRepository } from './delegationRepository'
export interface DoctorInvitationState { loading: boolean; pending: boolean; details: DoctorInvitationDetails | null; error: DoctorDelegationError; accepted: boolean }
export function doctorInvitationState(): DoctorInvitationState { return { loading: false,pending: false,details: null,error: null,accepted: false } }
export function createDoctorInvitationController(repository: ReturnType<typeof doctorDelegationRepository> | null,state: DoctorInvitationState,actor: () => DoctorIdentity | null,key: () => string = () => crypto.randomUUID()) {
  let generation = 0; let controller = new AbortController(); let reviewed: string | null = null; let commandKey: string | null = null
  const identity = () => { const current = actor(); return current ? `${current.userId}:${current.sessionId}` : null }
  function clear() { generation++; controller.abort(); controller = new AbortController(); reviewed = null; commandKey = null; Object.assign(state,doctorInvitationState()) }
  function changed(value: string) { if (reviewed!==value) clear() }
  async function review(value: string) {
    if (state.pending) return false
    clear()
    const credential = doctorInvitationCredential(value); const revision = generation; const expected = identity()
    if (!repository || !expected) { state.error = 'denied'; return false }
    if (!credential) { state.error = 'invalid'; return false }
    state.loading = true
    try {
      const details = await repository.review(credential.id,credential.token,AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]))
      if (revision!==generation || expected!==identity()) return false
      if (details.id!==credential.id) throw new Error('DOCTOR_INVITATION_RESPONSE_INVALID')
      reviewed = value; state.details = details; return true
    } catch (error) { if (revision===generation && expected===identity()) state.error = doctorDelegationFailure(error); return false }
    finally { if (revision===generation && expected===identity()) state.loading = false }
  }
  async function accept(value: string) {
    if (state.pending || state.loading || state.accepted) return false
    const credential = doctorInvitationCredential(value); const revision = generation; const expected = identity()
    if (!repository || !expected || !credential || reviewed!==value || state.details?.id!==credential.id || state.details.status!=='pending') { state.error = 'denied'; return false }
    commandKey ||= key()
    state.pending = true; state.error = null
    try {
      await repository.accept(credential.id,credential.token,commandKey,AbortSignal.any([controller.signal,AbortSignal.timeout(15000)]))
      if (revision!==generation || expected!==identity()) return false
      state.accepted = true; reviewed = null; commandKey = null; return true
    } catch (error) { if (revision===generation && expected===identity()) state.error = doctorDelegationFailure(error); return false }
    finally { if (revision===generation && expected===identity()) state.pending = false }
  }
  return { state,clear,changed,review,accept }
}

import { createDoctorEntitlementDeadline,doctorEntitlementKey,type DoctorEntitlementTimers } from './entitlement.ts'
import { doctorScopeKey, type DoctorContextScope } from './contextScope.ts'
import { doctorTeamCanAllocate,doctorTeamCanChangeGrants,createDoctorInvitationSecret, doctorCanonicalGrants, doctorDelegationFailure, validDoctorDelegationGrants, validDoctorInvitation, type DoctorDelegationError, type DoctorDelegationGrant, type DoctorInvitationForm, type DoctorTeamDirectory, type DoctorTeamInvitation, type DoctorTeamMember, type DoctorTeamQuery } from './delegation.ts'
import { doctorUuid } from './locationContext.ts'
import type { doctorDelegationRepository } from './delegationRepository'
export interface DoctorTeamState { loading: boolean; pending: boolean; directory: DoctorTeamDirectory | null; credential: string; error: DoctorDelegationError }
export function doctorTeamState(): DoctorTeamState { return { loading: false,pending: false,directory: null,credential: '',error: null } }
export function createDoctorTeamController(repository: ReturnType<typeof doctorDelegationRepository> | null,state: DoctorTeamState,scope: () => DoctorContextScope | null,
  key: () => string = () => crypto.randomUUID(),secret = createDoctorInvitationSecret,timers?: DoctorEntitlementTimers,onExpired?: ()=>void) {
  const expiry=createDoctorEntitlementDeadline(timers)
  const policyListeners = new Set<() => void>(); let policy: string | null = null
  let generation = 0; let controller = new AbortController()
  let command: { input: string; key: string; secret?: { token: string; hash: string } } | null = null
  const scopeKey = () => { const value = scope(); return value ? doctorScopeKey(value,'team') : null }
  const accepts = (revision: number,expected: string | null) => revision===generation && expected===scopeKey()
  function clear() { expiry.clear();policy = null; generation++; controller.abort(); controller = new AbortController(); command = null; Object.assign(state,doctorTeamState()) }
  async function load(query: DoctorTeamQuery) {
    if (state.pending) return false
    generation++; controller.abort(); controller = new AbortController()
    const revision = generation; const expected = scopeKey(); const selected = scope()
    state.directory = null; state.loading = true; state.error = null
    if (!selected || selected.portal!=='doctor' || !repository) { state.loading = false; state.error = 'denied'; return false }
    try {
      const sentAt=timers?.now()??0
      const result = await repository.load(selected.practiceId,{ ...query },AbortSignal.any([controller.signal,AbortSignal.timeout(10000)]))
      if (!accepts(revision,expected)) return false
      if(selected.edition==='administrative_candidate' && (result.edition!=='administrative_candidate' || !result.entitlement))throw {code:'42501'}
      const nextPolicy = JSON.stringify([result.edition,result.editionRevision,[...result.availableCapabilities].sort(),doctorEntitlementKey(result.entitlement)])
      if (policy && policy!==nextPolicy) for (const listener of policyListeners) listener()
      policy = nextPolicy; state.directory = result
      expiry.arm(result.entitlement,sentAt,()=>{for(const listener of policyListeners)listener();clear();onExpired?.();if(expected===scopeKey())void load({...query})},()=>accepts(revision,expected))
      return true
    } catch (error) { if (accepts(revision,expected)) state.error = doctorDelegationFailure(error); return false }
    finally { if (accepts(revision,expected)) state.loading = false }
  }
  async function mutate(kind: 'invite' | 'grants' | 'status' | 'cancel',input: { member?: DoctorTeamMember; invitation?: DoctorTeamInvitation; form?: DoctorInvitationForm; grants?: DoctorDelegationGrant[]; status?: DoctorTeamMember['status'] }) {
    if (state.pending) return false
    const selected = scope(); const expected = scopeKey(); const revision = generation; const directory = state.directory
    if (!selected || selected.portal!=='doctor' || !directory || directory.practiceId!==selected.practiceId || !repository
      || (input.member && !directory.members.some(item => item.id===input.member!.id && item.version===input.member!.version))
      || (input.invitation && !directory.invitations.some(item => item.id===input.invitation!.id && item.version===input.invitation!.version))) { state.error = 'denied'; return false }
    if(((kind==='invite' || (kind==='status' && input.status==='active')) && !doctorTeamCanAllocate(directory))
      || (kind==='grants' && input.member && input.grants && !doctorTeamCanChangeGrants(directory,input.member.grants,input.grants))) {state.error='denied';return false}
    if ((kind==='invite' && (!input.form || !validDoctorInvitation(input.form,directory.locations)))
      || (kind==='grants' && (!input.grants || !validDoctorDelegationGrants(input.grants,directory.locations)))
      || (kind==='cancel' && input.invitation?.status!=='pending')) { state.error = 'invalid'; return false }
    state.pending = true; state.error = null
    // Only whitelisted domain fields enter the stable intent identity.
    const fingerprint = JSON.stringify([expected,kind,input.member?.id,input.member?.version,input.invitation?.id,input.invitation?.version,input.status,input.grants,input.form])
    try {
      if (command?.input!==fingerprint) {
        const material = kind==='invite' ? await secret() : undefined
        if (!accepts(revision,expected)) return false
        command = { input: fingerprint,key: key(),secret: material }
      }
      const current = command!
      const signal = AbortSignal.any([controller.signal,AbortSignal.timeout(15000)])
      let credential = ''
      if (kind==='invite') {
        const result = await repository.invite(selected.practiceId,input.form!.email,input.form!.grants,current.secret!.hash,current.key,signal)
        if (!result || typeof result!=='object' || Array.isArray(result) || !('invitation_id' in result) || !doctorUuid(result.invitation_id)) throw new Error('DOCTOR_INVITATION_RESPONSE_INVALID')
        credential = `${result.invitation_id}.${current.secret!.token}`
      } else if (kind==='grants') await repository.grants(selected.practiceId,input.member!.id,input.member!.version,input.grants!,current.key,signal)
      else if (kind==='status') await repository.status(selected.practiceId,input.member!.id,input.member!.version,input.status!,current.key,signal)
      else await repository.cancel(selected.practiceId,input.invitation!.id,input.invitation!.version,current.key,signal)
      if (!accepts(revision,expected)) return false
      command = null; state.credential = credential; return true
    } catch (error) { if (accepts(revision,expected)) state.error = doctorDelegationFailure(error); return false }
    finally { if (accepts(revision,expected)) state.pending = false }
  }
  // Context selection completes before its directory request. Editors may open
  // only once the matching directory has supplied their location choices.
  function available() {
    const selected = scope(); const directory = state.directory
    return Boolean(selected?.portal==='doctor' && directory?.practiceId===selected.practiceId
      && !state.loading && directory.locationTotal<=directory.locations.length)
  }
  return { state,clear,load,available,registerPolicyChange: (listener: () => void) => { policyListeners.add(listener); return () => { policyListeners.delete(listener) } },forgetCredential: () => { state.credential = ''; command = null },
    invite: (form: DoctorInvitationForm) => mutate('invite',{ form: { email: form.email.trim().toLowerCase(),grants: doctorCanonicalGrants(form.grants) } }),
    grants: (member: DoctorTeamMember,grants: DoctorDelegationGrant[]) => mutate('grants',{ member,grants: doctorCanonicalGrants(grants) }),
    status: (member: DoctorTeamMember,status: DoctorTeamMember['status']) => mutate('status',{ member,status }),
    cancel: (invitation: DoctorTeamInvitation) => mutate('cancel',{ invitation }),
  }
}

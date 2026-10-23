import {validClinicalSnapshot, clinicalCommandResult, type ClinicalSnapshot, type ClinicalDetail, type ClinicalCommandResult, type DoctorMobileContext} from '@building-suit/contracts'
import {nativePatientScopeKey} from './nativePatients.ts'
export interface NativeEncounterPort {
  detail(context: DoctorMobileContext, id: string, signal: AbortSignal): Promise<ClinicalDetail>
  save(context: DoctorMobileContext, id: string, version: number, snapshot: ClinicalSnapshot, key: string, signal: AbortSignal): Promise<ClinicalCommandResult>
}
export interface NativeEncounterState {
  phase: 'idle' | 'loading' | 'ready' | 'denied' | 'error'
  outcome: 'idle' | 'unsent' | 'submitting' | 'acknowledged' | 'conflict' | 'unknown'
  detail: ClinicalDetail | null
  draft: ClinicalSnapshot | null
  error: 'denied' | 'invalid' | 'conflict' | 'unknown' | null
}
export const nativeEncounterState = (): NativeEncounterState => ({phase:'idle',outcome:'idle',detail:null,draft:null,error:null})
const owned = (context: DoctorMobileContext | null) => context?.portal === 'doctor' && context.userId === context.doctorId
const editable = (detail: ClinicalDetail | null) => detail && ['draft','in_progress'].includes(detail.encounter.status)
/** Memory-only synthetic edits. Unknown outcomes have no resend path. A fresh
 * server revision and explicit discard are required before another edit. */
export function createNativeEncounter(port: NativeEncounterPort | null, scope: () => DoctorMobileContext | null, state = nativeEncounterState(), key = () => crypto.randomUUID()) {
  let generation = 0, abort = new AbortController(), verifiedKey: string | null = null
  function clear() {generation++;abort.abort();abort=new AbortController();verifiedKey=null;Object.assign(state,nativeEncounterState())}
  const accepts = (revision: number, selected: string | null) => revision === generation && selected !== null && selected === nativePatientScopeKey(scope())
  async function load(id: string, discard = false): Promise<boolean> {
    if (state.outcome === 'submitting' || (state.draft && !discard)) return false
    clear()
    const context = scope(), selected = nativePatientScopeKey(context), revision = generation
    if (!port || !context || !owned(context) || !/^[0-9a-f-]{36}$/i.test(id)) {state.phase='denied';return false}
    state.phase='loading'
    try {
      const detail=await port.detail(context,id,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]))
      if(!accepts(revision,selected))return false
      if(detail.encounter.id!==id||detail.encounter.practice_id!==context.practiceId||detail.encounter.location_id!==context.locationId||detail.encounter.responsible_doctor!==context.doctorId||detail.data_mode!=='synthetic'||detail.clinical_approval!==false||detail.live_prescribing!==false)throw new Error('Invalid detail')
      state.detail=detail;verifiedKey=selected;state.phase='ready';return true
    }catch(error){if(accepts(revision,selected)){state.phase='error';state.error=error&&typeof error==='object'&&'code'in error&&error.code==='42501'?'denied':'unknown'}return false}
  }
  function edit(snapshot?: ClinicalSnapshot): boolean {
    if(state.phase!=='ready'||!owned(scope())||verifiedKey!==nativePatientScopeKey(scope())||!editable(state.detail)||['submitting','conflict','unknown'].includes(state.outcome))return false
    const value=snapshot??state.detail?.versions[0]?.snapshot
    if(!value||!validClinicalSnapshot(value))return false
    state.draft=structuredClone(value);state.outcome='unsent';state.error=null;return true
  }
  async function save(): Promise<boolean> {
    const context=scope(),selected=nativePatientScopeKey(context),detail=state.detail,draft=state.draft,revision=generation
    if(!port||!context||!owned(context)||verifiedKey!==selected||!detail||!editable(detail)||!draft||!validClinicalSnapshot(draft)||state.outcome!=='unsent')return false
    const snapshot=structuredClone(draft),commandKey=key(),expected=detail.encounter.version
    state.outcome='submitting';state.error=null
    try {
      const result=clinicalCommandResult(await port.save(context,detail.encounter.id,expected,snapshot,commandKey,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)])))
      if(!accepts(revision,selected))return false
      if(result.encounter_id!==detail.encounter.id||result.version!==expected+1||result.status!==detail.encounter.status)throw new Error('Acknowledgement mismatch')
      // The acknowledged command is not a fresh editable server snapshot.
      state.draft=null;state.detail=null;verifiedKey=null;state.outcome='acknowledged';return true
    }catch(error){
      if(accepts(revision,selected)){
        const code=error&&typeof error==='object'&&'code'in error?error.code:null
        state.outcome=code==='40001'?'conflict':code==='42501'||code==='22023'?'unsent':'unknown'
        state.error=code==='40001'?'conflict':code==='42501'?'denied':code==='22023'?'invalid':'unknown'
        if(code==='42501'){state.draft=null;state.detail=null;verifiedKey=null;state.phase='denied'}
      }
      return false
    }
  }
  return {state,clear,load,edit,save,dirty:()=>state.draft!==null,dispose:clear}
}

import {nativeOperationSignal,nativeCommandKey} from './nativeWebCapabilities.ts'
import {validClinicalSnapshot, clinicalCommandResult, clinicalUuid, emptyClinicalSnapshot, type ClinicalSnapshot, type ClinicalDirectory, type ClinicalDetail, type ClinicalCommandResult, type DoctorMobileContext} from '@building-suit/contracts'
import {nativePatientScopeKey} from './nativePatients.ts'
export interface NativeEncounterPort {
  directory?(context: DoctorMobileContext, page: number, search: string, signal: AbortSignal): Promise<ClinicalDirectory>
  create?(context: DoctorMobileContext, patientId: string, snapshot: ClinicalSnapshot, key: string, signal: AbortSignal): Promise<ClinicalCommandResult>
  detail(context: DoctorMobileContext, id: string, signal: AbortSignal, page?: number): Promise<ClinicalDetail>
  save(context: DoctorMobileContext, id: string, version: number, snapshot: ClinicalSnapshot, key: string, signal: AbortSignal): Promise<ClinicalCommandResult>
}
export interface NativeEncounterState {
  phase: 'idle' | 'loading' | 'ready' | 'denied' | 'error'
  outcome: 'idle' | 'unsent' | 'submitting' | 'acknowledged' | 'conflict' | 'unknown'
  historyPage: number
  catalogue: ClinicalDirectory | null
  creating: boolean
  patientId: string | null
  acknowledgedId: string | null
  detail: ClinicalDetail | null
  draft: ClinicalSnapshot | null
  error: 'denied' | 'invalid' | 'conflict' | 'unknown' | null
}
export const nativeEncounterState = (): NativeEncounterState => ({phase:'idle',outcome:'idle',historyPage:0,catalogue:null,creating:false,patientId:null,acknowledgedId:null,detail:null,draft:null,error:null})
const owned = (context: DoctorMobileContext | null) => context?.portal === 'doctor' && context.userId === context.doctorId
const cloneSnapshot=(value:ClinicalSnapshot):ClinicalSnapshot=>JSON.parse(JSON.stringify(value))
const editable = (detail: ClinicalDetail | null) => detail && ['draft','in_progress','amended'].includes(detail.encounter.status)
/** Memory-only synthetic edits. Unknown outcomes have no resend path. A fresh
 * server revision and explicit discard are required before another edit. */
export function createNativeEncounter(port: NativeEncounterPort | null, scope: () => DoctorMobileContext | null, state = nativeEncounterState(), key = nativeCommandKey) {
  let generation = 0, abort = new AbortController(), verifiedKey: string | null = null
  function clear() {generation++;abort.abort();abort=new AbortController();verifiedKey=null;Object.assign(state,nativeEncounterState())}
  const accepts = (revision: number, selected: string | null) => revision === generation && selected !== null && selected === nativePatientScopeKey(scope())
  async function load(id: string, discard = false, page = 0): Promise<boolean> {
    if (state.outcome === 'submitting' || (state.draft && !discard)) return false
    const previous=verifiedKey===nativePatientScopeKey(scope())?state.catalogue:null
    clear();state.catalogue=previous;state.historyPage=page
    const context = scope(), selected = nativePatientScopeKey(context), revision = generation
    if (!port || !context || !owned(context) || !clinicalUuid(id)) {state.phase='denied';return false}
    state.phase='loading'
    try {
      const detail=await port.detail(context,id,nativeOperationSignal(abort.signal),page)
      if(!accepts(revision,selected))return false
      if(detail.encounter.id!==id||detail.encounter.practice_id!==context.practiceId||detail.encounter.location_id!==context.locationId||detail.encounter.responsible_doctor!==context.doctorId||detail.data_mode!=='synthetic'||detail.clinical_approval!==false||detail.live_prescribing!==false)throw new Error('Invalid detail')
      state.detail=detail;verifiedKey=selected;state.phase='ready';return true
    }catch(error){if(accepts(revision,selected)){state.phase='error';state.catalogue=null;state.detail=null;verifiedKey=null;state.error=error&&typeof error==='object'&&'code'in error&&error.code==='42501'?'denied':'unknown'}return false}
  }
  async function directory(page=0,search='',discard=false):Promise<boolean>{
    if(state.outcome==='submitting'||(state.draft&&!discard))return false
    clear()
    const context=scope(),selected=nativePatientScopeKey(context),revision=generation
    if(!port?.directory||!context||!owned(context)){state.phase='denied';return false}
    state.phase='loading'
    try{
      const catalogue=await port.directory(context,page,search,nativeOperationSignal(abort.signal))
      if(!accepts(revision,selected))return false
      state.catalogue=catalogue;verifiedKey=selected;state.phase=catalogue.available?'ready':'denied';return catalogue.available
    }catch{if(accepts(revision,selected)){state.phase='error';state.error='unknown'}return false}
  }
  function create():boolean{
    if(state.phase!=='ready'||!owned(scope())||verifiedKey!==nativePatientScopeKey(scope())||!state.catalogue?.available||!state.catalogue.capabilities.includes('draft')||!port?.create||state.draft||['submitting','conflict','unknown'].includes(state.outcome))return false
    state.creating=true;state.patientId=null;state.detail=null;state.draft=emptyClinicalSnapshot();state.outcome='unsent';return true
  }
  function patient(id:string):boolean{
    if(!state.creating||state.outcome!=='unsent'||!state.catalogue?.patients.some(item=>item.id===id))return false
    state.patientId=id;return true
  }
  function edit(snapshot?: ClinicalSnapshot): boolean {
    if(state.phase!=='ready'||!owned(scope())||verifiedKey!==nativePatientScopeKey(scope())||(!state.creating&&!editable(state.detail))||['submitting','conflict','unknown'].includes(state.outcome))return false
    const current=state.detail?.versions.find(version=>version.revision===state.detail?.encounter.version)
    if(!state.creating&&!current)return false
    const value=snapshot??state.draft??current?.snapshot
    if(!value||!validClinicalSnapshot(value))return false
    state.draft=cloneSnapshot(value);state.outcome='unsent';state.error=null;return true
  }
  async function save(): Promise<boolean> {
    const context=scope(),selected=nativePatientScopeKey(context),detail=state.detail,draft=state.draft,revision=generation
    if(!port||!context||!owned(context)||verifiedKey!==selected||(!state.creating&&(!detail||!editable(detail)))||(state.creating&&(!port.create||!state.patientId||!state.catalogue?.patients.some(item=>item.id===state.patientId)))||!draft||!validClinicalSnapshot(draft)||state.outcome!=='unsent')return false
    const snapshot=cloneSnapshot(draft),commandKey=key(),expected=state.creating?0:detail!.encounter.version,creating=state.creating,patientId=state.patientId
    state.outcome='submitting';state.error=null
    try {
      const signal=nativeOperationSignal(abort.signal)
      const result=clinicalCommandResult(creating?await port.create!(context,patientId!,snapshot,commandKey,signal):await port.save(context,detail!.encounter.id,expected,snapshot,commandKey,signal))
      if(!accepts(revision,selected))return false
      if((!creating&&result.encounter_id!==detail!.encounter.id)||result.version!==expected+1||result.status!==(creating?'draft':detail!.encounter.status))throw new Error('Acknowledgement mismatch')
      // The acknowledged command is not a fresh editable server snapshot.
      state.acknowledgedId=result.encounter_id;state.draft=null;state.detail=null;state.creating=false;state.patientId=null;verifiedKey=null;state.outcome='acknowledged';return true
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
  function observe(detail:ClinicalDetail,catalogue:ClinicalDirectory):boolean{
    const context=scope(),record=state.detail?.encounter
    if(state.outcome==='submitting'||!context||!owned(context)||verifiedKey!==nativePatientScopeKey(context)||!record||detail.encounter.id!==record.id||detail.encounter.practice_id!==context.practiceId||detail.encounter.location_id!==context.locationId||detail.encounter.responsible_doctor!==context.doctorId||detail.encounter.version<record.version||detail.data_mode!=='synthetic'||detail.clinical_approval!==false||detail.live_prescribing!==false||catalogue.data_mode!=='synthetic'||catalogue.clinical_approval!==false||catalogue.live_prescribing!==false)return false
    const previous=state.detail?.versions.find(item=>item.revision===record.version),latest=detail.versions.find(item=>item.revision===detail.encounter.version)
    const changed=detail.encounter.version!==record.version||previous?.id!==latest?.id||previous?.snapshot_sha256!==latest?.snapshot_sha256
    if(changed&&state.draft){state.outcome='conflict';state.error='conflict'}
    state.detail=detail;state.catalogue=catalogue;return true
  }
  return {state,clear,directory,create,patient,load,edit,save,observe,dirty:()=>state.draft!==null,dispose:clear}
}

import {clinicalCommandResult,validClinicalSnapshot,type ClinicalDetail,type ClinicalDirectory,type ClinicalCommandResult,type DoctorMobileContext} from '@building-suit/contracts'
import {nativePatientScopeKey} from './nativePatients.ts'
import {nativeCommandKey,nativeOperationSignal} from './nativeWebCapabilities.ts'
export interface NativePrescriptionReviewPort {
 directory(scope:DoctorMobileContext,page:number,search:string,signal:AbortSignal):Promise<ClinicalDirectory>
 detail(scope:DoctorMobileContext,id:string,signal:AbortSignal,page?:number):Promise<ClinicalDetail>
 start(scope:DoctorMobileContext,id:string,version:number,key:string,signal:AbortSignal):Promise<ClinicalCommandResult>
 transition(scope:DoctorMobileContext,id:string,version:number,action:'amend'|'withdraw',reason:string,key:string,signal:AbortSignal):Promise<ClinicalCommandResult>
 finalize(scope:DoctorMobileContext,id:string,version:number,reviewedVersion:string,sha256:string,key:string,signal:AbortSignal):Promise<ClinicalCommandResult>
}
interface ReviewTarget {encounterId:string;version:number;versionId:string;sha256:string}
export interface NativePrescriptionReviewState {
 phase:'idle'|'checking'|'ready'|'submitting'|'stale'|'expired'|'denied'|'invalid'|'unknown'|'acknowledged'
 target:Readonly<ReviewTarget>|null
 result:ClinicalCommandResult|null
}
export const nativePrescriptionReviewState=():NativePrescriptionReviewState=>({phase:'idle',target:null,result:null})
const owner=(scope:DoctorMobileContext|null)=>scope?.portal==='doctor'&&scope.userId===scope.doctorId&&scope.environment==='local'&&scope.dataMode==='synthetic'
const denied=()=>Object.assign(new Error('Current synthetic clinician authority required'),{code:'42501'})
/** A review lease identifies one verified synthetic revision. It is neither a
 * professional signature nor persisted authority. Unknown commands never replay. */
export function createNativePrescriptionReview(port:NativePrescriptionReviewPort|null,scope:()=>DoctorMobileContext|null,current:()=>ClinicalDetail|null,
 observe:(detail:ClinicalDetail,directory:ClinicalDirectory)=>boolean,clearProtected:()=>void=()=>{},hasDraft:()=>boolean=()=>false,
 options:{state?:NativePrescriptionReviewState;now?:()=>number;key?:()=>string;historyPage?:()=>number}={}){
 const state=options.state??nativePrescriptionReviewState(),now=options.now??(()=>performance.now()),key=options.key??nativeCommandKey,historyPage=options.historyPage??(()=>0)
 let generation=0,abort=new AbortController(),busy=false
 let lease:Readonly<ReviewTarget&{scopeKey:string;createdAt:number}>|null=null
 const scopeKey=()=>nativePatientScopeKey(scope())
 function clear(){generation++;abort.abort();abort=new AbortController();busy=false;lease=null;Object.assign(state,nativePrescriptionReviewState())}
 function begin(phase:'checking'|'submitting'){
  generation++;abort.abort();abort=new AbortController();busy=true;lease=null;state.target=null;state.result=null;state.phase=phase
  return{revision:generation,key:scopeKey(),signal:nativeOperationSignal(abort.signal)}
 }
 const accepts=(capture:{revision:number;key:string|null},id:string)=>capture.revision===generation&&capture.key!==null&&capture.key===scopeKey()&&current()?.encounter.id===id&&owner(scope())
 function deny(){lease=null;state.target=null;state.result=null;state.phase='denied';clearProtected()}
 function reject(capture:{revision:number;key:string|null},id:string,error:unknown){
  if(!accepts(capture,id))return false
  lease=null;state.target=null;state.result=null
  const code=error&&typeof error==='object'&&'code'in error?error.code:null
  if(code==='42501')deny();else state.phase=code==='40001'?'stale':code==='22023'?'invalid':'unknown'
  return false
 }
 async function permission(context:DoctorMobileContext,signal:AbortSignal,capability:'draft'|'sign'|'read'|'review'){
  const value=await port!.directory(context,0,'',signal)
  if(value.data_mode!=='synthetic'||value.clinical_approval!==false||value.live_prescribing!==false||!value.available||!value.capabilities.includes(capability))throw denied()
  return value
 }
 function checkedDetail(value:ClinicalDetail,context:DoctorMobileContext,id:string){
  if(value.encounter.id!==id||value.encounter.practice_id!==context.practiceId||value.encounter.location_id!==context.locationId||value.encounter.responsible_doctor!==context.doctorId||value.data_mode!=='synthetic'||value.clinical_approval!==false||value.live_prescribing!==false)throw denied()
  return value
 }
 async function prepare(versionId:string):Promise<boolean>{
  const context=scope(),displayed=current(),record=displayed?.encounter,version=displayed?.versions.find(item=>item.id===versionId)
  if(!context||!owner(context)){clear();state.phase='denied';return false}
  if(busy||['unknown','acknowledged'].includes(state.phase)||!port||hasDraft()||!record||!version||version.revision!==record.version||!['in_progress','amended'].includes(record.status))return false
  const capture=begin('checking')
  try{
   const directory=await permission(context,capture.signal,'sign')
   const fresh=checkedDetail(await port.detail(context,record.id,capture.signal),context,record.id)
   if(!accepts(capture,record.id))return false
   const selected=fresh.versions.find(item=>item.id===versionId)
   if(!observe(fresh,directory)){state.phase='stale';return false}
   if(!['in_progress','amended'].includes(fresh.encounter.status)||fresh.encounter.status!==record.status||fresh.encounter.version!==record.version||!selected||selected.revision!==fresh.encounter.version||selected.snapshot_sha256!==version.snapshot_sha256||selected.professional_signature!==false||selected.synthetic_attestation!==true||selected.version_status!=='draft'||selected.kind!==fresh.encounter.status){
    state.phase='stale';return false
   }
   if(!validClinicalSnapshot(selected.snapshot,true)){state.phase='invalid';return false}
   const target=Object.freeze({encounterId:record.id,version:fresh.encounter.version,versionId:selected.id,sha256:selected.snapshot_sha256})
   lease=Object.freeze({...target,scopeKey:capture.key!,createdAt:now()});state.target=target;state.phase='ready';return true
  }catch(error){return reject(capture,record.id,error)}
  finally{if(capture.revision===generation)busy=false}
 }
 async function finalize():Promise<boolean>{
  const reviewed=lease,context=scope(),record=current()?.encounter
  if(busy||!reviewed||!port)return false
  if(!context||!owner(context)){clear();state.phase='denied';return false}
  if(hasDraft()){lease=null;state.target=null;state.phase='stale';return false}
  if(reviewed.scopeKey!==scopeKey()||record?.id!==reviewed.encounterId||record.version!==reviewed.version){lease=null;state.target=null;state.phase='stale';return false}
  const shown=current()?.versions.find(item=>item.id===reviewed.versionId)
  if(!shown||shown.revision!==reviewed.version||shown.snapshot_sha256!==reviewed.sha256||shown.professional_signature!==false||!['in_progress','amended'].includes(record.status)){lease=null;state.target=null;state.phase='stale';return false}
  const age=now()-reviewed.createdAt
  if(!Number.isFinite(age)||age<0||age>=30000){lease=null;state.target=null;state.phase='expired';return false}
  const capture=begin('submitting')
  try{
   // Fresh permission is also enforced inside the owning repository/server.
   await permission(context,capture.signal,'sign')
   const raw=await port.finalize(context,reviewed.encounterId,reviewed.version,reviewed.versionId,reviewed.sha256,key(),capture.signal)
   if(!accepts(capture,reviewed.encounterId))return false
   const result=clinicalCommandResult(raw)
   if(result.encounter_id!==reviewed.encounterId||result.version!==reviewed.version+1||result.status!=='finalized'||result.release_id!==null||('professional_signature'in raw&&raw.professional_signature!==false))throw new Error('Synthetic acknowledgement mismatch')
   state.result=result;state.phase='acknowledged';return true
  }catch(error){return reject(capture,reviewed.encounterId,error)}
  finally{if(capture.revision===generation)busy=false}
 }
 async function start():Promise<boolean>{
  const context=scope(),record=current()?.encounter
  if(busy||['unknown','acknowledged'].includes(state.phase)||!port||!context||!owner(context)||hasDraft()||record?.status!=='draft')return false
  const capture=begin('submitting')
  try{
   const directory=await permission(context,capture.signal,'draft')
   const fresh=checkedDetail(await port.detail(context,record.id,capture.signal),context,record.id)
   if(!accepts(capture,record.id))return false
   if(fresh.encounter.version!==record.version||fresh.encounter.status!=='draft'){observe(fresh,directory);state.phase='stale';return false}
   if(!observe(fresh,directory)){state.phase='stale';return false}
   const result=clinicalCommandResult(await port.start(context,record.id,record.version,key(),capture.signal))
   if(!accepts(capture,record.id))return false
   if(result.encounter_id!==record.id||result.version!==record.version+1||result.status!=='in_progress'||result.release_id!==null)throw new Error('Synthetic acknowledgement mismatch')
   state.result=result;state.phase='acknowledged';return true
  }catch(error){return reject(capture,record.id,error)}
  finally{if(capture.revision===generation)busy=false}
 }
 async function transition(action:'amend'|'withdraw',id:string,version:number,reason:string):Promise<boolean>{
  const context=scope(),record=current()?.encounter
  if(busy||['unknown','acknowledged'].includes(state.phase)||!port||!context||!owner(context)||hasDraft()||!record||record.id!==id||record.version!==version||record.status!=='finalized'||!reason.trim()||reason.length>500)return false
  const capture=begin('submitting')
  try{
   const directory=await permission(context,capture.signal,action==='amend'?'review':'sign')
   const fresh=checkedDetail(await port.detail(context,id,capture.signal),context,id)
   if(!accepts(capture,id))return false
   if(fresh.encounter.version!==version||fresh.encounter.status!=='finalized'){observe(fresh,directory);state.phase='stale';return false}
   if(!observe(fresh,directory)){state.phase='stale';return false}
   const raw=await port.transition(context,id,version,action,reason.trim(),key(),capture.signal),result=clinicalCommandResult(raw)
   if(!accepts(capture,id))return false
   if(result.encounter_id!==id||result.version!==version+1||result.status!==(action==='amend'?'amended':'withdrawn')||result.release_id!==null||('professional_signature'in raw&&raw.professional_signature!==false))throw new Error('Synthetic acknowledgement mismatch')
   state.result=result;state.phase='acknowledged';return true
  }catch(error){return reject(capture,id,error)}
  finally{if(capture.revision===generation)busy=false}
 }
 async function revalidate():Promise<boolean>{
  const context=scope(),displayed=current(),record=displayed?.encounter
  if(!context||!owner(context)){clear();state.phase='denied';return false}
  if(busy||!port||!record)return false
  const revision=generation,captured=scopeKey(),page=historyPage(),signal=nativeOperationSignal(abort.signal)
  try{
   const directory=await permission(context,signal,'read'),fresh=checkedDetail(await port.detail(context,record.id,signal,page),context,record.id)
   if(revision!==generation||captured!==scopeKey()||historyPage()!==page||current()?.encounter.id!==record.id)return false
   const previous=displayed.versions.find(item=>item.revision===record.version),latest=fresh.versions.find(item=>item.revision===fresh.encounter.version)
   const changed=fresh.encounter.version!==record.version||previous?.id!==latest?.id||previous?.snapshot_sha256!==latest?.snapshot_sha256
   if(!observe(fresh,directory))return false
   if(changed){lease=null;state.target=null;state.phase='stale'}
   else if(!directory.capabilities.includes('sign')){lease=null;state.target=null;state.phase='denied'}
   else if(lease&&(now()-lease.createdAt>=30000||now()<lease.createdAt)){lease=null;state.target=null;state.phase='expired'}
   return true
  }catch(error){return reject({revision,key:captured},record.id,error)}
 }
 return{state,clear,prepare,finalize,start,transition,revalidate,dispose:clear,pending:()=>busy}
}

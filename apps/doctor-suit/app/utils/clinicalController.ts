import { doctorScopeKey,type DoctorContextScope } from './contextScope.ts'
import type { Json } from '../types/database.types'
import { clinicalUuid,type ClinicalAction,type ClinicalDirectory,type ClinicalDetail,type ClinicalCommandResult } from './clinical.ts'
import type { clinicalRepository } from './clinicalRepository'
export type ClinicalError = 'denied'|'invalid'|'conflict'|'network'|null
export interface ClinicalState {loading:boolean;pending:boolean;directory:ClinicalDirectory|null;detail:ClinicalDetail|null;error:ClinicalError}
export const clinicalState=():ClinicalState=>({loading:false,pending:false,directory:null,detail:null,error:null})
export function clinicalFailure(error:unknown):ClinicalError {
 const code=error&&typeof error==='object'&&'code' in error?String(error.code):''
 return code==='42501'?'denied':code==='40001'?'conflict':['22023','22007','22008','23514','54000'].includes(code)?'invalid':'network'
}
export function createClinicalController(repository:ReturnType<typeof clinicalRepository>|null,state:ClinicalState,scope:()=>DoctorContextScope|null,key=()=>crypto.randomUUID()) {
 let generation=0,abort=new AbortController(),intent:{fingerprint:string;key:string}|null=null
 const currentKey=()=>{const selected=scope();return selected?doctorScopeKey(selected,'clinical'):null}
 const accepts=(expected:number,expectedKey:string|null)=>expected===generation&&currentKey()===expectedKey
 function clear(){generation++;abort.abort();abort=new AbortController();intent=null;Object.assign(state,clinicalState())}
 function discard(){intent=null;state.error=null}
 function request(){const selected=scope();return selected?.locationId&&repository?{scope:selected,signal:AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]),generation,key:currentKey()}:null}
 async function load(page=0,search='',preserveDetail=false){
  if(state.pending)return false
  generation++;abort.abort();abort=new AbortController()
  const capture=request();state.loading=true;state.error=null
  if(!capture){state.directory=null;state.detail=null;state.loading=false;state.error='denied';return false}
  try{const value=await repository!.load(capture.scope.practiceId,capture.scope.locationId!,page,search,capture.signal);if(!accepts(capture.generation,capture.key))return false;state.directory=value;if(!value.available||!preserveDetail)state.detail=null;return true}
  catch(error){if(accepts(capture.generation,capture.key)){state.error=clinicalFailure(error);state.directory=null;state.detail=null}return false}
  finally{if(accepts(capture.generation,capture.key))state.loading=false}
 }
 async function detail(id:string,page=0){
  if(state.pending||!clinicalUuid(id))return false
  // Choosing a record retires old record requests and retry intents.
  generation++;abort.abort();abort=new AbortController();discard();state.detail=null
  const capture=request();if(!capture){state.error='denied';return false}state.loading=true
  try{const value=await repository!.detail(capture.scope.practiceId,capture.scope.locationId!,id,page,capture.signal);if(!accepts(capture.generation,capture.key))return false;state.detail=value;return true}
  catch(error){if(accepts(capture.generation,capture.key))state.error=clinicalFailure(error);return false}
  finally{if(accepts(capture.generation,capture.key))state.loading=false}
 }
 async function command(action:ClinicalAction,input:Json,create=false):Promise<ClinicalCommandResult|null>{
  if(state.pending)return null
  const capture=request(),record=create?null:state.detail?.encounter
  if(!capture||(!create&&!record)){state.error='denied';return null}
  const copied=structuredClone(input),fingerprint=JSON.stringify([capture.key,record?.id,record?.version,action,copied])
  if(intent?.fingerprint!==fingerprint)intent={fingerprint,key:key()}
  const commandKey=intent.key;state.pending=true;state.error=null
  try{const result=await repository!.command(capture.scope.practiceId,capture.scope.locationId!,record?.id??null,record?.version??null,action,copied,commandKey,capture.signal);if(!accepts(capture.generation,capture.key))return null;intent=null;return result}
  catch(error){if(accepts(capture.generation,capture.key))state.error=clinicalFailure(error);return null}
  finally{if(accepts(capture.generation,capture.key))state.pending=false}
 }
 return {state,clear,discard,load,detail,command}
}

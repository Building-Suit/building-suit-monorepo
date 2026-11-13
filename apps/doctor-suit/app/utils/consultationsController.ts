import type {consultationsRepository} from './consultationsRepository'
import {validConsultationInput,type ConsultationInput,type ConsultationType} from './consultations.ts'
import {doctorScopeKey} from './contextScope.ts'
import {doctorUuid,type DoctorLocationContext} from './locationContext.ts'
import {doctorPatientFailure,type DoctorPatientError} from './patientsController.ts'
export const consultationsState=()=>({types:[] as ConsultationType[],canManage:false,loading:false,pending:false,error:null as DoctorPatientError})
export function createConsultationsController(repository:ReturnType<typeof consultationsRepository>|null,state:ReturnType<typeof consultationsState>,scope:()=>DoctorLocationContext|null,key=()=>crypto.randomUUID()){
 let generation=0,read=0,abort=new AbortController(),intent:{material:string;key:string}|null=null
 const scopeKey=()=>{const s=scope();return s?doctorScopeKey(s,'consultation-types'):null}
 const capture=()=>JSON.stringify([generation,scopeKey()]);const signal=()=>AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
 function clear(){generation++;read++;abort.abort();abort=new AbortController();intent=null;Object.assign(state,consultationsState())}
 function fail(error:unknown){const failure=doctorPatientFailure(error);if(failure==='denied')clear();state.error=failure}
 async function load(){const s=scope(),expected=capture(),revision=++read;if(!repository||!s)return false;state.loading=true;state.error=null
  try{const result=await repository.load(s.practiceId,s.locationId,signal());if(expected!==capture()||revision!==read)return false;state.types=result.types;state.canManage=result.canManage;return true}catch(e){if(expected===capture()&&revision===read){state.types=[];state.canManage=false;fail(e)}return false}finally{if(expected===capture()&&revision===read)state.loading=false}}
 async function write(id:string,version:number,input:ConsultationInput){const s=scope(),expected=capture();if(state.pending)return false
  if(!repository||!s||!doctorUuid(id)||!Number.isSafeInteger(version)||version<0||!validConsultationInput(input)||!input.location_ids.includes(s.locationId)){state.error='invalid';return false}
  if(!state.canManage){state.error='denied';return false}const material=JSON.stringify([scopeKey(),id,version,input]);if(intent?.material!==material)intent={material,key:key()};state.pending=true;state.error=null
  try{await repository.write(s.practiceId,s.locationId,id,version,input,intent.key,signal());if(expected!==capture())return false;intent=null;return true}catch(e){if(expected===capture()){fail(e);if(state.error!=='network')intent=null}return false}finally{if(expected===capture())state.pending=false}}
 return{state,scopeKey,clear,load,write,discard(){intent=null;state.error=null}}
}

import type{DoctorIdentity}from'./authController'
import type{doctorPrivacyRepository}from'./privacyRepository'
import{doctorPrivacyKinds,type DoctorPrivacyKind,type DoctorPrivacyRequest}from'./privacyRequests.ts'
export interface DoctorPrivacyState{items:DoctorPrivacyRequest[];kind:DoctorPrivacyKind;loading:boolean;pending:boolean;ready:boolean;error:'denied'|'conflict'|'network'|null;submitted:boolean}
export const doctorPrivacyState=():DoctorPrivacyState=>({items:[],kind:'access_review',loading:false,pending:false,ready:false,error:null,submitted:false})
export function createDoctorPrivacyController(repository:ReturnType<typeof doctorPrivacyRepository>|null,state:DoctorPrivacyState,identity:()=>DoctorIdentity|null,environment:string,key=()=>crypto.randomUUID()){
 let generation=0,loadedScope:string|null=null,abort=new AbortController(),attempt:{scope:string;kind:DoctorPrivacyKind;key:string}|null=null
 const scope=()=>{const actor=identity();return actor?JSON.stringify(['doctor-suit',environment,actor.userId,actor.sessionId,'own-account-privacy']):null}
 function clear(){generation++;abort.abort();abort=new AbortController();loadedScope=null;attempt=null;Object.assign(state,doctorPrivacyState())}
 const active=(g:number,s:string|null)=>g===generation&&s===scope()
 async function load(){
  if(state.pending)return false
  const actor=identity(),s=scope();if(loadedScope!==s)clear();const g=++generation;abort.abort();abort=new AbortController();state.loading=true;state.error=null;state.ready=false;state.items=[];loadedScope=null
  if(!repository||!actor){state.loading=false;state.error='denied';return false}
  try{const rows=await repository.load(actor,AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]));if(!active(g,s))return false;state.items=rows;loadedScope=s;state.ready=true;return true}
  catch(error){if(active(g,s))state.error=failure(error);return false}finally{if(active(g,s))state.loading=false}
 }
 function canSubmit(){return Boolean(loadedScope===scope()&&state.ready&&!state.loading&&!state.pending&&doctorPrivacyKinds.includes(state.kind)&&!state.items.some(row=>row.kind===state.kind)&&state.error!=='denied'&&state.error!=='conflict')}
 async function submit(){
  if(!repository||!canSubmit())return false
  const s=scope()!,g=generation,kind=state.kind;if(attempt?.scope!==s||attempt.kind!==kind)attempt={scope:s,kind,key:key()};state.pending=true;state.error=null;state.submitted=false
  try{await repository.submit(kind,attempt.key,AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]));if(!active(g,s))return false;attempt=null;state.pending=false;const loaded=await load();if(loaded)state.submitted=true;return loaded}
  catch(error){if(active(g,s))state.error=failure(error);return false}finally{if(active(g,s))state.pending=false}
 }
 return{state,clear,load,submit,canSubmit}
}
function failure(error:unknown):'denied'|'conflict'|'network'{const code=error&&typeof error==='object'&&'code'in error?String(error.code):'';return code==='42501'||code==='DS001'?'denied':code==='40001'||code==='22023'?'conflict':'network'}

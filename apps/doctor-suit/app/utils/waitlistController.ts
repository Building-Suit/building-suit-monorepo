import{doctorScopeKey}from'./contextScope.ts'
import{doctorUuid,type DoctorLocationContext}from'./locationContext.ts'
import{doctorScheduleDate,type DoctorAvailability}from'./availability.ts'
import{doctorPatientFailure,type DoctorPatientError}from'./patientsController.ts'
import type{DoctorPatientDirectory}from'./patients'
import type{ConsultationType}from'./consultations'
import{validWaitlistQuery,validWaitlistInput,type WaitlistDirectory,type WaitlistHistory,type WaitlistRow,type WaitlistQuery,type WaitlistAction,type WaitlistInput}from'./waitlist.ts'
import type{waitlistRepository}from'./waitlistRepository'
type ReadKind='directory'|'history'|'types'|'patients'|'offers'
const flags=()=>({directory:false,history:false,types:false,patients:false,offers:false})
const errors=():Record<ReadKind,DoctorPatientError>=>({directory:null,history:null,types:null,patients:null,offers:null})
export const waitlistState=()=>({directory:null as WaitlistDirectory|null,history:null as WaitlistHistory|null,types:[]as ConsultationType[],patients:null as DoctorPatientDirectory|null,offers:null as DoctorAvailability|null,loading:flags(),errors:errors(),pending:false,actionError:null as DoctorPatientError})
export function createWaitlistController(repository:ReturnType<typeof waitlistRepository>|null,state:ReturnType<typeof waitlistState>,scope:()=>DoctorLocationContext|null,key=()=>crypto.randomUUID()){
 let generation=0,abort=new AbortController(),intent:{material:string;key:string}|null=null
 const revisions:Record<ReadKind,number>={directory:0,history:0,types:0,patients:0,offers:0}
 const scopeKey=()=>{const s=scope();return s?doctorScopeKey(s,'waitlist'):null},capture=()=>JSON.stringify([generation,scopeKey()]),signal=()=>AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
 function clear(){generation++;abort.abort();abort=new AbortController();intent=null;Object.assign(state,waitlistState())}
 function discard(){intent=null;state.actionError=null;revisions.offers++;state.offers=null;state.loading.offers=false;state.errors.offers=null}
 function failure(error:unknown){const type=doctorPatientFailure(error);if(type==='denied')clear();return type}
 async function read<T>(kind:ReadKind,fetcher:(s:DoctorLocationContext,signal:AbortSignal)=>Promise<T>,accept:(value:T)=>void){
  if(state.pending)return false;const s=scope(),expected=capture(),revision=++revisions[kind];state.loading[kind]=true;state.errors[kind]=null
  if(!repository||!s){state.loading[kind]=false;state.errors[kind]='denied';return false}
  try{const data=await fetcher(s,signal());if(expected!==capture()||revision!==revisions[kind])return false;accept(data);return true}catch(error){if(expected===capture()&&revision===revisions[kind]){const result=failure(error);state.errors[kind]=result}return false}finally{if(expected===capture()&&revision===revisions[kind])state.loading[kind]=false}
 }
 async function load(query:WaitlistQuery){if(state.pending)return false;if(!validWaitlistQuery(query)){state.errors.directory='invalid';return false}return read('directory',async(s,signal)=>{const result=await repository!.load(s.practiceId,s.locationId,query,signal);if(result.locationVersion!==s.locationVersion||result.timezone!==s.timezone)throw{code:'40001'};return result},value=>{state.directory=value})}
 async function history(entry:string,page=0){state.history=null;if(!doctorUuid(entry)||!Number.isSafeInteger(page)||page<0){state.errors.history='invalid';return false}return read('history',(s,signal)=>repository!.history(s.practiceId,s.locationId,entry,page,signal),value=>{state.history=value})}
 async function types(){state.types=[];return read('types',(s,signal)=>repository!.types(s.practiceId,s.locationId,signal),value=>{state.types=value})}
 async function patients(search=''){state.patients=null;if(search.length>100){state.errors.patients='invalid';return false}return read('patients',(s,signal)=>repository!.patients(s.practiceId,s.locationId,search,signal),value=>{state.patients=value})}
 async function offers(row:WaitlistRow,date:string){state.offers=null;if(!doctorUuid(row.id)||!doctorScheduleDate(date)||date<row.dateFrom||date>row.dateTo){state.errors.offers='invalid';return false}return read('offers',(s,signal)=>repository!.offers(s.practiceId,s.locationId,row,date,signal),value=>{state.offers=value})}
 async function command(entry:string,version:number,action:WaitlistAction,input:WaitlistInput){
  if(state.pending)return false;const s=scope(),expected=capture()
  if(!repository||!s||!doctorUuid(entry)||!Number.isSafeInteger(version)||version<0||(action==='create'?version!==0:version<1)||!validWaitlistInput(action,input)){state.actionError='invalid';return false}
  if(!state.directory?.canManage||!['appointments.read','appointments.write','patients.read'].every(cap=>s.capabilities.includes(cap as DoctorLocationContext['capabilities'][number]))){state.actionError='denied';return false}
  const material=JSON.stringify([scopeKey(),entry,version,action,input]);if(intent?.material!==material)intent={material,key:key()};state.pending=true;state.actionError=null
  try{const result=await repository.command(s.practiceId,s.locationId,entry,version,action,{...input},intent.key,signal());if(expected!==capture())return false;intent=null;return result}catch(error){if(expected===capture()){state.actionError=failure(error);if(state.actionError!=='network')intent=null}return false}finally{if(expected===capture())state.pending=false}
 }
 return{state,scopeKey,clear,discard,load,history,types,patients,offers,command}
}

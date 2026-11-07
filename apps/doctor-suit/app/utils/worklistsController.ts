import{doctorScopeKey}from'./contextScope.ts'
import{doctorUuid,type DoctorLocationContext}from'./locationContext.ts'
import{doctorPatientFailure,type DoctorPatientError}from'./patientsController.ts'
import type{DoctorPatientDirectory}from'./patients'
import{validWorklistQuery,validWorklistInput,type WorklistDirectory,type WorklistHistory,type WorklistAssignee,type WorklistQuery,type WorklistAction,type WorklistInput}from'./worklists.ts'
import type{worklistsRepository}from'./worklistsRepository'
type ReadKind='directory'|'history'|'options'|'patients'
const flags=()=>({directory:false,history:false,options:false,patients:false})
const errors=():Record<ReadKind,DoctorPatientError>=>({directory:null,history:null,options:null,patients:null})
export const worklistsState=()=>({directory:null as WorklistDirectory|null,history:null as WorklistHistory|null,options:[]as WorklistAssignee[],patients:null as DoctorPatientDirectory|null,loading:flags(),errors:errors(),pending:false,actionError:null as DoctorPatientError})
export function createWorklistsController(repository:ReturnType<typeof worklistsRepository>|null,state:ReturnType<typeof worklistsState>,scope:()=>DoctorLocationContext|null,key=()=>crypto.randomUUID()){
 let generation=0,abort=new AbortController(),intent:{material:string;key:string}|null=null
 const revisions:Record<ReadKind,number>={directory:0,history:0,options:0,patients:0}
 const scopeKey=()=>{const s=scope();return s?doctorScopeKey(s,'worklists'):null},capture=()=>JSON.stringify([generation,scopeKey()]),signal=()=>AbortSignal.any([abort.signal,AbortSignal.timeout(15000)])
 function clear(){generation++;abort.abort();abort=new AbortController();intent=null;Object.assign(state,worklistsState())}
 function discard(){intent=null;state.actionError=null}
 function failure(error:unknown){const type=doctorPatientFailure(error);if(type==='denied')clear();return type}
 async function read<T>(kind:ReadKind,fetcher:(s:DoctorLocationContext,signal:AbortSignal)=>Promise<T>,accept:(value:T)=>void){
  if(state.pending)return false;const s=scope(),expected=capture(),revision=++revisions[kind];state.loading[kind]=true;state.errors[kind]=null
  if(!repository||!s){state.loading[kind]=false;state.errors[kind]='denied';return false}
  try{const data=await fetcher(s,signal());if(expected!==capture()||revision!==revisions[kind])return false;accept(data);return true}catch(error){if(expected===capture()&&revision===revisions[kind]){const result=failure(error);state.errors[kind]=result}return false}finally{if(expected===capture()&&revision===revisions[kind])state.loading[kind]=false}
 }
 async function load(query:WorklistQuery){if(state.pending)return false;if(!validWorklistQuery(query)){state.errors.directory='invalid';return false}return read('directory',async(s,signal)=>{const result=await repository!.load(s.practiceId,s.locationId,query,signal);if(result.locationVersion!==s.locationVersion||result.timezone!==s.timezone)throw{code:'40001'};return result},value=>{state.directory=value})}
 async function history(entry:string,page=0){state.history=null;if(!doctorUuid(entry)||!Number.isSafeInteger(page)||page<0){state.errors.history='invalid';return false}return read('history',(s,signal)=>repository!.history(s.practiceId,s.locationId,entry,page,signal),value=>{state.history=value})}
 async function options(){state.options=[];return read('options',(s,signal)=>repository!.options(s.practiceId,s.locationId,signal),value=>{state.options=value})}
 async function patients(search=''){state.patients=null;if(search.length>100){state.errors.patients='invalid';return false}if(!scope()?.capabilities.includes('patients.read'))return false;return read('patients',(s,signal)=>repository!.patients(s.practiceId,s.locationId,search,signal),value=>{state.patients=value})}
 async function command(entry:string,version:number,action:WorklistAction,input:WorklistInput){
  if(state.pending)return false;const s=scope(),expected=capture()
  if(!repository||!s||!doctorUuid(entry)||!Number.isSafeInteger(version)||version<0||(action==='create'?version!==0:version<1)||!validWorklistInput(action,input)){state.actionError='invalid';return false}
  if(!s.capabilities.includes('worklists.read')||(['create','reassign','cancel'].includes(action)&&!state.directory?.canManage)){state.actionError='denied';return false}
  const material=JSON.stringify([scopeKey(),entry,version,action,input]);if(intent?.material!==material)intent={material,key:key()};state.pending=true;state.actionError=null
  try{const result=await repository.command(s.practiceId,s.locationId,entry,version,action,{...input},intent.key,signal());if(expected!==capture())return false;intent=null;return result}catch(error){if(expected===capture()){state.actionError=failure(error);if(state.actionError!=='network')intent=null}return false}finally{if(expected===capture())state.pending=false}
 }
 return{state,scopeKey,clear,discard,load,history,options,patients,command}
}

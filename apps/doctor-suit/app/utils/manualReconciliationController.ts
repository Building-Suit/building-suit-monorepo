import type{DoctorIdentity}from'./authController'
import{manualReportQuery,type ManualReport,type ManualReportQuery}from'./manualReconciliation.ts'
export interface ManualReportRepository{read:(actor:DoctorIdentity,query:ManualReportQuery,signal:AbortSignal)=>Promise<ManualReport>}
export interface ManualReportState{loading:boolean;error:'denied'|'invalid'|'network'|null;result:ManualReport|null}
export const manualReportState=():ManualReportState=>({loading:false,error:null,result:null})
export function createManualReportController(repo:ManualReportRepository|null,state:ManualReportState,identity:()=>DoctorIdentity|null,environment:string){
 let generation=0,abort=new AbortController()
 const scope=()=>{const a=identity();return a?JSON.stringify(['doctor-suit',environment,a.userId,a.sessionId,a.practiceId,'manual-reconciliation']):null}
 function clear(){generation++;abort.abort();abort=new AbortController();Object.assign(state,manualReportState())}
 async function load(query:ManualReportQuery){
  clear();const actor=identity(),s=scope(),g=generation
  if(!repo||!actor){state.error='denied';return false}
  state.loading=true
  try{const snapshot={...manualReportQuery(query)},result=await repo.read(actor,snapshot,AbortSignal.any([abort.signal,AbortSignal.timeout(20000)]));if(g!==generation||s!==scope())return false;state.result=result;return true}
  catch(e){if(g===generation&&s===scope()){const code=e&&typeof e==='object'&&'code'in e?String(e.code):'';state.error=code==='42501'?'denied':code==='22023'||e instanceof Error&&e.message==='DOCTOR_MANUAL_RECONCILIATION_CONTRACT_INVALID'?'invalid':'network'}return false}
  finally{if(g===generation&&s===scope())state.loading=false}
 }
 return{state,load,clear}
}

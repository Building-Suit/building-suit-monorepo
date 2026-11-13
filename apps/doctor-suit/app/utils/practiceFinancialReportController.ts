import type { DoctorLocationDirectory } from './locations.ts'
import { financialReportQuery,financialSourceRef,type FinancialReportScope,type FinancialReportQuery,type FinancialReport,type FinancialSourceRef,type FinancialSource } from './practiceFinancialReport.ts'
import type { PracticeFinancialReportRepository } from './practiceFinancialReportRepository.ts'
export function financialReportState(){return{locations:null as DoctorLocationDirectory|null,locationPage:1,locationsLoading:false,locationsError:false,data:null as FinancialReport|null,source:null as FinancialSource|null,scope:null as FinancialReportScope|null,loading:false,sourceLoading:false,error:null as 'network'|'denied'|'invalid'|null,sourceError:null as 'network'|'denied'|'invalid'|null,epoch:0}}
export function createPracticeFinancialReportController(repo:PracticeFinancialReportRepository|null,state:ReturnType<typeof financialReportState>,identity:()=>{userId:string;practiceId:string|null;sessionId:string}|null,environment:string){
 let directoryGeneration=0,directoryActive:AbortController|null=null
 let generation=0,sourceGeneration=0,active:AbortController|null=null,sourceActive:AbortController|null=null
 function stamp(){const a=identity();return JSON.stringify([environment,a?.userId,a?.sessionId,a?.practiceId])}
 function clear(){directoryGeneration++;directoryActive?.abort();generation++;sourceGeneration++;active?.abort();sourceActive?.abort();active=sourceActive=null;Object.assign(state,{locations:null,locationPage:1,locationsLoading:false,locationsError:false,data:null,source:null,scope:null,loading:false,sourceLoading:false,error:null,sourceError:null,epoch:state.epoch+1})}
 function error(e:unknown):'network'|'denied'|'invalid'{return e&&typeof e==='object'&&'code'in e&&e.code==='42501'?'denied':e instanceof Error&&/FINANCIAL_REPORT_INVALID|PRACTICE_(MONEY|BILLING)_INVALID/.test(e.message)?'invalid':'network'}
 async function read(scope:FinancialReportScope|null,query:FinancialReportQuery){const a=identity();if(!repo||!scope||!a||scope.userId!==a.userId||scope.practiceId!==a.practiceId){clear();state.error='denied';return false}
  let q:FinancialReportQuery;try{q=financialReportQuery(query)}catch{clear();state.error='invalid';return false}
  const own={...scope},changed=JSON.stringify(own)!==JSON.stringify(state.scope);active?.abort();const run=++generation,bound=stamp();active=new AbortController();if(changed){closeSource();state.data=null}state.scope=own;state.loading=true;state.error=null
  try{const data=await repo.read(own,q,active.signal);if(run!==generation||bound!==stamp()){if(run===generation)clear();return false}state.data=data;return true}catch(e){if(run===generation&&bound===stamp()){const failure=error(e);if(failure==='denied')clear();else state.data=null;state.error=failure}return false}finally{if(run===generation)state.loading=false}
 }
 function closeSource(){sourceGeneration++;sourceActive?.abort();sourceActive=null;state.source=null;state.sourceLoading=false;state.sourceError=null}
 async function source(ref:FinancialSourceRef){closeSource();const own=state.scope?{...state.scope}:null;if(!repo||!own)return false;let selected:FinancialSourceRef;try{selected=financialSourceRef(ref)}catch{state.sourceError='invalid';return false}
  const run=++sourceGeneration,bound=stamp();sourceActive=new AbortController();state.sourceLoading=true
  try{const data=await repo.source(own,selected,sourceActive.signal);if(run!==sourceGeneration||bound!==stamp()){if(run===sourceGeneration)clear();return false}state.source=data;return true}catch(e){if(run===sourceGeneration&&bound===stamp()){const failure=error(e);if(failure==='denied')clear();state.sourceError=failure}return false}finally{if(run===sourceGeneration)state.sourceLoading=false}
 }
 async function locations(page=1){const a=identity();if(!repo||!a?.practiceId)return false;directoryActive?.abort();const run=++directoryGeneration,bound=stamp();directoryActive=new AbortController();state.locationsLoading=true;state.locationsError=false
  try{const result=await repo.locations(a.practiceId,page,directoryActive.signal);if(run!==directoryGeneration||bound!==stamp())return false;state.locations=result;state.locationPage=page;return true}catch(e){if(run===directoryGeneration&&bound===stamp()){if(error(e)==='denied')clear();state.locations=null;state.locationsError=true}return false}finally{if(run===directoryGeneration)state.locationsLoading=false}
 }
 return{state,read,source,closeSource,clear,locations}
}

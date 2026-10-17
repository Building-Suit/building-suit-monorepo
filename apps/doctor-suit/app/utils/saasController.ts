import type{DoctorSaasTermsDocument}from'./saasTermsDocument'
import type{DoctorIdentity}from'./authController'
import type{doctorSaasRepository}from'./saasRepository'
import type{DoctorSaasTermsProjection}from'./saasTerms'
import{doctorSaasFailure,type DoctorSaasStatus,type DoctorSaasError}from'./saasStatus.ts'
import{createDoctorEntitlementDeadline,type DoctorEntitlementTimers}from'./entitlement.ts'
export interface DoctorSubscriptionState{loading:boolean;pending:boolean;offer:DoctorSaasTermsProjection|null;status:DoctorSaasStatus|null;document:DoctorSaasTermsDocument|null;accepted:boolean;error:DoctorSaasError|null}
export const doctorSubscriptionState=():DoctorSubscriptionState=>({loading:false,pending:false,offer:null,status:null,document:null,accepted:false,error:null})
export function createDoctorSubscriptionController(repository:ReturnType<typeof doctorSaasRepository>|null,state:DoctorSubscriptionState,identity:()=>DoctorIdentity|null,changed:()=>Promise<unknown>,timers?:DoctorEntitlementTimers,key=()=>crypto.randomUUID()){
 let loadedScope:string|null=null;let generation=0;let abort=new AbortController();let attempt:{material:string;key:string}|null=null;const expiry=createDoctorEntitlementDeadline(timers)
 const scope=()=>{const actor=identity();return actor?JSON.stringify([actor.userId,actor.sessionId,actor.practiceId]):null}
 function clear(){loadedScope=null;generation++;abort.abort();abort=new AbortController();expiry.clear();attempt=null;Object.assign(state,doctorSubscriptionState())}
 function canStart(){return Boolean(loadedScope===scope() && state.offer?.configured && state.offer.terms && state.offer.terms.trialDays>0 && state.document?.termsId===state.offer.terms.id && state.document.documentRef===state.offer.terms.termsDocumentRef && state.status?.state==='unconfigured' && !state.loading && (!state.error || state.error==='network'))}
 async function load(){
  if(state.pending)return false
  const actor=identity(),expected=scope(),captured=++generation;abort.abort();abort=new AbortController();expiry.clear();loadedScope=null;state.loading=true;state.accepted=false;state.error=null;state.offer=null;state.status=null;state.document=null
  if(!actor||!repository){state.loading=false;state.error='denied';return false}
  const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(10000)]),sentAt=timers?.now()??0
  try{
   const[offer,status]=await Promise.allSettled([repository.terms(actor,signal),repository.status(actor,signal)])
   if(captured!==generation||expected!==scope()||signal.aborted)return false
   if(status.status!=='fulfilled')throw status.reason
   if(!status.value.observedAt || typeof status.value.writesAllowed!=='boolean')throw{code:'DS001'}
   if(offer.status==='rejected'&&!(status.value.period&&doctorSaasFailure(offer.reason)==='denied'))throw offer.reason
   const terms=status.value.terms??(offer.status==='fulfilled'?offer.value.terms:null)
   const document=terms?await repository.document(terms,signal):null
   if(captured!==generation||expected!==scope()||signal.aborted)return false
   state.document=document;state.offer=offer.status==='fulfilled'?offer.value:null;state.status=status.value;loadedScope=expected;attempt=null
   const value=status.value
   if(value.period&&value.observedAt)expiry.arm({state:value.state,revision:value.revision,writesAllowed:value.periodActive,canAddStaff:false,canAddClinic:false,overLimit:false,validUntil:value.period.endsAt,observedAt:value.observedAt},sentAt,()=>{clear();const cleared=generation;void changed().then(()=>{if(cleared===generation&&expected===scope())void load()})},()=>captured===generation&&expected===scope())
   return true
  }catch(error){if(captured===generation&&expected===scope())state.error=doctorSaasFailure(error);return false}
  finally{if(captured===generation&&expected===scope())state.loading=false}
 }
 async function start(){
  if(state.pending||!repository||!state.accepted||!canStart()||!state.offer?.terms)return false
  const actor=scope(),captured=generation,terms=state.offer.terms,input={termsId:terms.id,configurationRevision:state.offer.configurationRevision,documentRef:terms.termsDocumentRef}
  const material=JSON.stringify([actor,input]);if(attempt?.material!==material)attempt={material,key:key()}
  state.pending=true;state.error=null
  try{
   await repository.startTrial(input,attempt.key,AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]))
   if(captured!==generation||actor!==scope())return false
   state.pending=false;state.accepted=false;attempt=null
   if(!await load())return false
   if(actor===scope())await changed();return actor===scope()
  }catch(error){if(captured===generation&&actor===scope()){state.error=doctorSaasFailure(error);if(state.error!=='network')state.accepted=false}return false}
  finally{if(captured===generation&&actor===scope())state.pending=false}
 }
 return{state,clear,load,start,canStart}
}

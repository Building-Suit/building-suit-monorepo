import type{DoctorSaasQuoteRequest}from'./saasQuoteRepository'
import type{DoctorIdentity}from'./authController'
import type{ManualPaymentRepository,ManualReviewInput}from'./manualPaymentRepository'
import type{ManualCatalog,ManualConfiguration,ManualInstructions,ManualPaymentNotice}from'./manualPayments'
import{manualMinor}from'./manualPayments.ts'
import type{DoctorSaasStatus}from'./saasStatus'
import type{DoctorSaasTermsDocument}from'./saasTermsDocument'
export interface ManualPaymentState{
 ready:boolean;loading:boolean;pending:boolean;error:'denied'|'conflict'|'invalid'|'network'|null;uncertain:boolean;review:boolean;canReview:boolean;activationConfigured:boolean
 catalog:ManualCatalog|null;configuration:ManualConfiguration|null;account:DoctorSaasStatus|null;document:DoctorSaasTermsDocument|null
 items:ManualPaymentNotice[];page:number;total:number;selected:string|null;plan:string;interval:'monthly'|'yearly';accepted:boolean
 instructions:ManualInstructions|null;reference:string;at:string;file:File|null;uploadNotice:string|null
 reason:string;receivedReference:string;receivedAmount:string;receivedCurrency:string;receivedAt:string;verification:string;independent:boolean
}
export const manualPaymentState=():ManualPaymentState=>({ready:false,loading:false,pending:false,error:null,uncertain:false,review:false,canReview:false,activationConfigured:false,catalog:null,configuration:null,account:null,document:null,items:[],page:1,total:0,selected:null,plan:'starter',interval:'monthly',accepted:false,instructions:null,reference:'',at:'',file:null,uploadNotice:null,reason:'',receivedReference:'',receivedAmount:'',receivedCurrency:'',receivedAt:'',verification:'',independent:false})
function failure(e:unknown):ManualPaymentState['error']{const c=e&&typeof e==='object'&&'code'in e?String(e.code):'';return c==='42501'?'denied':['40001','DS008','DS009','DS010','23505'].includes(c)?'conflict':['22023','23514'].includes(c)?'invalid':'network'}
export function createManualPaymentController(repo:ManualPaymentRepository|null,state:ManualPaymentState,identity:()=>DoctorIdentity|null,environment:string,afterActivation:()=>void,key=()=>crypto.randomUUID()){
 let generation=0,loaded:string|null=null,abort=new AbortController()
 let operation:{scope:string;name:string;run:(actor:DoctorIdentity,signal:AbortSignal)=>Promise<void>}|null=null
 const scope=()=>{const a=identity();return a?JSON.stringify(['doctor-suit',environment,a.userId,a.sessionId,a.practiceId,'manual-payments']):null}
 const active=(g:number,s:string|null)=>g===generation&&s===scope()
 const signal=()=>AbortSignal.any([abort.signal,AbortSignal.timeout(20000)])
 const selected=()=>state.items.find(n=>n.id===state.selected)??null
 function clear(){generation++;abort.abort();abort=new AbortController();loaded=null;operation=null;Object.assign(state,manualPaymentState())}
 function upsert(row:ManualPaymentNotice){state.items=[row,...state.items.filter(n=>n.id!==row.id)].slice(0,25);state.selected=row.id}
 async function load(review=state.review,page=state.page){
  if(state.pending)return false
  if(loaded!==scope())clear();const actor=identity(),s=scope(),g=++generation;abort.abort();abort=new AbortController();state.loading=true;state.ready=false;state.error=null;state.review=review;state.items=[];state.selected=null
  if(!repo||!actor){state.loading=false;state.error='denied';return false}
  try{
   const canReview=await repo.capability(actor,signal());if(review&&!canReview)throw{code:'42501'}
   const queue=await repo.queue(actor,review,page,signal())
   const customer=review?null:await Promise.all([repo.catalog(signal()),repo.configuration(actor,signal()),repo.status(actor,signal())])
   if(!active(g,s))return false
   state.canReview=canReview;state.items=queue.items;state.total=queue.total;state.page=queue.page;state.activationConfigured=queue.activationConfigured
   if(customer)[state.catalog,state.configuration,state.account]=customer
   loaded=s;state.ready=true;return true
  }catch(e){if(active(g,s))state.error=failure(e);return false}finally{if(active(g,s))state.loading=false}
 }
 async function choose(plan=state.plan,interval=state.interval){
  if(state.pending||operation||!repo||!state.ready||state.review||state.instructions)return false
  state.plan=plan;state.interval=interval;state.accepted=false;state.document=null
  const terms=state.catalog?.plans.find(p=>p.key===plan)?.terms;if(!terms)return false
  const g=generation,s=scope();state.loading=true
  try{const doc=await repo.document(terms,signal());if(!active(g,s))return false;state.document=doc;return true}catch(e){if(active(g,s))state.error=failure(e);return false}finally{if(active(g,s))state.loading=false}
 }
 async function execute(name:string,create:()=>((actor:DoctorIdentity,signal:AbortSignal)=>Promise<void>)){
  if(!repo||state.pending||state.loading||loaded!==scope()||!state.ready)return false
  const actor=identity(),s=scope();if(!actor||!s)return false
  if(operation&&operation.name!==name)return false
  if(!operation){try{operation={scope:s,name,run:create()}}catch{state.error='invalid';return false}}
  if(operation.scope!==s)return false
  const g=generation,attempt=operation;state.pending=true;state.error=null
  try{await attempt.run(actor,signal());if(!active(g,s))return false;operation=null;state.uncertain=false;return true}
  catch(e){if(active(g,s)){state.error=failure(e);state.uncertain=state.error==='network';if(!state.uncertain)operation=null}return false}
  finally{if(active(g,s))state.pending=false}
 }
 function canPrepare(){const plan=state.catalog?.plans.find(p=>p.key===state.plan);return Boolean(!state.review&&state.configuration?.configured&&plan?.terms&&state.document?.termsId===plan.terms.id&&state.accepted&&state.account&&!state.instructions&&!state.pending&&!state.loading&&state.ready&&!operation)}
 async function prepare(){
  if(!operation&&!canPrepare())return false
  return execute('prepare',()=>{
   const plan=state.catalog!.plans.find(p=>p.key===state.plan)!,terms=plan.terms!,config=state.configuration!,catalog=state.catalog!,account=state.account!
   const input:DoctorSaasQuoteRequest={termsId:terms.id,configurationRevision:catalog.revision,accountRevision:account.revision,interval:state.interval,documentRef:terms.termsDocumentRef}
   const qKey=key(),iKey=key(),pKey=key(),g=generation,s=scope()
   return async(actor,signal)=>{const quote=await repo!.quote(actor,input,qKey,signal);if(!active(g,s))throw{code:'42501'};signal.throwIfAborted();const intent=await repo!.intent(actor,quote.id,iKey,signal);if(!active(g,s))throw{code:'42501'};signal.throwIfAborted();const instructions=await repo!.instructions(actor,intent.id,config.revision,pKey,signal);if(active(g,s))state.instructions=instructions}
  })
 }
 async function submit(){
  if(!operation&&(!state.instructions||state.review||!state.reference.trim()||!state.at||state.uploadNotice))return false
  return execute('submit',()=>{const instructions=state.instructions!,reference=state.reference.trim(),at=new Date(state.at).toISOString(),commandKey=key(),g=generation,s=scope();return async(actor,signal)=>{const row=await repo!.submit(actor,instructions,reference,at,commandKey,signal);if(active(g,s)){upsert(row);state.uploadNotice=row.id;state.instructions=null;state.reference='';state.at='';state.accepted=false}}})
 }
 async function upload(){
  if(!operation&&(!state.uploadNotice||!state.file||state.review))return false
  return execute('upload',()=>{const id=state.uploadNotice!,file=state.file!,commandKey=key(),g=generation,s=scope();return async(_actor,signal)=>{const evidence=await repo!.upload(id,file,commandKey,signal);if(active(g,s)){const row=state.items.find(n=>n.id===id);if(row)upsert({...row,evidence:[evidence]});state.file=null;state.uploadNotice=null}}})
 }
 function select(id:string){if(state.pending||operation)return;state.selected=id;const row=selected();if(!state.review&&!state.instructions){state.uploadNotice=row&&!row.evidence.length&&['submitted','under_review'].includes(row.status)?id:null;state.file=null}state.reason='';state.receivedReference='';state.receivedAmount='';state.receivedCurrency='';state.receivedAt='';state.verification='';state.independent=false}
 async function review(action:ManualReviewInput['action']){
  const notice=selected();if(!operation&&(!state.review||!state.canReview||!notice||!['submitted','under_review'].includes(notice.status)||!state.reason.trim()))return false
  return execute(`review:${action}`,()=>{
   const verified=action==='funds_verified',input:ManualReviewInput={action,reason:state.reason.trim(),reference:verified?state.receivedReference.trim():null,amount:verified?manualMinor(state.receivedAmount,notice!.exponent):null,currency:verified?state.receivedCurrency.trim().toUpperCase():null,at:verified?new Date(state.receivedAt).toISOString():null,verification:verified?state.verification.trim():null,independent:verified?state.independent:false},commandKey=key(),g=generation,s=scope(),original=notice!
   return async(actor,signal)=>{const row=await repo!.review(actor,original,input,commandKey,signal);if(active(g,s)){upsert(row);state.independent=false;state.receivedAmount='';state.receivedReference='';state.verification=''}}
  })
 }
 async function activate(){const notice=selected();if(!operation&&(!state.review||!state.canReview||!state.activationConfigured||notice?.status!=='funds_verified'))return false
  return execute('activate',()=>{const original=notice!,commandKey=key(),g=generation,s=scope();return async(actor,signal)=>{const row=await repo!.activate(actor,original,commandKey,signal);if(active(g,s)){upsert(row);afterActivation()}}})
 }
 async function retry(){if(!operation)return false;return execute(operation.name,()=>operation!.run)}
 async function download(evidence:string){const row=selected(),actor=identity(),g=generation,s=scope();if(!repo||!actor||!row||!row.evidence.some(e=>e.id===evidence)||state.pending)return null;state.pending=true;try{const blob=await repo.download(row.id,evidence,key(),signal());return active(g,s)?blob:null}catch(e){if(active(g,s))state.error=failure(e);return null}finally{if(active(g,s))state.pending=false}}
 function skipReceipt(){if(!state.pending&&!operation){state.uploadNotice=null;state.file=null}}
 return{state,clear,load,choose,prepare,submit,upload,select,review,activate,retry,download,selected,canPrepare,skipReceipt}
}

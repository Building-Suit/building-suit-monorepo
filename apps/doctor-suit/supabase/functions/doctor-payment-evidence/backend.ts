import{createClient}from'npm:@supabase/supabase-js@2.116.0'
import type{Database}from'../_shared/database.types.ts'
import{DoctorDocumentFailure,DOCTOR_DOCUMENT_MAX_BYTES}from'../doctor-documents/files.ts'
import{record,uuid,paymentEvidence,paymentPlan,type PaymentFileBackend}from'./contracts.ts'
const bucket='doctor-payment-evidence'
export function paymentEvidenceBackend(configuration:{url:string;publicKey:string;serviceKey:string},authorization:string):PaymentFileBackend{
 const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:(input:RequestInfo|URL,init?:RequestInit)=>fetch(input,{...init,signal:AbortSignal.timeout(20000)})}}
 const user=createClient<Database>(configuration.url,configuration.publicKey,{...options,global:{...options.global,headers:{Authorization:authorization}}})
 const service=createClient<Database>(configuration.url,configuration.serviceKey,options)
 function checked(error:unknown){if(!error)return;const code=record(error)?error.code:null;throw new DoctorDocumentFailure(code==='42501'?403: ['22023','40001','23505'].includes(String(code))?409:503,code==='42501'?'denied':['22023','40001','23505'].includes(String(code))?'conflict':'unavailable')}
 async function privateBucket(){const{data,error}=await service.storage.getBucket(bucket);if(error||!data||data.public||Number(data.file_size_limit)!==DOCTOR_DOCUMENT_MAX_BYTES||!Array.isArray(data.allowed_mime_types)||data.allowed_mime_types.length!==3||!['application/pdf','image/png','image/jpeg'].every(m=>data.allowed_mime_types!.includes(m)))throw new DoctorDocumentFailure(503,'unavailable')}
 return{
  async authenticate(){
   const identity=await user.auth.getUser(authorization.slice(7));if(identity.error||!identity.data.user)throw new DoctorDocumentFailure(401,'session')
   const marker=await user.rpc('doctor_runtime_contract');if(marker.error||!record(marker.data)||marker.data.product!=='doctor-suit'||marker.data.version!==1||marker.data.data_mode!=='synthetic')throw new DoctorDocumentFailure(503,'unavailable')
   const result=await user.rpc('doctor_session_context');if(result.error||!record(result.data)||result.data.user_id!==identity.data.user.id||!uuid(result.data.user_id)||!uuid(result.data.session_id))throw new DoctorDocumentFailure(401,'session')
   return{userId:result.data.user_id,sessionId:result.data.session_id}
  },
  async access(notice,write){const{data,error}=await user.rpc('doctor_payment_evidence_access',{p_notice:notice,p_write:write});checked(error);if(!record(data)||data.notice_id!==notice||data.max_bytes!==DOCTOR_DOCUMENT_MAX_BYTES||data.max_files!==1)throw new DoctorDocumentFailure(503,'unavailable');await privateBucket()},
  async reserve(actor,request,material){const{data,error}=await service.rpc('doctor_reserve_payment_evidence',{p_actor:actor.userId,p_session:actor.sessionId,p_notice:request.noticeId,p_filename:request.filename!,p_mime:material.mime,p_size:material.size,p_sha:material.sha256,p_key:request.key});checked(error);const plan=paymentPlan(data,request.noticeId);if(!plan.object_path.startsWith(`${actor.userId}/`))throw new DoctorDocumentFailure(503,'unavailable');return plan},
  async finalize(actor,id){const{data,error}=await service.rpc('doctor_finalize_payment_evidence',{p_actor:actor.userId,p_session:actor.sessionId,p_intent:id});checked(error);if(!record(data)||!uuid(data.notice_id))throw new DoctorDocumentFailure(503,'unavailable');return paymentEvidence(data,data.notice_id)},
  async plan(actor,request,key){const{data,error}=await service.rpc('doctor_deliver_payment_evidence',{p_actor:actor.userId,p_session:actor.sessionId,p_notice:request.noticeId,p_evidence:request.evidenceId!,...(key?{p_key:key}:{})});checked(error);const plan=paymentPlan(data,request.noticeId);if(plan.id!==request.evidenceId)throw new DoctorDocumentFailure(503,'unavailable');return plan},
  async put(plan,bytes){await privateBucket();const r=await service.storage.from(bucket).upload(plan.object_path,new Uint8Array(bytes),{contentType:plan.mime_type,upsert:false,cacheControl:'0'});if(r.error&&!['400','409'].includes(String(r.error.statusCode)))throw new DoctorDocumentFailure(503,'unavailable')},
  async get(plan){await privateBucket();const{data,error}=await service.storage.from(bucket).download(plan.object_path);if(error||!data||data.size!==plan.byte_size||data.size>DOCTOR_DOCUMENT_MAX_BYTES)throw new DoctorDocumentFailure(503,'unavailable');return new Uint8Array(await data.arrayBuffer())},
 }
}

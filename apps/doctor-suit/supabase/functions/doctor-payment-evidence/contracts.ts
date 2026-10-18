import{DoctorDocumentFailure,DOCTOR_DOCUMENT_MAX_BYTES,type DoctorFileMime}from'../doctor-documents/files.ts'
export interface PaymentActor{userId:string;sessionId:string}
export interface PaymentFileRequest{noticeId:string;key:string;filename:string|null;evidenceId:string|null}
export interface PaymentEvidence{id:string;notice_id:string;filename:string;mime_type:DoctorFileMime;byte_size:number;sha256:string}
export interface PaymentFilePlan extends PaymentEvidence{object_path:string;state?:'reserved'|'committed'}
export interface PaymentFileBackend{
 authenticate():Promise<PaymentActor>;access(notice:string,write:boolean):Promise<void>
 reserve(actor:PaymentActor,request:PaymentFileRequest,material:{mime:DoctorFileMime;size:number;sha256:string}):Promise<PaymentFilePlan>
 finalize(actor:PaymentActor,id:string):Promise<PaymentEvidence>
 plan(actor:PaymentActor,request:PaymentFileRequest,key?:string):Promise<PaymentFilePlan>
 put(plan:PaymentFilePlan,bytes:Uint8Array):Promise<void>;get(plan:PaymentFilePlan):Promise<Uint8Array>
}
export const record=(v:unknown):v is Record<string,unknown>=>Boolean(v&&typeof v==='object'&&!Array.isArray(v))
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
export function paymentFileRequest(value:string|null):PaymentFileRequest{
 let v:unknown;try{if(!value||value.length>2048)throw 0;v=JSON.parse(decodeURIComponent(value))}catch{throw new DoctorDocumentFailure(400,'invalid')}
 if(!record(v)||Object.keys(v).some(k=>!['noticeId','key','filename','evidenceId'].includes(k))||!uuid(v.noticeId)||!uuid(v.key)
  ||(v.filename!==undefined&&v.filename!==null&&typeof v.filename!=='string')||(v.evidenceId!==undefined&&v.evidenceId!==null&&!uuid(v.evidenceId)))throw new DoctorDocumentFailure(400,'invalid')
 return{noticeId:v.noticeId.toLowerCase(),key:v.key.toLowerCase(),filename:typeof v.filename==='string'?v.filename:null,evidenceId:typeof v.evidenceId==='string'?v.evidenceId.toLowerCase():null}
}
export function paymentEvidence(v:unknown,notice:string):PaymentEvidence{
 if(!record(v)||!uuid(v.id)||v.notice_id!==notice||typeof v.filename!=='string'||!['application/pdf','image/png','image/jpeg'].includes(String(v.mime_type))
  ||!Number.isSafeInteger(v.byte_size)||Number(v.byte_size)<1||Number(v.byte_size)>DOCTOR_DOCUMENT_MAX_BYTES||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256))throw new DoctorDocumentFailure(503,'unavailable')
 return{id:v.id,notice_id:notice,filename:v.filename,mime_type:v.mime_type as DoctorFileMime,byte_size:Number(v.byte_size),sha256:v.sha256}
}
export function paymentPlan(v:unknown,notice:string):PaymentFilePlan{
 const evidence=paymentEvidence(v,notice)
 if(!record(v)||typeof v.object_path!=='string'||!new RegExp(`^[a-f0-9-]{36}/${notice}/[a-f0-9-]{36}\\.(pdf|png|jpg)$`).test(v.object_path))throw new DoctorDocumentFailure(503,'unavailable')
 return{...evidence,object_path:v.object_path,...(v.state==='reserved'||v.state==='committed'?{state:v.state}:{})}
}

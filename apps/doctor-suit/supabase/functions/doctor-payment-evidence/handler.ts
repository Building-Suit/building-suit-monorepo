import{DoctorDocumentFailure,doctorDocumentBytes,doctorDocumentDisposition,doctorDocumentFilename,doctorDocumentHash,doctorDocumentMime}from'../doctor-documents/files.ts'
import{paymentFileRequest,type PaymentFileBackend}from'./contracts.ts'
export function createPaymentEvidenceHandler(backend:(authorization:string)=>PaymentFileBackend,origins:readonly string[]){
 return async(request:Request):Promise<Response>=>{
  const headers=new Headers({'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',Vary:'Origin'})
  const json=(value:unknown,status=200)=>{headers.set('Content-Type','application/json');return new Response(JSON.stringify(value),{status,headers})}
  try{
   const origin=request.headers.get('origin');if(origin&&!origins.includes(origin))throw new DoctorDocumentFailure(403,'denied')
   if(origin)headers.set('Access-Control-Allow-Origin',origin)
   headers.set('Access-Control-Allow-Methods','POST, OPTIONS');headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-doctor-payment-evidence')
   headers.set('Access-Control-Expose-Headers','Content-Type, Content-Disposition')
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
   if(request.method!=='POST')throw new DoctorDocumentFailure(405,'invalid')
   const authorization=request.headers.get('authorization')||''
   if(!/^Bearer [A-Za-z0-9._-]+$/i.test(authorization)||authorization.length>8192)throw new DoctorDocumentFailure(401,'session')
   const data=paymentFileRequest(request.headers.get('x-doctor-payment-evidence')),operation=new URL(request.url).searchParams.get('op')
   if(operation!=='upload'&&operation!=='download')throw new DoctorDocumentFailure(400,'invalid')
   const service=backend(authorization),actor=await service.authenticate();await service.access(data.noticeId,operation==='upload')
   if(operation==='upload'){
    if(!doctorDocumentFilename(data.filename)||data.evidenceId)throw new DoctorDocumentFailure(400,'invalid')
    const bytes=await doctorDocumentBytes(request),mime=doctorDocumentMime(bytes,data.filename,request.headers.get('content-type')),sha256=await doctorDocumentHash(bytes)
    const plan=await service.reserve(actor,data,{mime,size:bytes.length,sha256})
    if(plan.sha256!==sha256||plan.byte_size!==bytes.length||plan.mime_type!==mime||!plan.state)throw new DoctorDocumentFailure(503,'unavailable')
    if(plan.state!=='committed'){
     await service.put(plan,bytes);const stored=await service.get(plan)
     if(stored.length!==bytes.length||await doctorDocumentHash(stored)!==sha256)throw new DoctorDocumentFailure(503,'unavailable')
    }
    const committed=await service.finalize(actor,plan.id)
    if(committed.id!==plan.id||committed.notice_id!==data.noticeId||committed.sha256!==plan.sha256||committed.byte_size!==plan.byte_size||committed.mime_type!==plan.mime_type||committed.filename!==plan.filename)throw new DoctorDocumentFailure(503,'unavailable')
    return json(committed)
   }
   if(!data.evidenceId||data.filename)throw new DoctorDocumentFailure(400,'invalid')
   const plan=await service.plan(actor,data),bytes=await service.get(plan)
   if(bytes.length!==plan.byte_size||await doctorDocumentHash(bytes)!==plan.sha256)throw new DoctorDocumentFailure(503,'unavailable')
   const latest=await service.plan(actor,data,data.key)
   if(latest.id!==plan.id||latest.object_path!==plan.object_path||latest.sha256!==plan.sha256)throw new DoctorDocumentFailure(503,'unavailable')
   headers.set('Content-Type',plan.mime_type);headers.set('Content-Disposition',doctorDocumentDisposition(plan.filename));headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; sandbox")
   return new Response(new Uint8Array(bytes),{status:200,headers})
  }catch(error){const safe=error instanceof DoctorDocumentFailure?error:new DoctorDocumentFailure(503,'unavailable');return json({error:safe.code},safe.status)}
 }
}

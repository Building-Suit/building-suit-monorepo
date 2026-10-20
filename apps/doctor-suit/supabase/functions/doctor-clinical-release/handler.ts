import {DoctorDocumentFailure,doctorDocumentDisposition,doctorDocumentHash} from '../doctor-documents/files.ts'
import {documentRecord,documentUuid,type DocumentActor,type DocumentPlan} from '../doctor-documents/contracts.ts'
export interface ClinicalReleaseBackend {authenticate():Promise<DocumentActor>;plan(actor:DocumentActor,releaseId:string,versionId:string,key?:string):Promise<DocumentPlan>;get(plan:DocumentPlan):Promise<Uint8Array>}
export function createClinicalReleaseHandler(backend:(authorization:string)=>ClinicalReleaseBackend,origins:readonly string[]) {
 return async(request:Request):Promise<Response>=>{
  const headers=new Headers({'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer',Vary:'Origin'})
  const fail=(status:number,code:string)=>{headers.set('Content-Type','application/json');return new Response(JSON.stringify({error:code}),{status,headers})}
  try{
   const origin=request.headers.get('origin');if(origin&&!origins.includes(origin))throw new DoctorDocumentFailure(403,'denied')
   if(origin)headers.set('Access-Control-Allow-Origin',origin)
   headers.set('Access-Control-Allow-Methods','POST, OPTIONS');headers.set('Access-Control-Allow-Headers','authorization, apikey, content-type, x-client-info, x-doctor-release');headers.set('Access-Control-Expose-Headers','Content-Type, Content-Disposition')
   if(request.method==='OPTIONS')return new Response(null,{status:204,headers})
   if(request.method!=='POST')throw new DoctorDocumentFailure(405,'invalid')
   const authorization=request.headers.get('authorization')??'',raw=request.headers.get('x-doctor-release')??''
   if(!/^Bearer [A-Za-z0-9._-]+$/i.test(authorization)||authorization.length>8192)throw new DoctorDocumentFailure(401,'session')
   if(raw.length>1024)throw new DoctorDocumentFailure(400,'invalid')
   let input:unknown;try{input=JSON.parse(decodeURIComponent(raw))}catch{throw new DoctorDocumentFailure(400,'invalid')}
   if(!documentRecord(input)||Object.keys(input).length!==3||!['releaseId','versionId','key'].every(key=>documentUuid(input[key])))throw new DoctorDocumentFailure(400,'invalid')
   const service=backend(authorization),actor=await service.authenticate(),releaseId=input.releaseId as string,versionId=input.versionId as string
   const plan=await service.plan(actor,releaseId,versionId),bytes=await service.get(plan)
   if(bytes.byteLength!==plan.size||await doctorDocumentHash(bytes)!==plan.sha256)throw new DoctorDocumentFailure(503,'unavailable')
   const checked=await service.plan(actor,releaseId,versionId,input.key as string)
   if(checked.versionId!==plan.versionId||checked.documentId!==plan.documentId||checked.objectPath!==plan.objectPath||checked.sha256!==plan.sha256||checked.size!==plan.size||checked.mime!==plan.mime)throw new DoctorDocumentFailure(503,'unavailable')
   headers.set('Content-Type',plan.mime);headers.set('Content-Disposition',doctorDocumentDisposition(plan.filename));headers.set('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; sandbox")
   return new Response(new Uint8Array(bytes),{status:200,headers})
  }catch(error){const safe=error instanceof DoctorDocumentFailure?error:new DoctorDocumentFailure(503,'unavailable');return fail(safe.status,safe.code)}
 }
}
